"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { GlowBorder } from "@/components/ui/glow-border";

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

export default function EventsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [msg, setMsg] = useState(null);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [catFilter, setCatFilter] = useState("All");
  const [orgFilter, setOrgFilter] = useState("All");
  const [isAuthed, setIsAuthed] = useState(false);
  const [userRole, setUserRole] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      const session = data?.session;
      setIsAuthed(!!session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (mounted && profile) setUserRole(profile.role);
      }
    }

    initAuth();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setIsAuthed(!!session);
      if (session?.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (mounted && profile) setUserRole(profile.role);
      } else {
        setUserRole(null);
      }
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

      try {
        const res = await fetch("/api/events");
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch events");
        }
        const data = await res.json();

        if (!mounted) return;
        setEvents(data || []);
      } catch (err) {
        if (mounted) setMsg(err.message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
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
      .filter((ev) => (catFilter === "All" ? true : ev.category === catFilter))
      .filter((ev) => (orgFilter === "All" ? true : ev.organizer?.full_name === orgFilter))
      .filter((ev) => {
        if (!term) return true;
        const title = (ev.title || "").toLowerCase();
        const loc = (ev.location || "").toLowerCase();
        return title.includes(term) || loc.includes(term);
      });
  }, [events, q, filter, catFilter, orgFilter]);

  const categories = useMemo(() => {
    const set = new Set(events.map(e => e.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [events]);

  const organizers = useMemo(() => {
    const set = new Set(events.map(e => e.organizer?.full_name).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [events]);

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

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="max-w-2xl">
                <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/55 px-3 py-2 text-xs text-muted-foreground">
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => router.push("/dashboard")}>Dashboard</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="font-medium text-foreground">Events</span>
                  {userRole && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <Badge className="rounded-full" variant="secondary">{userRole}</Badge>
                    </>
                  )}
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
            <div className="relative mt-6 space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1 min-w-0">
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

              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Category:</span>
                  <select
                    value={catFilter}
                    onChange={(e) => setCatFilter(e.target.value)}
                    className="h-9 rounded-xl border bg-background/60 px-3 text-xs focus:outline-none"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Organizer:</span>
                  <select
                    value={orgFilter}
                    onChange={(e) => setOrgFilter(e.target.value)}
                    className="h-9 rounded-xl border bg-background/60 px-3 text-xs focus:outline-none"
                  >
                    {organizers.map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
              </div>
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
                  onClick={() => router.push(`/dashboard/events/${ev.id}`)}
                >
                  <div className="relative h-52 w-full bg-muted overflow-hidden">
                    {ev.banner_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={ev.banner_url}
                        alt={ev.title}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-linear-to-br from-primary/15 via-background to-secondary/15 flex items-center justify-center opacity-40">
                        <Ticket className="h-10 w-10 text-primary/40" />
                      </div>
                    )}

                    <div className="absolute top-3 right-3">
                      <Badge className="rounded-full bg-background/80 text-foreground border-white/20 backdrop-blur-md shadow-sm" variant="secondary">
                        {isUpcoming(ev.starts_at) ? "Upcoming" : "Past"}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-5 space-y-4 bg-card/90 backdrop-blur-sm">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="rounded-full text-[10px] uppercase font-bold tracking-tight">
                          {ev.category || "Others"}
                        </Badge>
                        {(() => {
                          const isPast = ev.ends_at
                            ? new Date(ev.ends_at) < new Date()
                            : ev.starts_at
                              ? new Date(ev.starts_at) < new Date()
                              : false;
                          const effectiveStatus = (ev.status === "published" && isPast) ? "completed" : ev.status;
                          return (
                            <Badge variant="secondary" className="rounded-full text-[10px] uppercase font-bold">
                              {effectiveStatus}
                            </Badge>
                          );
                        })()}
                      </div>

                      <h3 className="text-lg font-bold tracking-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                        {ev.title}
                      </h3>
                    </div>

                    <div className="space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary/60" />
                        <span className="truncate font-medium">{ev.location || "—"}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary/60" />
                        <span className="truncate font-medium">{formatDate(ev.starts_at)}</span>
                      </div>
                      <div className="pt-1 font-medium opacity-80">
                        By {ev.organizer?.full_name || "Unknown"}
                      </div>
                    </div>

                    <Button className="w-full rounded-2xl shadow-sm group-hover:shadow-md transition-all">
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
