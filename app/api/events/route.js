import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from("events")
            .select(`
        id,
        title,
        location,
        starts_at,
        ends_at,
        status,
        banner_url,
        category,
        organizer:profiles!events_organizer_id_fkey(full_name),
        ticket_types!inner(id)
      `)
            .eq("status", "published")
            .eq("ticket_types.is_active", true)
            .order("starts_at", { ascending: true });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } catch (err) {
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
