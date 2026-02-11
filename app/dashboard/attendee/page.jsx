"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
    Ticket,
    QrCode,
    MessageSquare,
    ArrowRight,
    LogOut,
    LayoutDashboard,
    Sparkles,
    ExternalLink,
    Star,
    CalendarDays,
    MapPin,
    ShieldCheck,
    ScanLine,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { GlowBorder } from "@/components/ui/glow-border";


function StatCardSkeleton() {
    return (
        <div className="rounded-3xl border bg-background/55 p-4 animate-pulse">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 space-y-2">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-8 w-20 bg-muted rounded-md" />
                </div>
                <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center" />
            </div>
        </div>
    )
}

function StatCard({ icon: Icon, label, value, hint }) {
    return (
        <div className="rounded-3xl border bg-background/55 p-4 hover:border-primary/50 transition">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
                    {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
                </div>
                <div className="h-11 w-11 rounded-2xl border bg-background/70 flex items-center justify-center">
                    <Icon className="h-5 w-5" />
                </div>
            </div>
        </div>
    );
}

function ticketBadgeVariant(status) {
    if (status === "active") return "default";
    if (status === "used") return "secondary";
    return "outline";
}

function fmtDate(iso) {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleString();
    } catch {
        return "—";
    }
}

function starsText(rating) {
    const n = Math.max(0, Math.min(5, Number(rating || 0)));
    return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

export default function AttendeeDashboardPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);

    const [userEmail, setUserEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState(null);

    // Staff state
    const [staffAssignments, setStaffAssignments] = useState([]);

    // Attendee state
    const [attStats, setAttStats] = useState({
        ticketsTotal: 0,
        ticketsActive: 0,
        ticketsUsed: 0,
        feedbackTotal: 0,
    });
    const [recentTickets, setRecentTickets] = useState([]);
    const [recentFeedback, setRecentFeedback] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);

    useEffect(() => {
        let mounted = true;

        async function load() {
            setLoading(true);
            setMsg(null);

            const { data: sessionWrap } = await supabase.auth.getSession();
            const session = sessionWrap?.session;

            if (!session?.user) {
                router.replace("/auth/login");
                return;
            }

            const user = session.user;
            if (mounted) setUserEmail(user.email || "");

            const { data: profile, error: pErr } = await supabase
                .from("profiles")
                .select("role, full_name, avatar_url")
                .eq("id", user.id)
                .single();

            if (pErr) {
                if (mounted) setMsg(pErr.message);
                setLoading(false);
                return;
            }

            if (!mounted) return;

            setFullName(profile?.full_name || "");
            setAvatarUrl(profile?.avatar_url);

            try {
                // 1. Check if user is staff for any events
                const { data: staffData, error: staffErr } = await supabase
                    .from("event_staff")
                    .select(`
                        event_id,
                        staff_role,
                        created_at,
                        event:events (
                            id, title, location, starts_at, banner_url, status
                        )
                    `)
                    .eq("user_id", user.id);

                if (staffErr) throw staffErr;

                // Filter out invalid events if any
                const validAssignments = (staffData || [])
                    .map(s => ({ ...s, event: s.event })) // unpack
                    .filter(s => s.event); // ensure event exists

                if (mounted) setStaffAssignments(validAssignments);

                // 2. If Staff, we SKIP fetching attendee data? 
                // The requirement is "remove other unneccesary sections" for staff.
                // So if validAssignments.length > 0, we can skip the rest to optimize.
                if (validAssignments.length > 0) {
                    setLoading(false);
                    return;
                }

                // 3. If NOT staff, fetch attendee data
                const { data: tix, error: tErr } = await supabase
                    .from("tickets")
                    .select(
                        `
            id,status,created_at,qr_payload,ticket_code,
            events:events ( id,title,location,starts_at,banner_url ),
            ticket_type:ticket_types ( id,name,price_cents,currency ),
            order:orders!inner ( id,buyer_id )
          `
                    )
                    .eq("order.buyer_id", user.id)
                    .order("created_at", { ascending: false });

                if (tErr) throw tErr;

                const total = (tix || []).length;
                const active = (tix || []).filter((t) => t.status === "active").length;
                const used = (tix || []).filter((t) => t.status === "used").length;

                const [fCountRes, fbRes, upcomingRes] = await Promise.all([
                    supabase.from("event_feedback").select("id", { count: "exact", head: true }).eq("user_id", user.id),
                    supabase.from("event_feedback")
                        .select("id, rating, comments, suggestions, created_at, event_id, event:events ( id, title )")
                        .eq("user_id", user.id)
                        .order("created_at", { ascending: false })
                        .limit(5),
                    supabase.from("events")
                        .select("id, title, location, starts_at, banner_url, category, ticket_types!inner(id)")
                        .eq("status", "published")
                        .eq("ticket_types.is_active", true)
                        .gt("starts_at", new Date().toISOString())
                        .order("starts_at", { ascending: true })
                        .limit(4)
                ]);

                const feedbackTotal = fCountRes.error ? 0 : fCountRes.count || 0;

                if (mounted) {
                    setAttStats({
                        ticketsTotal: total,
                        ticketsActive: active,
                        ticketsUsed: used,
                        feedbackTotal,
                    });
                    setRecentTickets((tix || []).slice(0, 5));
                    setRecentFeedback(fbRes.error ? [] : fbRes.data || []);
                    setUpcomingEvents(upcomingRes.error ? [] : upcomingRes.data || []);
                }
            } catch (err) {
                if (mounted) setMsg(err?.message || String(err));
            }

            setLoading(false);
        }

        load();

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session?.user) router.replace("/auth/login");
        });

        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe?.();
        };
    }, [router]);

    async function logout() {
        await supabase.auth.signOut();
        router.replace("/auth/login");
    }

    if (loading) {
        return (
            <div className="min-h-screen relative overflow-hidden">
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl" />
                    <div className="absolute top-10 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl" />
                    <div className="absolute -bottom-60 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
                </div>
                <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
                    <div className="rounded-3xl border bg-card/80 p-6 backdrop-blur sm:p-8 animate-pulse">
                        <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                            <div className="space-y-3">
                                <div className="h-8 w-64 bg-muted rounded-lg" />
                                <div className="h-10 w-48 bg-muted rounded-lg" />
                            </div>
                        </div>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <StatCardSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // ── Staff View ───────────────────────────────────────────────────────────
    if (staffAssignments.length > 0) {
        return (
            <div className="min-h-screen relative overflow-hidden">
                {/* background blobs */}
                <div className="pointer-events-none absolute inset-0 -z-10">
                    <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl" />
                    <div className="absolute top-10 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl" />
                    <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
                </div>

                <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
                    {/* Header */}
                    <GlowBorder>
                        <CardContent className="p-6 sm:p-8 relative overflow-hidden">
                            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                                        <LayoutDashboard className="h-4 w-4" />
                                        <span className="font-medium">Dashboard</span>
                                        <span className="text-muted-foreground">•</span>
                                        <Badge className="rounded-full bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20">staff access</Badge>
                                        <span className="text-muted-foreground">•</span>
                                        <Badge className="rounded-full" variant="secondary">attendee</Badge>
                                    </div>

                                    <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                                        Staff Portal
                                    </h1>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                        {fullName ? `Welcome back, ${fullName}.` : "Welcome back."} Matches your assigned events.
                                    </p>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl bg-background/55"
                                        onClick={logout}
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Logout
                                    </Button>
                                    <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
                                        <AvatarImage src={avatarUrl} alt={fullName || "User"} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                                            {fullName?.[0]?.toUpperCase() || "U"}
                                        </AvatarFallback>
                                    </Avatar>
                                </div>
                            </div>
                        </CardContent>
                    </GlowBorder>

                    {msg && (
                        <Alert className="rounded-2xl">
                            <AlertDescription>{msg}</AlertDescription>
                        </Alert>
                    )}

                    {/* Assignments List */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold px-2">Assigned Events</h2>
                        <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                            {staffAssignments.map((assignment) => {
                                const ev = assignment.event;
                                return (
                                    <GlowBorder key={ev.id} className="group hover:shadow-2xl transition-all duration-300">
                                        <div className="rounded-3xl border bg-gradient-to-br from-card/95 via-card/90 to-card/95 backdrop-blur overflow-hidden flex flex-col h-full hover:scale-[1.02] transition-transform duration-300">
                                            {/* Banner with Gradient Overlay */}
                                            <div className="h-48 w-full bg-muted relative overflow-hidden">
                                                {ev.banner_url ? (
                                                    <>
                                                        <img
                                                            src={ev.banner_url}
                                                            alt={ev.title}
                                                            className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-500"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                                                    </>
                                                ) : (
                                                    <div className="h-full w-full bg-gradient-to-br from-primary/20 via-primary/10 to-secondary/20 flex items-center justify-center">
                                                        <ShieldCheck className="h-16 w-16 text-primary/40" />
                                                    </div>
                                                )}

                                                {/* Role Badge */}
                                                <div className="absolute top-4 right-4">
                                                    <Badge className="bg-amber-500/90 text-white border-0 backdrop-blur-md shadow-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide">
                                                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                                                        {assignment.staff_role}
                                                    </Badge>
                                                </div>

                                                {/* Status Indicator */}
                                                <div className="absolute top-4 left-4">
                                                    <div className="flex items-center gap-2 bg-background/90 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg">
                                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                                        <span className="text-xs font-medium">Active</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="p-6 flex-1 flex flex-col bg-gradient-to-b from-background/50 to-background/80">
                                                {/* Event Title */}
                                                <h3 className="text-xl font-bold line-clamp-2 mb-4 group-hover:text-primary transition-colors">
                                                    {ev.title}
                                                </h3>

                                                {/* Event Details */}
                                                <div className="space-y-3 mb-6 flex-1">
                                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border/50 hover:border-primary/50 transition-colors">
                                                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                            <MapPin className="h-4.5 w-4.5 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs text-muted-foreground font-medium mb-0.5">Location</div>
                                                            <div className="text-sm font-semibold truncate">{ev.location || "—"}</div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-start gap-3 p-3 rounded-xl bg-background/60 border border-border/50 hover:border-primary/50 transition-colors">
                                                        <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                                            <CalendarDays className="h-4.5 w-4.5 text-primary" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-xs text-muted-foreground font-medium mb-0.5">Event Date</div>
                                                            <div className="text-sm font-semibold">{fmtDate(ev.starts_at)}</div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action Button */}
                                                <Button
                                                    className="w-full rounded-2xl h-12 text-base font-semibold shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
                                                    size="lg"
                                                    onClick={() => router.push(`/staff/scan/${ev.id}`)}
                                                >
                                                    <ScanLine className="mr-2 h-5 w-5" />
                                                    Open Scanner
                                                </Button>
                                            </div>
                                        </div>
                                    </GlowBorder>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ── Attendee View ──────────────────────────────────────────────────────
    return (
        <div className="min-h-screen relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl" />
                <div className="absolute top-10 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl" />
                <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
            </div>

            <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
                {/* Header */}
                <GlowBorder>
                    <CardContent className="p-6 sm:p-8 relative overflow-hidden">
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                                    <LayoutDashboard className="h-4 w-4" />
                                    <span className="font-medium">Dashboard</span>
                                    <span className="text-muted-foreground">•</span>
                                    <Badge className="rounded-full" variant="secondary">attendee</Badge>
                                </div>

                                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                                    {fullName ? `Hi, ${fullName}` : "Hi there"}
                                </h1>
                                <p className="mt-2 text-sm text-muted-foreground">{userEmail}</p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button className="rounded-2xl" onClick={() => router.push("/dashboard/events")}>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Browse Events
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl bg-background/55"
                                        onClick={() => router.push("/dashboard/attendee/tickets")}
                                    >
                                        <Ticket className="mr-2 h-4 w-4" />
                                        My Tickets
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl bg-background/55"
                                        onClick={logout}
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        Logout
                                    </Button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <Button
                                    variant="ghost"
                                    className="relative h-10 w-10 rounded-full p-0 hover:bg-accent/50 transition"
                                    onClick={() => router.push("/dashboard/profile")}
                                >
                                    <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
                                        <AvatarImage src={avatarUrl} alt={fullName || "User"} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                                            {fullName?.[0]?.toUpperCase() || "U"}
                                        </AvatarFallback>
                                    </Avatar>
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </GlowBorder>

                {msg && (
                    <Alert className="rounded-2xl">
                        <AlertDescription>{msg}</AlertDescription>
                    </Alert>
                )}

                {/* Stats */}
                <GlowBorder>
                    <CardHeader className="pb-0">
                        <CardTitle className="text-xl py-5">Overview</CardTitle>
                        <CardDescription>Your activity</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard icon={Ticket} label="Total tickets" value={attStats.ticketsTotal} />
                            <StatCard icon={Ticket} label="Active" value={attStats.ticketsActive} />
                            <StatCard icon={QrCode} label="Used" value={attStats.ticketsUsed} />
                            <StatCard icon={MessageSquare} label="Feedback" value={attStats.feedbackTotal} hint="Submitted by you" />
                        </div>

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" />
                    </CardContent>
                </GlowBorder>

                {/* Upcoming Events */}
                <GlowBorder>
                    <CardHeader className="pb-0">
                        <CardTitle className="text-xl py-5">Upcoming Events</CardTitle>
                        <CardDescription>Don't miss out on these popular events.</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4">
                        {upcomingEvents.length === 0 ? (
                            <div className="rounded-3xl border bg-background/55 p-6 text-center">
                                <div className="text-sm font-medium">No upcoming events found</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Check back later for new events.
                                </div>
                                <Button className="mt-4 rounded-2xl" onClick={() => router.push("/dashboard/events")}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Browse All
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                {upcomingEvents.map((ev) => (
                                    <GlowBorder key={ev.id} className="hover:shadow-lg transition-shadow duration-300">
                                        <div
                                            className="group rounded-3xl overflow-hidden cursor-pointer bg-card/80 backdrop-blur-sm"
                                            onClick={() => router.push(`/dashboard/events/${ev.id}`)}
                                        >
                                            <div className="relative h-48 w-full bg-muted overflow-hidden">
                                                {ev.banner_url ? (
                                                    <img
                                                        src={ev.banner_url}
                                                        alt={ev.title}
                                                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full bg-linear-to-br from-primary/15 via-background to-secondary/15 flex items-center justify-center opacity-40">
                                                        <Ticket className="h-8 w-8 text-primary/40" />
                                                    </div>
                                                )}

                                                <div className="absolute top-3 right-3">
                                                    <Badge className="rounded-full bg-background/80 text-foreground border-white/20 backdrop-blur-md shadow-sm" variant="secondary">
                                                        Upcoming
                                                    </Badge>
                                                </div>
                                            </div>

                                            <div className="p-4 space-y-3 bg-card/90 backdrop-blur-sm">
                                                <div className="space-y-1">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="rounded-full text-[10px] uppercase font-bold">
                                                            {ev.category || "Others"}
                                                        </Badge>
                                                    </div>
                                                    <h3 className="text-base font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                                                        {ev.title}
                                                    </h3>
                                                </div>

                                                <div className="space-y-1.5 text-xs text-muted-foreground">
                                                    <div className="flex items-center gap-2">
                                                        <MapPin className="h-3.5 w-3.5 text-primary/60" />
                                                        <span className="truncate font-medium">{ev.location || "—"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <CalendarDays className="h-3.5 w-3.5 text-primary/60" />
                                                        <span className="truncate font-medium">{fmtDate(ev.starts_at)}</span>
                                                    </div>
                                                </div>

                                                <Button className="w-full rounded-2xl size-sm text-xs h-9">
                                                    View Event
                                                </Button>
                                            </div>
                                        </div>
                                    </GlowBorder>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </GlowBorder>

                {/* Recent Tickets */}
                <GlowBorder>
                    <CardHeader className="pb-0">
                        <CardTitle className="text-xl py-5">Recent tickets</CardTitle>
                        <CardDescription>Your latest purchases. Open tickets fast.</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-6">
                        {recentTickets.length === 0 ? (
                            <div className="rounded-3xl border bg-background/55 p-6 text-center">
                                <div className="text-sm font-medium">No tickets yet</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Browse events and purchase your first ticket.
                                </div>
                                <Button className="mt-4 rounded-2xl" onClick={() => router.push("/dashboard/events")}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Browse Events
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {recentTickets.map((t) => (
                                    <div
                                        key={t.id}
                                        className="rounded-3xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="font-semibold truncate">{t.events?.title || "Event"}</div>
                                                <Badge variant={ticketBadgeVariant(t.status)}>{t.status}</Badge>
                                                {t.ticket_type?.name && <Badge variant="secondary">{t.ticket_type.name}</Badge>}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {t.events?.location || "—"} • {fmtDate(t.events?.starts_at)}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/events/${t.events?.id || ""}`)} disabled={!t.events?.id}>
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Event
                                            </Button>
                                            <Button className="rounded-2xl" onClick={() => router.push("/dashboard/attendee/tickets")}>
                                                <QrCode className="mr-2 h-4 w-4" />
                                                Open Ticket
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </GlowBorder>

                {/* Recent Feedback */}
                <GlowBorder>
                    <CardHeader className="pb-0">
                        <CardTitle className="text-xl py-5">Recent Feedback</CardTitle>
                        <CardDescription>Your latest submissions</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-4">
                        {recentFeedback.length === 0 ? (
                            <div className="rounded-3xl border bg-background/55 p-6 text-center">
                                <div className="text-sm font-medium">No feedback yet</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    After you submit feedback for an event, it will appear here.
                                </div>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {recentFeedback.map((f) => (
                                    <div
                                        key={f.id}
                                        className="rounded-3xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant="secondary">
                                                    <span className="inline-flex items-center gap-1">
                                                        <Star className="h-4 w-4" />
                                                        {f.rating}/5
                                                    </span>
                                                </Badge>
                                                <div className="text-sm font-semibold truncate">{f.event?.title || "Event"}</div>
                                                <Badge variant="outline">{starsText(f.rating)}</Badge>
                                            </div>
                                            <div className="mt-2 text-xs text-muted-foreground">
                                                Submitted: {fmtDate(f.created_at)}
                                            </div>
                                            {f.comments && (
                                                <div className="mt-3 text-sm text-muted-foreground line-clamp-3">
                                                    <span className="font-medium text-foreground">Comments:</span> {f.comments}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/events/${f.event_id}`)}>
                                                <ExternalLink className="mr-2 h-4 w-4" />
                                                Event
                                            </Button>
                                            <Button className="rounded-2xl" onClick={() => router.push(`/dashboard/events/${f.event_id}/feedback`)}>
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                Feedback page
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </GlowBorder>
            </div>
        </div>
    );
}
