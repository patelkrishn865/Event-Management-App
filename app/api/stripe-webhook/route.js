import Stripe from "stripe";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function randomCode(len = 24) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export const runtime = "nodejs";

export async function POST(req) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const qrSecret = process.env.QR_SIGNING_SECRET;

  if (!stripeKey || !webhookSecret || !qrSecret) {
    return new Response("Missing env vars", { status: 500 });
  }

  const stripe = new Stripe(stripeKey);

  const header = await headers();
  const sig = header.get("stripe-signature");
  if (!sig) return new Response("Missing stripe-signature", { status: 400 });

  const rawBody = await req.text();
  let event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    return new Response(`Webhook error: ${err.message}`, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ok", { status: 200 });
  }

  const session = event.data.object;
  const orderId = session?.metadata?.order_id;
  const eventId = session?.metadata?.event_id;
  const itemsJson = session?.metadata?.items;

  if (!orderId || !eventId || !itemsJson) {
    return new Response("ok", { status: 200 });
  }

  // Load basic order info
  const { data: order, error: orderErr } = await supabaseAdmin
    .from("orders")
    .select("id,event_id,status,buyer_id,buyer_name,buyer_email")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    return new Response("ok", { status: 200 });
  }

  // Idempotent: update only if still pending
  const { data: updated, error: uErr } = await supabaseAdmin
    .from("orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      provider_payment_id: session.payment_intent?.toString() ?? null,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (uErr) {
    return new Response("ok", { status: 200 });
  }

  if (!updated) {
    return new Response("ok", { status: 200 });
  }

  let items;
  try {
    items = JSON.parse(itemsJson);
  } catch {
    return new Response("ok", { status: 200 });
  }

  for (const it of items) {
    const { data: availability } = await supabaseAdmin
      .from("ticket_type_availability")
      .select("capacity, remaining, is_on_sale")
      .eq("id", it.ticket_type_id)
      .single();

    if (!availability?.is_on_sale) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "sales_closed" })
        .eq("id", orderId);
      return new Response("ok", { status: 200 });
    }

    if (availability.capacity !== 0 && availability.remaining < it.quantity) {
      await supabaseAdmin
        .from("orders")
        .update({ status: "overbooked" })
        .eq("id", orderId);
      return new Response("ok", { status: 200 });
    }

    const { data: tt } = await supabaseAdmin
      .from("ticket_types")
      .select("id,event_id,price_cents")
      .eq("id", it.ticket_type_id)
      .single();

    if (!tt) continue;

    const { data: oi } = await supabaseAdmin
      .from("order_items")
      .insert({
        order_id: orderId,
        ticket_type_id: tt.id,
        unit_price_cents: tt.price_cents,
        quantity: it.quantity,
      })
      .select("id")
      .single();

    if (!oi) continue;

    // Load order with event_day_id
    const { data: orderWithDay } = await supabaseAdmin
      .from("orders")
      .select("event_day_id, event_id, buyer_id, buyer_name, buyer_email")
      .eq("id", orderId)
      .single();

    if (!orderWithDay?.event_day_id) {
      return new Response("ok", { status: 200 });
    }

    const { data: day } = await supabaseAdmin
      .from("event_days")
      .select("day_date")
      .eq("id", orderWithDay.event_day_id)
      .single();

    if (!day?.day_date) {
      return new Response("ok", { status: 200 });
    }

    const validForDate = day.day_date;

    for (let n = 0; n < it.quantity; n++) {
      const ticketCode = randomCode(24);
      const sigHex = await hmacSha256Hex(qrSecret, ticketCode);
      const qrPayload = `v1.${ticketCode}.${sigHex.slice(0, 16)}`;

      await supabaseAdmin.from("tickets").insert({
        event_id: orderWithDay.event_id,
        event_day_id: orderWithDay.event_day_id,
        valid_for_date: validForDate,
        order_id: orderId,
        order_item_id: oi.id,
        attendee_id: orderWithDay.buyer_id,
        attendee_name: orderWithDay.buyer_name ?? null,
        attendee_email: orderWithDay.buyer_email ?? null,
        ticket_type_id: tt.id,
        ticket_code: ticketCode,
        qr_payload: qrPayload,
        status: "active",
      });
    }
  }

  return new Response("ok", { status: 200 });
}