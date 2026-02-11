"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  ArrowLeft,
  CalendarDays,
  Download,
  RefreshCw,
  Search,
  Star,
  MapPin,
  MessageSquare,
  X,
} from "lucide-react";
import { GlowBorder } from "@/components/ui/glow-border";


function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "-";
  }
}

function toCsv(rows) {
  const headers = ["rating", "comments", "suggestions", "user_id", "ticket_id", "created_at"];
  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const lines = [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))];
  return lines.join("\n");
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function Stars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value || 0)));
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={[
            "h-4 w-4",
            n <= v ? "text-primary fill-primary" : "text-muted-foreground/40",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

function ProgressRow({ label, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 text-xs text-muted-foreground">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary/80" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 text-right text-xs text-muted-foreground">
        {count} ({pct}%)
      </div>
    </div>
  );
}

export default function OrganizerFeedbackPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [event, setEvent] = useState(null);
  const [feedback, setFeedback] = useState([]);
  const [q, setQ] = useState("");

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      router.push("/auth/login");
      return;
    }

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id,title,starts_at,location,status")
      .eq("id", id)
      .single();

    if (evErr) {
      setMsg(evErr.message);
      setLoading(false);
      return;
    }
    setEvent(ev);

    const { data, error } = await supabase
      .from("event_feedback")
      .select("id,rating,comments,suggestions,user_id,ticket_id,created_at,user:profiles(id,full_name)")
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setFeedback(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return feedback;

    return feedback.filter((f) => {
      const c = (f.comments || "").toLowerCase();
      const s = (f.suggestions || "").toLowerCase();
      const r = String(f.rating || "");
      return c.includes(term) || s.includes(term) || r.includes(term);
    });
  }, [q, feedback]);

  const stats = useMemo(() => {
    const count = feedback.length;
    const avg =
      count === 0
        ? 0
        : feedback.reduce((sum, f) => sum + Number(f.rating || 0), 0) / count;

    const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const f of feedback) dist[f.rating] = (dist[f.rating] || 0) + 1;

    const top = count > 0 ? Math.round(((dist[5] + dist[4]) / count) * 100) : 0;

    return { count, avg, dist, top };
  }, [feedback]);

  function exportCsv() {
    const csvRows = filtered.map((f) => ({
      rating: f.rating,
      comments: f.comments || "",
      suggestions: f.suggestions || "",
      user_id: f.user_id || "",
      ticket_id: f.ticket_id || "",
      created_at: f.created_at ? new Date(f.created_at).toISOString() : "",
    }));

    const csv = toCsv(csvRows);
    const safeTitle = (event?.title || "event").replace(/[^\w\-]+/g, "_").slice(0, 40);
    downloadText(`feedback_${safeTitle}.csv`, csv);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute top-10 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl" />
        <div className="absolute -bottom-60 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Hero */}
        <GlowBorder>
          <CardContent className="p-6 sm:p-8 relative overflow-hidden">

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push(`/dashboard/organizer/events/${id}`)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight">Feedback</h1>

                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {event?.title || "Event"}
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {event?.location || "—"}
                  </span>

                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    {formatDate(event?.starts_at)}
                  </span>

                  {event?.status ? (
                    <Badge className="rounded-full" variant="secondary">
                      {event.status}
                    </Badge>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={load}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                <Button
                  className="rounded-2xl"
                  onClick={exportCsv}
                  disabled={filtered.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export CSV ({filtered.length})
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

        <div className="grid gap-4 lg:grid-cols-3">
          <GlowBorder>
            <CardContent className="p-6">
              <div className="text-xs text-muted-foreground">Responses</div>
              <div className="mt-2 text-3xl font-semibold">{stats.count}</div>
              <div className="mt-2 text-sm text-muted-foreground">
                Total feedback submitted
              </div>
            </CardContent>
          </GlowBorder>

          <GlowBorder>
            <CardContent className="p-6">
              <div className="text-xs text-muted-foreground">Average rating</div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <div className="text-3xl font-semibold">{stats.avg.toFixed(2)}</div>
                <Badge className="rounded-full" variant="secondary">
                  / 5
                </Badge>
              </div>
              <div className="mt-3">
                <Stars value={Math.round(stats.avg)} />
              </div>
            </CardContent>
          </GlowBorder>

          <GlowBorder>
            <CardContent className="p-6">
              <div className="text-xs text-muted-foreground">Positive rate</div>
              <div className="mt-2 text-3xl font-semibold">{stats.top}%</div>
              <div className="mt-2 text-sm text-muted-foreground">
                4★ and 5★ combined
              </div>
            </CardContent>
          </GlowBorder>
        </div>

        <GlowBorder>
          <div className="p-6 sm:p-8">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl">Rating distribution</CardTitle>
              <CardDescription>See how attendees rated this event.</CardDescription>
            </CardHeader>

            <CardContent className="p-0 space-y-3">
              <ProgressRow label="5★" count={stats.dist[5]} total={stats.count} />
              <ProgressRow label="4★" count={stats.dist[4]} total={stats.count} />
              <ProgressRow label="3★" count={stats.dist[3]} total={stats.count} />
              <ProgressRow label="2★" count={stats.dist[2]} total={stats.count} />
              <ProgressRow label="1★" count={stats.dist[1]} total={stats.count} />
            </CardContent>
          </div>
        </GlowBorder>

        {/* Table */}
        <GlowBorder>
          <div className="p-6 sm:p-8">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl">All feedback</CardTitle>
              <CardDescription>Search comments and suggestions.</CardDescription>
            </CardHeader>

            <CardContent className="p-0 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
                <div className="relative sm:max-w-md w-full">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="rounded-2xl pl-9 pr-10"
                    placeholder="Search by rating, comment text..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                  {q ? (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Badge className="rounded-full" variant="secondary">
                    Showing: {filtered.length}
                  </Badge>
                </div>
              </div>

              <Separator />

              {loading ? (
                <p className="text-sm text-muted-foreground">Loading feedback...</p>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border bg-background/55 p-6 text-center">
                  <div className="text-base font-semibold">No feedback yet</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Once attendees submit feedback, it will appear here.
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border overflow-hidden bg-background/55">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-36">Rating</TableHead>
                        <TableHead>Comments</TableHead>
                        <TableHead>Suggestions</TableHead>
                        <TableHead>Attendee</TableHead>
                        <TableHead className="w-56">Date</TableHead>
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {filtered.map((f) => (
                        <TableRow key={f.id} className="hover:bg-background/40">
                          <TableCell>
                            <div className="space-y-1">
                              <Badge className="rounded-full">{f.rating}/5</Badge>
                              <Stars value={f.rating} />
                            </div>
                          </TableCell>

                          <TableCell className="max-w-105">
                            <div className="text-sm whitespace-pre-wrap wrap-break-word">
                              {f.comments || <span className="text-muted-foreground">—</span>}
                            </div>
                          </TableCell>

                          <TableCell className="max-w-105">
                            <div className="text-sm whitespace-pre-wrap wrap-break-word">
                              {f.suggestions || <span className="text-muted-foreground">—</span>}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-sm font-medium">
                              {f.user?.full_name || "Unknown"}
                            </div>
                          </TableCell>

                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(f.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </div>
        </GlowBorder>
      </div>
    </div>
  );
}
