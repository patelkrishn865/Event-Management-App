"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  CalendarDays,
  LayoutDashboard,
  MapPin,
  Search,
  Ticket,
  ArrowRight,
} from "lucide-react";

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "-";
  }
}

function isUpcoming(startsAt) {
  if (!startsAt) return true;
  const t = new Date(startsAt).getTime();
  return Number.isFinite(t) ? t >= Date.now() - 5 * 60 * 1000 : true;
}

function Segmented({ value, onChange }) {
  return (
    <div className="inline-flex rounded-2xl border bg-background/60 backdrop-blur p-1">
      <button
        type="button"
        onClick={() => onChange("upcoming")}
        className={[
          "px-4 py-2 text-sm rounded-xl transition",
          value === "upcoming"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        Upcoming
      </button>
      <button
        type="button"
        onClick={() => onChange("all")}
        className={[
          "px-4 py-2 text-sm rounded-xl transition",
          value === "all"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        All
      </button>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-3xl border bg-card/70 overflow-hidden">
      <div className="h-48 bg-muted animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
        <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
        <div className="h-11 w-full bg-muted animate-pulse rounded-2xl" />
      </div>
    </div>
  );
}

/** A “gradient border” wrapper */
function GlowBorder({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-3xl p-px bg-linear-to-br",
        "from-primary/40 via-foreground/10 to-secondary/35",
        "shadow-sm hover:shadow-md transition",
        className,
      ].join(" ")}
    >
      <div className="rounded-3xl bg-card/80 backdrop-blur">{children}</div>
    </div>
  );
}

export default function EventsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState(null);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setIsAuthed(!!data?.session);
    }

    initAuth();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthed(!!session);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMsg(null);

      const { data, error } = await supabase
        .from("events")
        .select("id,title,location,starts_at,ends_at,status,banner_url")
        .eq("status", "published")
        .order("starts_at", { ascending: true });

      if (!mounted) return;

      if (error) setMsg(error.message);
      setEvents(data || []);
      setLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return (events || [])
      .filter((ev) => (filter === "upcoming" ? isUpcoming(ev.starts_at) : true))
      .filter((ev) => {
        if (!term) return true;
        const title = (ev.title || "").toLowerCase();
        const loc = (ev.location || "").toLowerCase();
        return title.includes(term) || loc.includes(term);
      });
  }, [events, q, filter]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-10 -right-40 h-140 w-140 rounded-full bg-secondary/18 blur-3xl" />
        <div className="absolute -bottom-55 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Hero */}
        <GlowBorder>
          <div className="p-6 sm:p-10 relative overflow-hidden">
            {/* subtle gradient overlay inside hero */}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  Explore • Tickets • QR Entry
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                  Events that feel
                  <span className="text-transparent bg-clip-text bg-linear-to-r from-primary to-secondary">
                    {" "}
                    premium
                  </span>
                  .
                </h1>

                <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                  Search, pick tickets, checkout, and keep everything in one place.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard")}
                >
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  Dashboard
                </Button>

                {isAuthed ? (
                  <Button
                    className="rounded-2xl"
                    onClick={() => router.push("/dashboard/attendee/tickets")}
                  >
                    <Ticket className="mr-2 h-4 w-4" />
                    My Tickets
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-2xl bg-background/55"
                    onClick={() => router.push("/auth/login")}
                  >
                    Login
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-2xl pl-9 bg-background/60"
                  placeholder="Search by name or location..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <Segmented value={filter} onChange={setFilter} />
            </div>
          </div>
        </GlowBorder>

        {msg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>  
        ) : filtered.length === 0 ? (
          <GlowBorder>
            <CardContent className="p-10 text-center space-y-3">
              <div className="text-xl font-semibold tracking-tight">
                No events found
              </div>
              <div className="text-sm text-muted-foreground">
                Try a different search or switch the filter.
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <Button variant="outline" className="rounded-2xl" onClick={() => setQ("")}>
                  Clear search
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => setFilter("all")}>
                  Show all
                </Button>
              </div>
            </CardContent>
          </GlowBorder>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ev) => (
              <GlowBorder key={ev.id} className="hover:shadow-lg transition-shadow duration-300">
                <div
                  className="group rounded-3xl overflow-hidden cursor-pointer bg-card/80 backdrop-blur-sm"
                  onClick={() => router.push(`/events/${ev.id}`)}
                >
                  <div className="relative h-48 w-full bg-muted overflow-hidden">
                    {ev.banner_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ev.banner_url}
                        alt={ev.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="h-full w-full bg-linear-to-br from-primary/15 via-background to-secondary/15" />
                    )}

                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/50 to-transparent pointer-events-none" />

                    <div className="absolute bottom-3 left-3 right-3 flex items-start justify-between gap-2 text-white">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                          {ev.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs drop-shadow-md">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{ev.location || "—"}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs drop-shadow-md">
                          <CalendarDays className="h-3.5 w-3.5" />
                          <span className="truncate">{formatDate(ev.starts_at)}</span>
                        </div>
                      </div>

                      <Badge className="rounded-full bg-white/20 text-white border-white/30 backdrop-blur-sm shadow-sm" variant="secondary">
                        {isUpcoming(ev.starts_at) ? "Upcoming" : "Past"}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 space-y-3 bg-card/90 backdrop-blur-sm">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="rounded-full">
                        {ev.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {ev.ends_at ? `Ends: ${formatDate(ev.ends_at)}` : "—"}
                      </span>
                    </div>

                    <Button className="w-full rounded-2xl">
                      View & Buy Tickets
                    </Button>
                  </div>
                </div>
              </GlowBorder>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
