"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

import {
  MessageSquare,
  Search,
  RefreshCw,
  Star,
  CalendarDays,
  ExternalLink,
  ArrowLeft,
} from "lucide-react";
import { GlowBorder } from "@/components/ui/glow-border";


function stars(n) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={[
            "h-4 w-4",
            i < n ? "fill-primary text-primary" : "text-muted-foreground",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

// ── Skeleton for each feedback item (matches real card) ─────────────────────
function SkeletonFeedbackItem() {
  return (
    <div className="rounded-2xl border bg-background/55 p-4 space-y-3 animate-pulse">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-5 w-48 bg-muted rounded-md" /> {/* event title */}
            <div className="h-5 w-24 bg-muted rounded-full" /> {/* rating stars */}
          </div>
          <div className="h-4 w-64 bg-muted rounded" /> {/* date */}
        </div>
        <div className="h-9 w-28 bg-muted rounded-2xl" /> {/* button */}
      </div>

      <div className="space-y-2">
        <div className="h-5 w-32 bg-muted rounded-md" /> {/* "Comment:" label */}
        <div className="h-10 w-full bg-muted rounded-md" /> {/* comment text */}
      </div>

      <div className="h-10 w-full bg-muted rounded-md" /> {/* suggestion text */}

      <Separator />

      <div className="h-9 w-40 bg-muted rounded-2xl" /> {/* event feedback button */}
    </div>
  );
}

export default function AdminFeedbackPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

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
      .from("event_feedback")
      .select(`
        id,
        rating,
        comments,
        suggestions,
        event:events ( id, title ),
        user:profiles ( id, full_name, role )
      `)
      .order("created_at", { ascending: false });

    if (error) setMsg(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return rows.filter((f) => {
      if (ratingFilter !== "all" && String(f.rating) !== ratingFilter)
        return false;
      if (!term) return true;
      return (
        f.comments?.toLowerCase().includes(term) ||
        f.suggestions?.toLowerCase().includes(term) ||
        f.event?.title?.toLowerCase().includes(term)
      );
    });
  }, [rows, q, ratingFilter]);

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
                  <MessageSquare className="h-4 w-4" />
                  <span className="font-medium">Admin Panel</span>
                </div>

                <h1 className="mt-4 text-3xl font-semibold">Feedback</h1>
                <p className="text-sm text-muted-foreground">
                  All feedback across all events.
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

        {/* Filters */}
        <GlowBorder>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 rounded-2xl"
                placeholder="Search comments, suggestions, event…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "5", "4", "3", "2", "1"].map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={ratingFilter === r ? "default" : "outline"}
                  className="rounded-2xl"
                  onClick={() => setRatingFilter(r)}
                >
                  {r === "all" ? "All ratings" : `${r}★`}
                </Button>
              ))}
            </div>
          </CardContent>
        </GlowBorder>

        <GlowBorder>
          <CardContent className="p-4 sm:p-6 space-y-4">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonFeedbackItem key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                No feedback found
              </div>
            ) : (
              filtered.map((f) => (
                <div
                  key={f.id}
                  className="rounded-2xl border bg-background/55 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {f.event?.title || "Event"}
                      </div>
                      <div className="text-sm font-medium text-primary/80">
                        By: {f.user?.full_name || "Anonymous / Deleted User"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <CalendarDays className="inline h-3.5 w-3.5 mr-1" />
                        {fmtDate(f.created_at)}
                      </div>
                    </div>
                    {stars(f.rating)}
                  </div>
                  {f.comments && (
                    <div className="text-sm">
                      <span className="font-medium">Comment:</span>{" "}
                      {f.comments}
                    </div>
                  )}
                  {f.suggestions && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium">Suggestion:</span>{" "}
                      {f.suggestions}
                    </div>
                  )}
                  <Separator />
                  <div className="flex flex-wrap gap-2 justify-between text-xs text-muted-foreground">
                    {f.event?.id && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() =>
                          router.push(
                            `/dashboard/organizer/events/${f.event.id}/feedback`
                          )
                        }
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Event feedback
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