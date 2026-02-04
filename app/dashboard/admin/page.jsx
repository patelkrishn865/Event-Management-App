"use client";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowRight,
  CalendarDays,
  ExternalLink,
  LayoutDashboard,
  MessageSquare,
  QrCode,
  RefreshCcw,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { promise } from "zod";

function GlowBorder({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-3xl p-px bg-linear-to-br",
        "from-primary/45 via-foreground/10 to-secondary/40",
        "shadow-sm hover:shadow-md transition",
        className,
      ].join(" ")}
    >
      <div className="rounded-3xl bg-card/80 backdrop-blur">{children}</div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-3xl border bg-background/55 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">
            {value}
          </div>
          {hint ? (
            <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
          ) : null}
        </div>
        <div className="h-11 w-11 rounded-2xl border bg-background/70 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return "—";
  }
}

function statusBadgeVariant(status) {
  if (status === "published") return "default";
  if (status === "draft") return "secondary";
  if (status === "cancelled") return "destructive";
  if (status === "completed") return "outline";
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState("");
  const [stats, setStats] = useState({
    eventsTotal: 0,
    eventsPublished: 0,
    usersTotal: 0,
    ordersTotal: 0,
    ticketsTotal: 0,
    checkinsTotal: 0,
    feedbackTotal: 0,
  });
  const [recentEvents, setRecentEvents] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [recentFeedback, setRecentFeedback] = useState([]);

  const isAdmin = useMemo(() => role === "admin", [role]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setMsg(null);

      const { data: sessionWrap } = await supabase.auth.getSession();
      const session = sessionWrap?.session;
      if (!session.user) {
        router.replace("/auth/login");
        return;
      }
      const user = session.user;
      if (mounted) setUserEmail(user.email || "");
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role, full_name")
        .eq("id", user.id)
        .single();
      if (pErr) {
        if (mounted) setMsg(pErr.message);
        setLoading(false);
        return;
      }
      const r = profile?.role || "attendee";
      if (mounted) {
        setRole(r);
        setFullName(profile?.full_name || "");
      }
      if (r !== "admin") {
        router.replace("/dashboard");
        return;
      }
      try {
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
          supabase
            .from("events")
            .select("id", { count: "exact", head: true })
            .eq("status", "published"),
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true }),
          supabase.from("orders").select("id", { count: "exact", head: true }),
          supabase.from("tickets").select("id", { count: "exact", head: true }),
          supabase
            .from("ticket_checkins")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("event_feedback")
            .select("id", { count: "exact", head: true }),
        ]);
        const anyErr =
          evCountRes.error ||
          pubCountRes.error ||
          usersCountRes.error ||
          ordersCountRes.error ||
          ticketsCountRes.error ||
          checkinsCountRes.error ||
          feedbackCountRes.error;
        if (anyErr) throw anyErr;

        const [recentEventsRes, recentOrdersRes, recentFeedbackRes] =
          await Promise.all([
            supabase
              .from("events")
              .select(
                "id,title,location,starts_at,status,created_at,organizer_id"
              )
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("orders")
              .select(
                "id,event_id,buyer_name,buyer_email,amount_total_cents,currency,status,created_at"
              )
              .order("created_at", { ascending: false })
              .limit(5),
            supabase
              .from("event_feedback")
              .select("id,event_id,rating,comments,created_at,user_id")
              .order("created_at", { ascending: false })
              .limit(5),
          ]);
        if (recentEventsRes.error) throw recentEventsRes.error;
        if (recentOrdersRes.error) throw recentOrdersRes.error;
        if (recentFeedbackRes.error) throw recentFeedbackRes.error;

        if (!mounted) return;

        setStats({
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
      } catch (err) {
        if (mounted) setMsg(err?.message || String(err));
      }
      setLoading(false);
    }

    load();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session.user) router.replace("/auth/login");
    });

    return () => {
      mounted = false;
      sub?.subscription.unsubscribe?.();
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (loading) {
    return <div className="text-sm p-6 text-muted-foreground">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Not authorized.</div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute top-10 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl" />
        <div className="absolute -bottom-60 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        <GlowBorder>
          <CardContent className="p-6 sm:p-8 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="font-medium">Admin Panel</span>
                  <span className="text-muted-foreground">•</span>
                  <Badge className="rounded-full" variant="secondary">
                    admin
                  </Badge>
                </div>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  {fullName ? `Welcome, ${fullName}` : "Welcome"}
                </h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {userEmail}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    className="rounded-2xl"
                    onClick={() => router.push("/dashboard")}
                  >
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Main Dashboard
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl bg-background/55"
                    onClick={() => router.push("/events")}
                  >
                    <ExternalLink className=" mr-2 h-4 w-4" />
                    Public Events
                  </Button>
                  <Button
                    variant="outline"
                    className="rounded-2xl bg-background/55"
                    onClick={logout}
                  >
                    Logout
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload
                </Button>
                <Button
                  className="rounded-2xl"
                  onClick={() => router.push("/dashboard/admin/events")}
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Manage Everything
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

        <GlowBorder>
          <CardHeader className="pb-0">
            <CardTitle className="text-xl pt-6">Platform overview</CardTitle>
            <CardDescription>All key metrices in one place.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 pt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={CalendarDays}
                label="Events (total)"
                value={stats.eventsTotal}
              />
              <StatCard
                icon={Sparkles}
                label="Events (published)"
                value={stats.eventsPublished}
              />
              <StatCard icon={Users} label="Users" value={stats.usersTotal} />
              <StatCard
                icon={MessageSquare}
                label="Feedback"
                value={stats.feedbackTotal}
              />
              <StatCard
                icon={Ticket}
                label="Orders"
                value={stats.ordersTotal}
              />
              <StatCard
                icon={Ticket}
                label="Tickets"
                value={stats.ticketsTotal}
              />
              <StatCard
                icon={QrCode}
                label="Check-ins"
                value={stats.checkinsTotal}
              />
            </div>
            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ">
              <div>
                <div className="text-sm font-medium">Quick Actions</div>
                <div className="text-xs text-muted-foreground">
                  Jump straight into admin sections.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/admin/events")}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Events
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/admin/users")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Users
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/admin/orders")}
                >
                  <Ticket className="mr-2 h-4 w-4" />
                  Orders
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/admin/feedback")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Feedback
                </Button>
              </div>
            </div>
          </CardContent>
        </GlowBorder>

        <div className="grid gap-4 lg:grid-cols-3">
          <GlowBorder className="lg:col-span-1">
            <div className="p-6">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold tracking-tight">
                    Recent events
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last 5 created
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/admin/events")}
                >
                  <ArrowRight className="text-black h-4 w-4" />
                </Button>
              </div>
              <Separator className="my-4" />
              {recentEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No events yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="rouned-2xl border bg-background/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {ev.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {ev.location || "—"} • {fmtDate(ev.starts_at)}
                          </div>
                        </div>
                        <Badge
                          className="rounded-full"
                          variant={statusBadgeVariant(ev.status)}
                        >
                          {ev.status || "—"}
                        </Badge>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button
                          className="rounded-2xl"
                          onClick={() =>
                            router.push(`/dashboard/organizer/events/${ev.id}`)
                          }
                        >
                          Manage
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-2xl bg-background/55"
                          onClick={() => router.push(`/events/${ev.id}`)}
                        >
                          Public
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlowBorder>

          <GlowBorder className="lg:col-span-1">
            <div className="p-6">
              <div className="flex items-center justify-between gap-2">
              <div>
                  <div className="text-lg font-semibold tracking-tight">
                    Recent orders
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last 5 purchases
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/admin/orders")}
                >
                  <ArrowRight className="text-black h-4 w-4" />
                </Button>
              </div>
              <Separator className='my-4' />
              {recentOrders.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No orders yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((o) => (
                    <div
                      key={o.id}
                      className="rouned-2xl border bg-background/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">
                            {o.buyer_name || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 truncate">
                            {o.buyer_email || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {fmtDate(o.created_at)}
                          </div>
                        </div>
                        <Badge
                          className="rounded-full"
                          variant='secondary'
                        >
                          {o.status || "—"}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <Button
                          className="rounded-2xl"
                          onClick={() =>
                            router.push("/dashboard/admin/orders")
                          }
                        >
                          View order
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlowBorder>

          <GlowBorder className="lg:col-span-1">
            <div className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div>
                  <div className="text-lg font-semibold tracking-tight">
                    Recent feedback
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Last 5 ratings
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/admin/feedback")}
                >
                  <ArrowRight className="text-black h-4 w-4" />
                </Button>
              </div>
              <Separator className='my-4' />
              {recentFeedback.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No feedback yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {recentFeedback.map((rf) => (
                    <div
                      key={rf.id}
                      className="rouned-2xl border bg-background/55 p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-semibold">
                            Rating: <span className="text-foreground">{rf.rating}/5</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {fmtDate(rf.created_at)}
                          </div>
                        </div>
                        <Badge
                          className="rounded-full"
                          variant='outline'
                        >
                          event
                        </Badge>
                      </div>
                      {rf.comments ? (
                        <div className="mt-3 text-sm text-muted-foreground line-clamp-3">
                          {rf.comments}
                        </div>
                      ) : (
                        <div className="mt-3 text-sm text-muted-foreground">—</div>
                      )}
                      <div className="mt-3">
                        <Button
                          variant="outline"
                          className="rounded-2xl bg-background/55 w-full"
                          onClick={() =>
                            router.push("/dashboard/admin/feedback")
                          }
                        >
                          Open feedback
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </GlowBorder>
        </div>
      </div>
    </div>
  );
}
