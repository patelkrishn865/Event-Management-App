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
    QrCode,
    MessageSquare,
    Plus,
    ArrowRight,
    LogOut,
    LayoutDashboard,
    ExternalLink,
    Star,
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

function statusBadgeVariant(status, isPast = false) {
    if (status === "published" && isPast) return "outline";
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

function starsText(rating) {
    const n = Math.max(0, Math.min(5, Number(rating || 0)));
    return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

export default function OrganizerDashboardPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState(null);

    const [userEmail, setUserEmail] = useState("");
    const [fullName, setFullName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState(null);

    const [orgStats, setOrgStats] = useState({
        eventsTotal: 0,
        eventsPublished: 0,
        ticketsSold: 0,
        checkinsTotal: 0,
        feedbackTotal: 0,
    });

    const [recentEvents, setRecentEvents] = useState([]);
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

            if (profile?.role !== "organizer") {
                router.replace("/dashboard");
                return;
            }

            if (!mounted) return;

            setFullName(profile?.full_name || "");
            setAvatarUrl(profile?.avatar_url);

            try {
                const { data: events, error: eErr } = await supabase
                    .from("events")
                    .select("id,title,location,starts_at,ends_at,status,created_at, event_staff(count)")
                    .eq("organizer_id", user.id)
                    .order("created_at", { ascending: false });

                if (eErr) throw eErr;

                const eventIds = (events || []).map((e) => e.id);
                const eventsTotal = eventIds.length;
                const eventsPublished = (events || []).filter((e) => e.status === "published").length;

                let ticketsSold = 0;
                let checkinsTotal = 0;
                let feedbackTotal = 0;
                let recentFbRows = [];

                if (eventIds.length > 0) {
                    const [tCountRes, cCountRes, fCountRes, fbRes] = await Promise.all([
                        supabase.from("tickets").select("id", { count: "exact", head: true }).in("event_id", eventIds),
                        supabase.from("ticket_checkins").select("id", { count: "exact", head: true }).in("event_id", eventIds),
                        supabase.from("event_feedback").select("id", { count: "exact", head: true }).in("event_id", eventIds),
                        supabase
                            .from("event_feedback")
                            .select("id, rating, comments, suggestions, created_at, event_id, event:events ( id, title ), user:profiles(id, full_name)")
                            .in("event_id", eventIds)
                            .order("created_at", { ascending: false })
                            .limit(5),
                    ]);

                    if (tCountRes.error) throw tCountRes.error;
                    if (cCountRes.error) throw cCountRes.error;
                    if (fCountRes.error) throw fCountRes.error;
                    if (fbRes.error) throw fbRes.error;

                    ticketsSold = tCountRes.count || 0;
                    checkinsTotal = cCountRes.count || 0;
                    feedbackTotal = fCountRes.count || 0;
                    recentFbRows = fbRes.data || [];
                }

                if (mounted) {
                    setOrgStats({
                        eventsTotal,
                        eventsPublished,
                        ticketsSold,
                        checkinsTotal,
                        feedbackTotal,
                    });
                    setRecentEvents((events || []).slice(0, 5));
                    setRecentFeedback(recentFbRows);
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
                    <CardContent className="p-6 sm:p-8 relative overflow-hidden">
                        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                                    <LayoutDashboard className="h-4 w-4" />
                                    <span className="font-medium">Organizer Dashboard</span>
                                    <span className="text-muted-foreground">•</span>
                                    <Badge className="rounded-full" variant="secondary">organizer</Badge>
                                </div>

                                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                                    {fullName ? `Hi, ${fullName}` : "Hi Organizer"}
                                </h1>
                                <p className="mt-2 text-sm text-muted-foreground">{userEmail}</p>

                                <div className="mt-4 flex flex-wrap gap-2">
                                    <Button className="rounded-2xl" onClick={() => router.push("/dashboard/events")}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Browse Events
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="rounded-2xl bg-background/55"
                                        onClick={() => router.push("/dashboard/organizer/events")}
                                    >
                                        <CalendarDays className="mr-2 h-4 w-4" />
                                        Manage Events
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
                                        <AvatarImage src={avatarUrl} alt={fullName || "Organizer"} />
                                        <AvatarFallback className="bg-primary/10 text-primary text-lg font-medium">
                                            {fullName?.[0]?.toUpperCase() || "O"}
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
                        <CardDescription>Your event performance</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-4">
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard icon={CalendarDays} label="Total events" value={orgStats.eventsTotal} />
                            <StatCard icon={Plus} label="Published" value={orgStats.eventsPublished} />
                            <StatCard icon={Ticket} label="Tickets sold" value={orgStats.ticketsSold} />
                            <StatCard icon={QrCode} label="Check-ins" value={orgStats.checkinsTotal} />
                            <StatCard icon={MessageSquare} label="Feedback" value={orgStats.feedbackTotal} hint="Across your events" />
                        </div>

                        <Separator />

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <div className="text-sm font-medium">Quick actions</div>
                                <div className="text-xs text-muted-foreground">Jump fast without hunting menus.</div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/organizer/events")}>
                                    <CalendarDays className="mr-2 h-4 w-4" />
                                    Events
                                </Button>
                                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/organizer/events")}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Event
                                </Button>
                                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/events")}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Public Events
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </GlowBorder>

                {/* Recent Events */}
                <GlowBorder>
                    <CardHeader className="pb-0">
                        <CardTitle className="text-xl py-5">Recent events</CardTitle>
                        <CardDescription>Your latest events. Manage them quickly.</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-6">
                        {recentEvents.length === 0 ? (
                            <div className="rounded-3xl border bg-background/55 p-6 text-center">
                                <div className="text-sm font-medium">No events yet</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Create your first event to start selling tickets.
                                </div>
                                <Button className="mt-4 rounded-2xl" onClick={() => router.push("/dashboard/organizer/events")}>
                                    <Plus className="mr-2 h-4 w-4" />
                                    Create Event
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {recentEvents.map((ev) => (
                                    <div
                                        key={ev.id}
                                        className="rounded-3xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <div className="font-semibold truncate">{ev.title}</div>
                                                {(() => {
                                                    const isPast = ev.ends_at
                                                        ? new Date(ev.ends_at) < new Date()
                                                        : ev.starts_at
                                                            ? new Date(ev.starts_at) < new Date()
                                                            : false;
                                                    const effectiveStatus = (ev.status === "published" && isPast) ? "completed" : ev.status;
                                                    return (
                                                        <Badge variant={statusBadgeVariant(ev.status, isPast)} className="rounded-full">
                                                            {effectiveStatus}
                                                        </Badge>
                                                    );
                                                })()}
                                            </div>
                                            <div className="mt-1 text-xs text-muted-foreground">
                                                {ev.location || "—"} • {fmtDate(ev.starts_at)}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/organizer/events/${ev.id}`)}>
                                                <ArrowRight className="mr-2 h-4 w-4" />
                                                Manage
                                            </Button>
                                            <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/organizer/events/${ev.id}/attendees`)}>
                                                <Users className="mr-2 h-4 w-4" />
                                                Attendees
                                            </Button>
                                            {ev.event_staff?.[0]?.count > 0 && (
                                                <Button className="rounded-2xl" onClick={() => router.push(`/staff/scan/${ev.id}`)}>
                                                    <QrCode className="mr-2 h-4 w-4" />
                                                    Scan
                                                </Button>
                                            )}
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
                        <CardDescription>Latest on your events</CardDescription>
                    </CardHeader>

                    <CardContent className="p-6 pt-4 space-y-4">
                        {recentFeedback.length === 0 ? (
                            <div className="rounded-3xl border bg-background/55 p-6 text-center">
                                <div className="text-sm font-medium">No feedback yet</div>
                                <div className="text-xs text-muted-foreground mt-1">
                                    Once attendees submit feedback, it will appear here.
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
                                                By: <span className="font-medium text-primary/80">{f.user?.full_name || "Anonymous / Attendee"}</span> • Submitted: {fmtDate(f.created_at)}
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
                                            <Button className="rounded-2xl" onClick={() => router.push(`/dashboard/organizer/events/${f.event_id}/feedback`)}>
                                                <MessageSquare className="mr-2 h-4 w-4" />
                                                View all
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
