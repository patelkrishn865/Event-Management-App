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
    CalendarDays,
    Ticket,
    Users,
    MessageSquare,
    ArrowRight,
    LogOut,
    LayoutDashboard,
    Sparkles,
    ExternalLink,
    IndianRupee,
    Star,
    QrCode,
    Percent,
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

function statusBadgeVariant(status) {
    if (status === "published") return "default";
    if (status === "draft") return "secondary";
    if (status === "cancelled") return "destructive";
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

function rupees(paise) {
    return `₹ ${(Number(paise || 0) / 100).toFixed(2)}`;
}

export default function AdminDashboardPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);

    const [userEmail, setUserEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState(null);

    const [adminStats, setAdminStats] = useState({
        eventsTotal: 0,
        eventsPublished: 0,
        usersTotal: 0,
        ordersTotal: 0,
        ticketsTotal: 0,
        checkinsTotal: 0,
        feedbackTotal: 0,
        successRatio: 0,
    });

    const [recentEvents, setRecentEvents] = useState([]);
    const [recentOrders, setRecentOrders] = useState([]);
    const [recentFeedback, setRecentFeedback] = useState([]);

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

            if (profile?.role !== "admin") {
                router.replace("/dashboard");
                return;
            }

            if (!mounted) return;

            setFullName(profile?.full_name || "");
            setAvatarUrl(profile?.avatar_url);

            try {
                const [
                    evCountRes,
                    pubCountRes,
                    usersCountRes,
                    ordersCountRes,
                    ticketsCountRes,
                    checkinsCountRes,
                    feedbackCountRes,
                    capRes,
                ] = await Promise.all([
                    supabase.from("events").select("id", { count: "exact", head: true }),
                    supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
                    supabase.from("profiles").select("id", { count: "exact", head: true }),
                    supabase.from("orders").select("id", { count: "exact", head: true }),
                    supabase.from("tickets").select("id", { count: "exact", head: true }),
                    supabase.from("ticket_checkins").select("id", { count: "exact", head: true }),
                    supabase.from("event_feedback").select("id", { count: "exact", head: true }),
                    supabase.from("ticket_types").select("capacity"),
                ]);

                const anyErr =
                    evCountRes.error || pubCountRes.error || usersCountRes.error ||
                    ordersCountRes.error || ticketsCountRes.error || checkinsCountRes.error ||
                    feedbackCountRes.error || capRes.error;

                if (anyErr) throw anyErr;

                const [recentEventsRes, recentOrdersRes, recentFeedbackRes] = await Promise.all([
                    supabase
                        .from("events")
                        .select("id,title,location,starts_at,status,created_at,organizer_id")
                        .neq("status", "cancelled")
                        .order("created_at", { ascending: false })
                        .limit(5),
                    supabase
                        .from("orders")
                        .select("id,buyer_name,buyer_email,amount_total_cents,currency,status,created_at")
                        .order("created_at", { ascending: false })
                        .limit(5),
                    supabase
                        .from("event_feedback")
                        .select("id,event_id,rating,comments,created_at,user_id,event:events(id,title),user:profiles(id,full_name)")
                        .order("created_at", { ascending: false })
                        .limit(5),
                ]);

                if (recentEventsRes.error) throw recentEventsRes.error;
                if (recentOrdersRes.error) throw recentOrdersRes.error;
                if (recentFeedbackRes.error) throw recentFeedbackRes.error;

                if (mounted) {
                    setAdminStats({
                        eventsTotal: evCountRes.count || 0,
                        eventsPublished: pubCountRes.count || 0,
                        usersTotal: usersCountRes.count || 0,
                        ordersTotal: ordersCountRes.count || 0,
                        ticketsTotal: ticketsCountRes.count || 0,
                        checkinsTotal: checkinsCountRes.count || 0,
                        feedbackTotal: feedbackCountRes.count || 0,
                        successRatio: 0,
                    });

                    // Calculate Success Ratio
                    const totalSold = ticketsCountRes.count || 0;
                    const totalCapacity = (capRes.data || []).reduce((sum, t) => sum + (t.capacity || 0), 0);
                    const ratio = totalCapacity > 0 ? (totalSold / totalCapacity) * 100 : 0;

                    setAdminStats(prev => ({ ...prev, successRatio: ratio.toFixed(1) }));

                    setRecentEvents(recentEventsRes.data || []);
                    setRecentOrders(recentOrdersRes.data || []);
                    setRecentFeedback(recentFeedbackRes.data || []);
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
                    <CardContent className="p-6 sm:p-8">
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                                    <LayoutDashboard className="h-4 w-4" />
                                    <span className="font-medium">Admin Dashboard</span>
                                    <span className="text-muted-foreground">•</span>
                                    <Badge className="rounded-full" variant="secondary">admin</Badge>
                                </div>

                                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                                    {fullName ? `Hi, ${fullName}` : "Hi Admin"}
                                </h1>
                                <p className="mt-2 text-sm text-muted-foreground">{userEmail}</p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button className="rounded-2xl" onClick={() => router.push("/dashboard/admin/events")}>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        All Events
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
                                <Button className="rounded-2xl" onClick={() => router.push("/dashboard/admin/events")}>
                                    <ArrowRight className="mr-2 h-4 w-4" />
                                    Manage Everything
                                </Button>
                                <Button
                                    variant="ghost"
                                    className="relative h-10 w-10 rounded-full p-0 hover:bg-accent/50 transition"
                                    onClick={() => router.push("/dashboard/profile")}
                                >
                                    <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
                                        <AvatarImage src={avatarUrl} alt={fullName || "Admin"} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                                            {fullName?.[0]?.toUpperCase() || "A"}
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
                        <CardTitle className="text-xl py-5">Platform Overview</CardTitle>
                        <CardDescription>Platform-wide at a glance</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard icon={CalendarDays} label="Events (total)" value={adminStats.eventsTotal} />
                            <StatCard icon={Sparkles} label="Events (published)" value={adminStats.eventsPublished} />
                            <StatCard icon={Users} label="Users" value={adminStats.usersTotal} />
                            <StatCard icon={MessageSquare} label="Feedback" value={adminStats.feedbackTotal} />
                            <StatCard icon={Ticket} label="Orders" value={adminStats.ordersTotal} />
                            <StatCard icon={Ticket} label="Tickets" value={adminStats.ticketsTotal} />
                            <StatCard icon={QrCode} label="Check-ins" value={adminStats.checkinsTotal} />
                            <StatCard icon={Percent} label="Success Ratio" value={`${adminStats.successRatio}%`} hint="Sold vs Capacity" />
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-medium">Quick actions</div>
                                <div className="text-xs text-muted-foreground">Jump fast without hunting menus.</div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/admin/events")}>
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    Events
                                </Button>
                                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/admin/users")}>
                                    <Users className="mr-2 h-4 w-4" />
                                    Users
                                </Button>
                                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/admin/orders")}>
                                    <Ticket className="mr-2 h-4 w-4" />
                                    Orders
                                </Button>
                                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/admin/feedback")}>
                                    <MessageSquare className="mr-2 h-4 w-4" />
                                    Feedback
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </GlowBorder>

                {/* Recent Activity */}
                <GlowBorder>
                    <CardHeader className="pb-0">
                        <CardTitle className="text-xl py-5">Recent activity</CardTitle>
                        <CardDescription>Latest across the platform</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-6">
                        <div className="space-y-8">
                            {/* Recent Events */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <CalendarDays className="h-5 w-5" /> Recent Events
                                </h3>
                                {recentEvents.length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-8 rounded-2xl border bg-background/40">
                                        No events created yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentEvents.map((ev) => (
                                            <div
                                                key={ev.id}
                                                className="rounded-3xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="font-semibold truncate">{ev.title || "Untitled Event"}</div>
                                                        <Badge variant={statusBadgeVariant(ev.status)}>{ev.status}</Badge>
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        {ev.location || "—"} • {fmtDate(ev.starts_at)}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/events/${ev.id}`)}>
                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                        Public
                                                    </Button>
                                                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/admin/events/${ev.id}`)}>
                                                        Manage
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Orders */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Ticket className="h-5 w-5" /> Recent Orders
                                </h3>
                                {recentOrders.length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-8 rounded-2xl border bg-background/40">
                                        No orders placed yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentOrders.map((o) => (
                                            <div
                                                key={o.id}
                                                className="rounded-3xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <div className="font-semibold truncate">
                                                        {o.buyer_name || "—"}
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        {o.buyer_email} • {fmtDate(o.created_at)}
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    <Badge variant="secondary" className="rounded-full">
                                                        <IndianRupee className="h-3.5 w-3.5 mr-1" />
                                                        {rupees(o.amount_total_cents)}
                                                    </Badge>
                                                    <Badge variant="outline">{o.status}</Badge>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Recent Feedback */}
                            <div className="space-y-4">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <MessageSquare className="h-5 w-5" /> Recent Feedback
                                </h3>
                                {recentFeedback.length === 0 ? (
                                    <div className="text-sm text-muted-foreground text-center py-8 rounded-2xl border bg-background/40">
                                        No feedback submitted yet.
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {recentFeedback.map((f) => (
                                            <div
                                                key={f.id}
                                                className="rounded-3xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <div className="font-semibold truncate">
                                                            {f.event?.title || "Event"}
                                                        </div>
                                                        <Badge variant="secondary">
                                                            <span className="inline-flex items-center gap-1">
                                                                <Star className="h-4 w-4" />
                                                                {f.rating}/5
                                                            </span>
                                                        </Badge>
                                                    </div>
                                                    <div className="mt-1 text-xs text-muted-foreground">
                                                        By: <span className="font-medium text-primary/80">{f.user?.full_name || "Anonymous"}</span> • {fmtDate(f.created_at)}
                                                    </div>
                                                    {f.comments && (
                                                        <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                                            {f.comments}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap gap-2">
                                                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/events/${f.event_id}`)}>
                                                        <ExternalLink className="mr-2 h-4 w-4" />
                                                        Event
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </GlowBorder>
            </div>
        </div>
    );
}
