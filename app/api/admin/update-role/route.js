import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req) {
    try {
        const { userId, role } = await req.json();

        if (!userId || !role) {
            return NextResponse.json({ error: "Missing userId or role" }, { status: 400 });
        }

        // ── Authentication & Authorization ──────────────────────────
        const authHeader = req.headers.get("authorization") || "";
        if (!authHeader.startsWith("Bearer ")) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length).trim();

        // Create a client with the user's token to verify their role
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });

        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: "Invalid session" }, { status: 401 });
        }

        // Check if the requester is an admin using a direct query (which should be allowed for self)
        const { data: requesterProfile, error: profileErr } = await supabaseAdmin
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();

        if (profileErr || requesterProfile?.role !== "admin") {
            return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
        }

        // ── Perform Update using Service Role ───────────────────────
        const { data, error: updateError } = await supabaseAdmin
            .from("profiles")
            .update({ role })
            .eq("id", userId)
            .select();

        if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        if (!data || data.length === 0) {
            return NextResponse.json({ error: "No rows updated" }, { status: 404 });
        }

        return NextResponse.json({ success: true, user: data[0] });
    } catch (err) {
        console.error("API Error:", err);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
