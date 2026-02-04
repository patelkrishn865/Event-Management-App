import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

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

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => null);
    const qr_payload = body?.qr_payload;
    const event_id = body?.event_id;
    const device_info = body?.device_info ?? null;
    const today = new Date().toISOString().slice(0, 10);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const qrSecret = process.env.QR_SIGNING_SECRET;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !serviceRole || !qrSecret || !anonKey) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500, headers: CORS_HEADERS });
    }

    if (!qr_payload || typeof qr_payload !== "string") {
      return NextResponse.json({ error: "qr_payload required" }, { status: 400, headers: CORS_HEADERS });
    }

    if (!event_id || typeof event_id !== "string") {
      return NextResponse.json({ error: "event_id required" }, { status: 400, headers: CORS_HEADERS });
    }

    // ── Authentication ───────────────────────────────────────
    const authHeader = req.headers.get("authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Authorization header missing" }, { status: 401, headers: CORS_HEADERS });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let { data: { user }, error: authError } = await anonClient.auth.getUser();

    if (authError || !user) {
      const { data: refreshed, error: refreshErr } = await anonClient.auth.refreshSession();
      if (refreshErr || !refreshed?.user) {
        return NextResponse.json({ error: "Invalid or expired session" }, { status: 401, headers: CORS_HEADERS });
      }
      user = refreshed.user;
    }

    if (!user) {
      return NextResponse.json({ error: "Authentication failed" }, { status: 401, headers: CORS_HEADERS });
    }

    const adminClient = createClient(supabaseUrl, serviceRole);

    const { data: profile, error: profileErr } = await adminClient
      .from("profiles")
      .select("id, role")
      .eq("id", user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json({ error: "User profile not found" }, { status: 403, headers: CORS_HEADERS });
    }

    let isAllowed = false;

    if (profile.role === "admin" || profile.role === "organizer") {
      isAllowed = true;
    } else {
      const { data: staffAssignment } = await adminClient
        .from("event_staff")
        .select("event_id")
        .eq("event_id", event_id)
        .eq("user_id", user.id)
        .maybeSingle();

      isAllowed = !!staffAssignment;
    }

    if (!isAllowed) {
      return NextResponse.json(
        { error: "You are not authorized to check-in tickets for this event" },
        { status: 403, headers: CORS_HEADERS }
      );
    }

    const parts = qr_payload.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") {
      return NextResponse.json({ error: "Invalid QR code format" }, { status: 400, headers: CORS_HEADERS });
    }

    const ticketCode = parts[1];
    const providedSig = parts[2];

    const computedSig = await hmacSha256Hex(qrSecret, ticketCode);
    const expectedSig = computedSig.slice(0, 16);

    if (providedSig !== expectedSig) {
      return NextResponse.json({ error: "Invalid QR signature" }, { status: 400, headers: CORS_HEADERS });
    }

    const { data: ticket, error: ticketErr } = await adminClient
      .from("tickets")
      .select(`
        id, event_id, status, ticket_code, valid_for_date,
        ticket_type:ticket_types ( name ),
        order:orders ( 
          profile:profiles ( full_name )
        )
      `)
      .eq("ticket_code", ticketCode)
      .single();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404, headers: CORS_HEADERS });
    }

    const attendee_name = ticket.order?.profile?.full_name || "Guest";
    const ticket_tier = ticket.ticket_type?.name || "Standard";

    const fetchStats = async () => {
      const [{ count: total }, { count: used }] = await Promise.all([
        adminClient.from("tickets").select("*", { count: 'exact', head: true }).eq("event_id", ticket.event_id),
        adminClient.from("tickets").select("*", { count: 'exact', head: true }).eq("event_id", ticket.event_id).eq("status", "used")
      ]);
      return { total: total || 0, checked_in: used || 0 };
    };

    if (ticket.event_id !== event_id) {
      return NextResponse.json({ error: "Ticket belongs to a different event" }, { status: 400, headers: CORS_HEADERS });
    }

    if (!ticket.valid_for_date) {
      return NextResponse.json({ error: "Ticket has no valid date" }, { status: 400, headers: CORS_HEADERS });
    }

    if (today < ticket.valid_for_date) {
      return NextResponse.json(
        {
          ok: false,
          status: "not_valid_yet",
          valid_for_date: ticket.valid_for_date,
          message: "Ticket not valid yet",
          attendee_name,
          ticket_tier
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (today > ticket.valid_for_date) {
      return NextResponse.json(
        {
          ok: false,
          status: "expired",
          valid_for_date: ticket.valid_for_date,
          message: "Ticket expired",
          attendee_name,
          ticket_tier
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const { data: checkin } = await adminClient
      .from("ticket_checkins")
      .select("checked_in_at, checked_in_by")
      .eq("ticket_id", ticket.id)
      .maybeSingle();

    if (checkin) {
      const stats = await fetchStats();
      return NextResponse.json(
        {
          ok: false,
          status: "already_checked_in",
          checked_in_at: checkin.checked_in_at,
          checked_in_by: checkin.checked_in_by,
          attendee_name,
          ticket_tier,
          stats
        },
        { status: 200, headers: CORS_HEADERS }
      );
    }

    const { error: insertErr } = await adminClient.from("ticket_checkins").insert({
      ticket_id: ticket.id,
      event_id: ticket.event_id,
      checked_in_by: user.id,
      device_info: typeof device_info === "string" && device_info.length > 0 ? device_info : null,
    });

    if (insertErr) {
      if (insertErr.code === "23505") {
        const { data: lateCheckin } = await adminClient
          .from("ticket_checkins")
          .select("checked_in_at, checked_in_by")
          .eq("ticket_id", ticket.id)
          .maybeSingle();

        const stats = await fetchStats();
        return NextResponse.json(
          {
            ok: false,
            status: "already_checked_in",
            checked_in_at: lateCheckin?.checked_in_at ?? null,
            checked_in_by: lateCheckin?.checked_in_by ?? null,
            attendee_name,
            ticket_tier,
            stats
          },
          { status: 200, headers: CORS_HEADERS }
        );
      }

      return NextResponse.json({ error: "Failed to record check-in" }, { status: 500, headers: CORS_HEADERS });
    }

    await adminClient.from("tickets").update({ status: "used" }).eq("id", ticket.id);

    const stats = await fetchStats();
    return NextResponse.json(
      {
        ok: true,
        status: "checked_in",
        ticket_id: ticket.id,
        checked_in_by: user.id,
        attendee_name,
        ticket_tier,
        stats
      },
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: CORS_HEADERS });
  }
}