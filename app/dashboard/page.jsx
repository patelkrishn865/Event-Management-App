"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardRedirect() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkRole() {
            setLoading(true);
            const { data: sessionWrap } = await supabase.auth.getSession();
            const session = sessionWrap?.session;

            if (!session?.user) {
                router.replace("/auth/login");
                return;
            }

            const { data: profile, error } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", session.user.id)
                .single();

            if (error || !profile) {
                console.error("Error fetching profile:", error);
                // Fallback to attendee if role unknown
                router.replace("/dashboard/attendee");
                return;
            }

            const role = profile.role || "attendee";

            if (role === "admin") {
                router.replace("/dashboard/admin");
            } else if (role === "organizer") {
                router.replace("/dashboard/organizer");
            } else {
                router.replace("/dashboard/attendee");
            }
        }

        checkRole();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                    <p className="text-sm text-muted-foreground font-medium">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    return null;
}
