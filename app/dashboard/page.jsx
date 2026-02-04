"use client";

import { useEffect, useMemo, useState } from "react";
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
  Sparkles,
  ExternalLink,
  ShieldCheck,
  IndianRupee,
  Star,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

function GlowBorder({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-3xl p-[1px] bg-gradient-to-br",
        "from-primary/45 via-foreground/10 to-secondary/40",
        "shadow-sm hover:shadow-md transition",
        className,
      ].join(" ")}
    >
      <div className="rounded-3xl bg-card/80 backdrop-blur">{children}</div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-3xl border bg-background/55 p-4 animate-pulse">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="h-4 w-32 bg-muted rounded"/>
          <div className="h-8 w-20 bg-muted rounded-md"/>
        </div>
        <div className="h-11 w-11 rounded-2xl bg-muted flex items-center justify-center"/>
      </div>
    </div>
  )
}

function RecentItemSkeleton() {
  return (
    <div className="rounded-3xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between animate-pulse">
      <div className="min-w-0 space-y-2">
        <div className="h-5 w-48 bg-muted rounded-md"/>
        <div className="h-4 w-64 bg-muted rounded"/>
      </div>
      <div className='flex flex-wrap gap-2'>
        <div className="h-9 w-28 bg-muted rounded-2xl"/>
        <div className="h-9 w-28 bg-muted rounded-2xl"/>
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

function rupees(paise) {
  return `₹ ${(Number(paise || 0) / 100).toFixed(2)}`;
}

function starsText(rating) {
  const n = Math.max(0, Math.min(5, Number(rating || 0)));
  return `${"★".repeat(n)}${"☆".repeat(5 - n)}`;
}

export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Organizer-specific stats (own events only)
  const [orgStats, setOrgStats] = useState({
    eventsTotal: 0,
    eventsPublished: 0,
    ticketsSold: 0,
    checkinsTotal: 0,
    feedbackTotal: 0,
  });

  // Attendee-specific stats (own tickets + feedback)
  const [attStats, setAttStats] = useState({
    ticketsTotal: 0,
    ticketsActive: 0,
    ticketsUsed: 0,
    feedbackTotal: 0,
  });

  // Admin/platform-wide stats
  const [adminStats, setAdminStats] = useState({
    eventsTotal: 0,
    eventsPublished: 0,
    usersTotal: 0,
    ordersTotal: 0,
    ticketsTotal: 0,
    checkinsTotal: 0,
    feedbackTotal: 0,
  });

  const [recentEvents, setRecentEvents] = useState([]);
  const [recentTickets, setRecentTickets] = useState([]);
  const [recentFeedback, setRecentFeedback] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]); // for admin only

  const isOrganizer = useMemo(() => role === "organizer", [role]);
  const isAdmin = useMemo(() => role === "admin", [role]);

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

      const r = profile?.role || "attendee";
      setRole(r);
      setFullName(profile?.full_name || "");
      setAvatarUrl(profile?.avatar_url);

      try {
        if (isAdmin) {
          // Admin: Platform-wide stats + recent data
          const [
            evCountRes,
            pubCountRes,
            usersCountRes,
            ordersCountRes,
            ticketsCountRes,
            checkinsCountRes,
            feedbackCountRes,
          ] = await Promise.all([
            supabase.from("events").select("id", { count: "exact", head: true }),
            supabase.from("events").select("id", { count: "exact", head: true }).eq("status", "published"),
            supabase.from("profiles").select("id", { count: "exact", head: true }),
            supabase.from("orders").select("id", { count: "exact", head: true }),
            supabase.from("tickets").select("id", { count: "exact", head: true }),
            supabase.from("ticket_checkins").select("id", { count: "exact", head: true }),
            supabase.from("event_feedback").select("id", { count: "exact", head: true }),
          ]);

          const anyErr =
            evCountRes.error || pubCountRes.error || usersCountRes.error ||
            ordersCountRes.error || ticketsCountRes.error || checkinsCountRes.error ||
            feedbackCountRes.error;

          if (anyErr) throw anyErr;

          const [recentEventsRes, recentOrdersRes, recentFeedbackRes] = await Promise.all([
            supabase
              .from("events")
              .select("id,title,location,starts_at,status,created_at,organizer_id")
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("orders")
              .select("id,buyer_name,buyer_email,amount_total_cents,currency,status,created_at")
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("event_feedback")
              .select("id,event_id,rating,comments,created_at,user_id,event:events(id,title)")
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
            });
            setRecentEvents(recentEventsRes.data || []);
            setRecentOrders(recentOrdersRes.data || []);
            setRecentFeedback(recentFeedbackRes.data || []);
          }
        } else if (isOrganizer) {
          // Organizer: own events only (your existing logic)
          const { data: events, error: eErr } = await supabase
            .from("events")
            .select("id,title,location,starts_at,status,created_at")
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
            const { count: tCount, error: tErr } = await supabase
              .from("tickets")
              .select("id", { count: "exact", head: true })
              .in("event_id", eventIds);
            if (tErr) throw tErr;
            ticketsSold = tCount || 0;

            const { count: cCount, error: cErr } = await supabase
              .from("ticket_checkins")
              .select("id", { count: "exact", head: true })
              .in("event_id", eventIds);
            if (cErr) throw cErr;
            checkinsTotal = cCount || 0;

            const { count: fCount, error: fErr } = await supabase
              .from("event_feedback")
              .select("id", { count: "exact", head: true })
              .in("event_id", eventIds);
            if (fErr) throw fErr;
            feedbackTotal = fCount || 0;

            const { data: fb, error: fbErr } = await supabase
              .from("event_feedback")
              .select("id, rating, comments, suggestions, created_at, event_id, event:events ( id, title )")
              .in("event_id", eventIds)
              .order("created_at", { ascending: false })
              .limit(5);
            if (!fbErr) recentFbRows = fb || [];
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
        } else {
          // Attendee: own tickets + feedback (your existing logic)
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

          const { count: fCount, error: fErr } = await supabase
            .from("event_feedback")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id);

          const feedbackTotal = fErr ? 0 : fCount || 0;

          const { data: fb, error: fbErr } = await supabase
            .from("event_feedback")
            .select("id, rating, comments, suggestions, created_at, event_id, event:events ( id, title )")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5);

          if (mounted) {
            setAttStats({
              ticketsTotal: total,
              ticketsActive: active,
              ticketsUsed: used,
              feedbackTotal,
            });
            setRecentTickets((tix || []).slice(0, 5));
            setRecentFeedback(fbErr ? [] : fb || []);
          }
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
  }, [router, isAdmin, isOrganizer]);

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
              <div className="h-8 w-64 bg-muted rouned-lg"/>
              <div className="h-10 w-48 bg-muted rouned-lg"/>
              <div className="h-5 w-72 bg-muted rouned"/>
              <div className="flex flex-wrap gap-2">
                <div className="h-10 w-32 bg-muted rouned-2xl"/>
                <div className="h-10 w-32 bg-muted rouned-2xl"/>
                <div className="h-10 w-32 bg-muted rouned-2xl"/>
              </div>
            </div>
            <div className="h-10 w-40 bg-muted rouned-2xl"/>
          </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map(( _, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <div className='rounded-3xl border bg-card/80 backdrop-blur p-6 animate-pulse'>
            <div className='flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center'>
              <div className="space-y-2">
                <div className="h-5 w-32 bg-muted rounded"/>
                <div className="h-4 w-64 bg-muted rounded"/>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map(( _, i) => (
                  <div key={i} className="h-10 w-32 bg-muted rounded-2xl"/>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-card/80 p-6 backdrop-blur border space-y-6 animate-pulse">
            <div className="space-y-2">
              <div className="h-7 w-48 bg-muted rouned"/>
              <div className="h-4 w-72 bg-muted rouned"/>
            </div>

            <div className="space-y-3">
              {Array.from({ length: 3 }).map(( _, i) => (
                <RecentItemSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const showAdminView = isAdmin;
  const showOrganizerView = isOrganizer && !isAdmin;
  const showAttendeeView = !isOrganizer && !isAdmin;

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute top-10 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl" />
        <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Header */}
        <GlowBorder>
          <CardContent className="p-6 sm:p-8 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="font-medium">Dashboard</span>
                  <span className="text-muted-foreground">•</span>
                  <Badge className="rounded-full" variant="secondary">
                    {role || "attendee"}
                  </Badge>
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  {fullName ? `Hi, ${fullName}` : "Hi there"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">{userEmail}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="rounded-2xl" onClick={() => router.push("/events")}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Browse Events
                  </Button>

                  {showOrganizerView && (
                    <Button
                      variant="outline"
                      className="rounded-2xl bg-background/55"
                      onClick={() => router.push("/dashboard/organizer/events")}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Manage Events
                    </Button>
                  )}

                  {showAttendeeView && (
                    <Button
                      variant="outline"
                      className="rounded-2xl bg-background/55"
                      onClick={() => router.push("/dashboard/attendee/tickets")}
                    >
                      <Ticket className="mr-2 h-4 w-4" />
                      My Tickets
                    </Button>
                  )}

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
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  <Button className="rounded-2xl" onClick={() => router.push("/dashboard/admin/events")}>
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Manage Everything
                  </Button>
                </div>
              )}

<Button
      variant="ghost"
      className="relative h-10 w-10 rounded-full p-0 hover:bg-accent/50 transition"
      onClick={() => router.push("/dashboard/profile")}
    >
      <Avatar className="h-10 w-10 border border-border/50 shadow-sm">
        <AvatarImage src={avatarUrl} alt={fullName || "User"} />
        <AvatarFallback
         className="bg-primary/10 text-primary text-lg font-medium">
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
            <CardDescription>
              {showAdminView
                ? "Platform-wide at a glance"
                : showOrganizerView
                ? "Your event performance"
                : "Your activity"}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {showAdminView ? (
                <>
                  <StatCard icon={CalendarDays} label="Events (total)" value={adminStats.eventsTotal} />
                  <StatCard icon={Sparkles} label="Events (published)" value={adminStats.eventsPublished} />
                  <StatCard icon={Users} label="Users" value={adminStats.usersTotal} />
                  <StatCard icon={MessageSquare} label="Feedback" value={adminStats.feedbackTotal} />
                  <StatCard icon={Ticket} label="Orders" value={adminStats.ordersTotal} />
                  <StatCard icon={Ticket} label="Tickets" value={adminStats.ticketsTotal} />
                  <StatCard icon={QrCode} label="Check-ins" value={adminStats.checkinsTotal} />
                </>
              ) : showOrganizerView ? (
                <>
                  <StatCard icon={CalendarDays} label="Total events" value={orgStats.eventsTotal} />
                  <StatCard icon={Plus} label="Published" value={orgStats.eventsPublished} />
                  <StatCard icon={Ticket} label="Tickets sold" value={orgStats.ticketsSold} />
                  <StatCard icon={QrCode} label="Check-ins" value={orgStats.checkinsTotal} />
                  <StatCard icon={MessageSquare} label="Feedback" value={orgStats.feedbackTotal} hint="Across your events" />
                </>
              ) : (
                <>
                  <StatCard icon={Ticket} label="Total tickets" value={attStats.ticketsTotal} />
                  <StatCard icon={Ticket} label="Active" value={attStats.ticketsActive} />
                  <StatCard icon={QrCode} label="Used" value={attStats.ticketsUsed} />
                  <StatCard icon={MessageSquare} label="Feedback" value={attStats.feedbackTotal} hint="Submitted by you" />
                </>
              )}
            </div>

            <Separator />

            {/* Quick actions */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-medium">Quick actions</div>
                <div className="text-xs text-muted-foreground">Jump fast without hunting menus.</div>
              </div>

              <div className="flex flex-wrap gap-2">
                {showAdminView ? (
                  <>
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
                  </>
                ) : showOrganizerView ? (
                  <>
                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/organizer/events")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Events
                    </Button>
                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/organizer/events")}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Event
                    </Button>
                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/events")}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Public Events
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/attendee/tickets")}>
                      <Ticket className="mr-2 h-4 w-4" />
                      My Tickets
                    </Button>
                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/events")}>
                      <ArrowRight className="mr-2 h-4 w-4" />
                      Buy Tickets
                    </Button>
                    <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push("/dashboard/attendee/tickets")}>
                      <QrCode className="mr-2 h-4 w-4" />
                      Show QR
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </GlowBorder>

        {/* Recent section - unified style for admin */}
        <GlowBorder>
          <CardHeader className="pb-0">
            <CardTitle className="text-xl py-5">
              {showAdminView ? "Recent activity" : showOrganizerView ? "Recent events" : "Recent tickets"}
            </CardTitle>
            <CardDescription>
              {showAdminView
                ? "Latest across the platform"
                : showOrganizerView
                ? "Your latest events. Manage them quickly."
                : "Your latest purchases. Open tickets fast."}
            </CardDescription>
          </CardHeader>

          <CardContent className="p-6 pt-4 space-y-6">
            {showAdminView ? (
              <div className="space-y-8">
                {/* Recent Events - same style as organizer */}
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
                              <div className="font-semibold truncate">{ev.event?.title || ev.title || "Untitled Event"}</div>
                              <Badge variant={statusBadgeVariant(ev.status)}>{ev.status}</Badge>
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {ev.location || "—"} • {fmtDate(ev.starts_at)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/events/${ev.id}`)}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Public
                            </Button>
                            <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/organizer/events/${ev.id}`)}>
                              Manage
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Recent Orders - same style */}
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

                {/* Recent Feedback - same style */}
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
                              {fmtDate(f.created_at)}
                            </div>
                            {f.comments && (
                              <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                                {f.comments}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/events/${f.event_id}`)}>
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
            ) : showOrganizerView ? (
              // Organizer recent events (original style)
              recentEvents.length === 0 ? (
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
                          <Badge variant={statusBadgeVariant(ev.status)}>{ev.status}</Badge>
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
                        <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/dashboard/organizer/events/${ev.id}/feedback`)}>
                          <MessageSquare className="mr-2 h-4 w-4" />
                          Feedback
                        </Button>
                        <Button className="rounded-2xl" onClick={() => router.push(`/staff/scan/${ev.id}`)}>
                          <QrCode className="mr-2 h-4 w-4" />
                          Scan
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Attendee recent tickets (original style)
              recentTickets.length === 0 ? (
                <div className="rounded-3xl border bg-background/55 p-6 text-center">
                  <div className="text-sm font-medium">No tickets yet</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Browse events and purchase your first ticket.
                  </div>
                  <Button className="mt-4 rounded-2xl" onClick={() => router.push("/events")}>
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
                        <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/events/${t.events?.id || ""}`)} disabled={!t.events?.id}>
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
              )
            )}
          </CardContent>
        </GlowBorder>

        {/* Recent Feedback - only for organizer and attendee */}
        {(showOrganizerView || showAttendeeView) && (
          <GlowBorder>
            <CardHeader className="pb-0">
              <CardTitle className="text-xl py-5">Recent Feedback</CardTitle>
              <CardDescription>
                {showOrganizerView ? "Latest on your events" : "Your latest submissions"}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6 pt-4 space-y-4">
              {recentFeedback.length === 0 ? (
                <div className="rounded-3xl border bg-background/55 p-6 text-center">
                  <div className="text-sm font-medium">No feedback yet</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {showOrganizerView
                      ? "Once attendees submit feedback, it will appear here."
                      : "After you submit feedback for an event, it will appear here."}
                  </div>
                  <Button className="mt-4 rounded-2xl" variant="outline" onClick={() => router.push("/events")}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Browse Events
                  </Button>
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
                        {f.suggestions && (
                          <div className="mt-2 text-sm text-muted-foreground line-clamp-3">
                            <span className="font-medium text-foreground">Suggestions:</span> {f.suggestions}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.push(`/events/${f.event_id}`)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Event
                        </Button>
                        {showOrganizerView ? (
                          <Button className="rounded-2xl" onClick={() => router.push(`/dashboard/organizer/events/${f.event_id}/feedback`)}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            View all
                          </Button>
                        ) : (
                          <Button className="rounded-2xl" onClick={() => router.push(`/events/${f.event_id}/feedback`)}>
                            <MessageSquare className="mr-2 h-4 w-4" />
                            Feedback page
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </GlowBorder>
        )}
      </div>
    </div>
  );
}