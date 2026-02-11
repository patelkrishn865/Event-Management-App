import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!stripeKey || !supabaseUrl || !serviceRole) {
      return NextResponse.json(
        { error: "Missing env vars" },
        { status: 500 }
      );
    }

    const {
      event_id,
      event_day_id,
      items,
      buyer_name,
      buyer_email,
      buyer_phone,
      success_url,
      cancel_url,
    } = body || {};

    if (!event_day_id) {
      return NextResponse.json(
        { error: "event_day is required" },
        { status: 400 }
      );
    }

    if (!event_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload" },
        { status: 400 }
      );
    }

    if (!buyer_name || !buyer_email || !success_url || !cancel_url) {
      return NextResponse.json(
        { error: "buyer_name, buyer_email, success_url, cancel_url required" },
        { status: 400 }
      );
    }

    const stripe = new Stripe(stripeKey);
    const sb = createClient(supabaseUrl, serviceRole);

    let buyerId = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice("Bearer ".length);
      const { data: userData, error: uErr } = await sb.auth.getUser(token);
      if (!uErr) buyerId = userData?.user?.id ?? null;
    }

    const { data: event, error: eErr } = await sb
      .from("events")
      .select("id,title,status,starts_at,ends_at")
      .eq("id", event_id)
      .single();

    if (eErr || !event) {
      return NextResponse.json(
        { error: event ? "Event query failed" : "Event not found" },
        { status: event ? 500 : 404 }
      );
    }

    if (event.status !== "published") {
      return NextResponse.json(
        { error: "Event not published" },
        { status: 400 }
      );
    }

    const now = new Date();
    const eventEnd = event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at);
    if (now > eventEnd) {
      return NextResponse.json(
        { error: "Event has already ended" },
        { status: 400 }
      );
    }

    const typeIds = items.map((i) => i.ticket_type_id);
    const { data: types, error: tErr } = await sb
      .from("ticket_types")
      .select("id,event_id,name,price_cents,currency,is_active")
      .in("id", typeIds);

    if (tErr) {
      return NextResponse.json(
        { error: "Ticket types query failed" },
        { status: 500 }
      );
    }

    const typeMap = new Map(types.map((t) => [t.id, t]));

    let total = 0;
    let currency = "INR";

    for (const it of items) {
      const tt = typeMap.get(it.ticket_type_id);
      if (!tt) {
        return NextResponse.json({ error: "Invalid ticket type" }, { status: 400 });
      }
      if (tt.event_id !== event_id) {
        return NextResponse.json({ error: "Ticket type mismatch" }, { status: 400 });
      }
      if (!tt.is_active) {
        return NextResponse.json({ error: "Ticket type inactive" }, { status: 400 });
      }

      total += Number(tt.price_cents) * Number(it.quantity || 0);
      currency = tt.currency ?? currency;
    }

    if (total <= 0) {
      return NextResponse.json({ error: "Total must be > 0" }, { status: 400 });
    }

    const orderPayload = {
      event_id,
      event_day_id,
      buyer_id: buyerId,
      buyer_name,
      buyer_email,
      buyer_phone: buyer_phone || null,
      status: "pending",
      amount_total_cents: total,
      currency,
      payment_provider: "stripe",
    };

    const { data: order, error: oErr } = await sb
      .from("orders")
      .insert(orderPayload)
      .select("id")
      .single();

    if (oErr) {
      return NextResponse.json(
        { error: "Order insert failed" },
        { status: 500 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url,
      cancel_url,
      customer_email: buyer_email,
      metadata: {
        order_id: order.id,
        event_day_id,
        event_id,
        items: JSON.stringify(items),
      },
      line_items: items.map((it) => {
        const tt = typeMap.get(it.ticket_type_id);
        return {
          quantity: Number(it.quantity),
          price_data: {
            currency: (tt.currency || "inr").toLowerCase(),
            unit_amount: Number(tt.price_cents),
            product_data: { name: `${event.title} — ${tt.name}` },
          },
        };
      }),
    });

    await sb
      .from("orders")
      .update({ provider_session_id: session.id })
      .eq("id", order.id);

    return NextResponse.json(
      { checkout_url: session.url, order_id: order.id, buyer_id: buyerId },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: "Unhandled server error" },
      { status: 500 }
    );
  }
}