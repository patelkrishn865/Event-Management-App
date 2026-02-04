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
import { Skeleton } from "@/components/ui/skeleton";

import {
  ArrowLeft,
  Ban,
  CalendarDays,
  ExternalLink,
  RefreshCw,
  Search,
  Shield,
  Upload,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";

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

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return "—";
  }
}

function statusBadge(status) {
  if (status === "published") return <Badge>Published</Badge>;
  if (status === "draft") return <Badge variant="secondary">Draft</Badge>;
  if (status === "cancelled")
    return <Badge variant="destructive">Cancelled</Badge>;
  if (status === "completed") return <Badge variant="outline">Completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ── Skeleton for each event item (matches real card) ────────────────────────
function SkeletonEventItem() {
  return (
    <div className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:justify-between animate-pulse">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-48 bg-muted rounded-md" />
          <div className="h-5 w-24 bg-muted rounded-full" />
        </div>
        <div className="h-4 w-64 bg-muted rounded" />
        <div className="flex flex-wrap gap-3">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-28 bg-muted rounded-2xl" />
        <div className="h-9 w-28 bg-muted rounded-2xl" />
        <div className="h-9 w-28 bg-muted rounded-2xl" />
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: sessionWrap } = await supabase.auth.getSession();
    const user = sessionWrap?.session?.user;
    if (!user) return router.replace("/auth/login");

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (pErr || profile?.role !== "admin") {
      return router.replace("/dashboard");
    }

    const { data, error } = await supabase
      .from("events")
      .select(
        `
        id,
        title,
        status,
        location,
        starts_at,
        organizer:profiles!events_organizer_id_fkey(
        full_name,
        email
        )`
      )
      .order("created_at", { ascending: false });

    if (error) return setMsg(error.message);
    setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return events.filter((e) => {
      if (status !== "all" && e.status !== status) return false;
      if (!term) return true;
      return (
        e.title?.toLowerCase().includes(term) ||
        e.organizer?.email?.toLowerCase().includes(term)
      );
    });
  }, [events, q, status]);

  async function updateStatus(eventId, newStatus) {
    const { error } = await supabase
      .from("events")
      .update({ status: newStatus })
      .eq("id", eventId);
    if (error) return setMsg(error.message);
    load();
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
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <Button
                  variant="outline"
                  className="mb-3 rounded-2xl mr-3 bg-background/55"
                  onClick={() => router.push("/dashboard")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/60 px-3 py-2 text-sm">
                  <Shield className="h-4 w-4" />
                  <span className="font-medium">Admin Panel</span>
                </div>

                <h1 className="mt-4 text-3xl font-semibold">All Events</h1>
                <p className="text-sm text-muted-foreground">
                  Manage every event on the platform.
                </p>
              </div>

              <Button variant="outline" onClick={load}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </GlowBorder>

        {msg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        <GlowBorder>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 rounded-2xl"
                placeholder="Search event or organizer email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "published", "draft", "completed", "cancelled"].map((s) => (
                <Button
                  variant={status === s ? "default" : "outline"}
                  key={s}
                  className="rounded-2xl"
                  onClick={() => setStatus(s)}
                >
                  {s}
                </Button>
              ))}
            </div>
          </CardContent>
        </GlowBorder>

        <GlowBorder>
          <CardContent className="p-4 sm:p-6 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonEventItem key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                No events found
              </div>
            ) : (
              filtered.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{ev.title}</div>
                      {statusBadge(ev.status)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {ev.organizer?.full_name || "—"}
                      </span>
                      <span>{ev.organizer?.email}</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {fmtDate(ev.starts_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => router.push(`/events/${ev.id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Public
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() =>
                        router.push(`/dashboard/organizer/events/${ev.id}`)
                      }
                    >
                      Manage
                    </Button>
                    {ev.status !== "published" && (
                      <Button
                        className="rounded-2xl"
                        onClick={() => updateStatus(ev.id, "published")}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Publish
                      </Button>
                    )}
                    {ev.status !== "cancelled" && (
                      <Button
                        variant="destructive"
                        className="rounded-2xl"
                        onClick={() => updateStatus(ev.id, "cancelled")}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </GlowBorder>
      </div>
    </div>
  );
}