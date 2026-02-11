"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  Download,
  RefreshCw,
  Search,
  Users,
  UserCheck,
  Ticket as TicketIcon,
  MapPin,
  CalendarDays,
  BadgeCheck,
  Clock,
} from "lucide-react";
import { GlowBorder } from "@/components/ui/glow-border";

/* ---------- utils ---------- */

function toCsv(rows) {
  const headers = [
    "ticket_code",
    "ticket_status",
    "ticket_type",
    "unit_price_rupees",
    "buyer_name",
    "buyer_email",
    "buyer_phone",
    "checked_in_at",
    "checked_in_by",
    "issued_at",
  ];

  const escape = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => escape(r[h])).join(",")),
  ];

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

function formatMoneyINRPaise(paise) {
  const n = Number(paise || 0);
  return `₹ ${(n / 100).toFixed(2)}`;
}

function shortCode(code) {
  if (!code) return "—";
  if (code.length <= 12) return code;
  return `${code.slice(0, 6)}…${code.slice(-4)}`;
}

export default function OrganizerAttendeesPage() {
  const { id } = useParams(); // event id
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);

  const [event, setEvent] = useState(null);
  const [rows, setRows] = useState([]);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | used
  const [checkinFilter, setCheckinFilter] = useState("all"); // all | checked_in | not_checked_in

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
      .select("id,title,starts_at,location,status,banner_url")
      .eq("id", id)
      .single();

    if (evErr) {
      setMsg(evErr.message);
      setLoading(false);
      return;
    }
    setEvent(ev);

    const { data, error } = await supabase
      .from("tickets")
      .select(
        `
        id,
        ticket_code,
        status,
        issued_at,
        created_at,
        attendee_name,
        attendee_email,
        ticket_type:ticket_types ( id, name, price_cents, currency ),
        order:orders ( id, buyer_name, buyer_email, buyer_phone ),
        checkin:ticket_checkins ( checked_in_at, checked_in_by )
      `
      )
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return (rows || [])
      .filter((t) => {
        if (statusFilter === "all") return true;
        return (t.status || "") === statusFilter;
      })
      .filter((t) => {
        const checkedIn = !!t.checkin?.checked_in_at;
        if (checkinFilter === "all") return true;
        if (checkinFilter === "checked_in") return checkedIn;
        return !checkedIn;
      })
      .filter((t) => {
        if (!term) return true;
        const buyerName = t.order?.buyer_name || "";
        const buyerEmail = t.order?.buyer_email || "";
        const buyerPhone = t.order?.buyer_phone || "";
        const code = t.ticket_code || "";
        const typeName = t.ticket_type?.name || "";
        const attendeeName = t.attendee_name || "";
        const attendeeEmail = t.attendee_email || "";
        return (
          buyerName.toLowerCase().includes(term) ||
          buyerEmail.toLowerCase().includes(term) ||
          buyerPhone.toLowerCase().includes(term) ||
          code.toLowerCase().includes(term) ||
          typeName.toLowerCase().includes(term) ||
          attendeeName.toLowerCase().includes(term) ||
          attendeeEmail.toLowerCase().includes(term)
        );
      });
  }, [q, rows, statusFilter, checkinFilter]);

  const stats = useMemo(() => {
    const total = rows.length;
    const used = rows.filter((r) => r.status === "used").length;
    const active = rows.filter((r) => r.status === "active").length;
    const checkedIn = rows.filter((r) => !!r.checkin?.checked_in_at).length;
    const notCheckedIn = total - checkedIn;

    // revenue-ish estimate (unit price sum)
    const revenuePaise = rows.reduce((sum, r) => {
      const p = Number(r.ticket_type?.price_cents || 0);
      return sum + p;
    }, 0);

    return { total, used, active, checkedIn, notCheckedIn, revenuePaise };
  }, [rows]);

  function exportCsv() {
    const exportRows = filtered.map((t) => ({
      ticket_code: t.ticket_code,
      ticket_status: t.status,
      ticket_type: t.ticket_type?.name || "",
      unit_price_rupees: t.ticket_type?.price_cents
        ? (t.ticket_type.price_cents / 100).toFixed(2)
        : "",
      buyer_name: t.order?.buyer_name || "",
      buyer_email: t.order?.buyer_email || "",
      buyer_phone: t.order?.buyer_phone || "",
      checked_in_at: t.checkin?.checked_in_at
        ? new Date(t.checkin.checked_in_at).toISOString()
        : "",
      checked_in_by: t.checkin?.checked_in_by || "",
      issued_at: t.issued_at ? new Date(t.issued_at).toISOString() : "",
    }));

    const csv = toCsv(exportRows);
    const safeTitle = (event?.title || "event")
      .replace(/[^\w\-]+/g, "_")
      .slice(0, 40);

    downloadText(`attendees_${safeTitle}.csv`, csv);
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute top-10 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl" />
        <div className="absolute bottom-[-240px] left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* Header */}
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

                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  Attendees & Check-ins
                </h1>

                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  {event ? (
                    <>
                      <span className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {event.title}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="inline-flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {event.location || "—"}
                      </span>
                      <span className="hidden sm:inline">•</span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        {event.starts_at
                          ? new Date(event.starts_at).toLocaleString()
                          : "—"}
                      </span>
                    </>
                  ) : (
                    "Event details"
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full" variant="secondary">
                    Total: {stats.total}
                  </Badge>
                  <Badge className="rounded-full" variant="outline">
                    Active: {stats.active}
                  </Badge>
                  <Badge className="rounded-full" variant="outline">
                    Used: {stats.used}
                  </Badge>
                  <Badge className="rounded-full" variant="secondary">
                    Checked-in: {stats.checkedIn}
                  </Badge>
                  <Badge className="rounded-full" variant="secondary">
                    Revenue (est.): {formatMoneyINRPaise(stats.revenuePaise)}
                  </Badge>
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
                  Export ({filtered.length})
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

        {/* Controls */}
        <GlowBorder>
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative w-full lg:max-w-xl">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-2xl pl-9"
                  placeholder="Search by ticket, email, name, phone, ticket type…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  className="rounded-2xl"
                  variant={statusFilter === "all" ? "default" : "outline"}
                  onClick={() => setStatusFilter("all")}
                >
                  <TicketIcon className="mr-2 h-4 w-4" />
                  All
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl"
                  variant={statusFilter === "active" ? "default" : "outline"}
                  onClick={() => setStatusFilter("active")}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Active
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl"
                  variant={statusFilter === "used" ? "default" : "outline"}
                  onClick={() => setStatusFilter("used")}
                >
                  <BadgeCheck className="mr-2 h-4 w-4" />
                  Used
                </Button>

                <Separator className="hidden lg:block h-6 w-px" />

                <Button
                  type="button"
                  className="rounded-2xl"
                  variant={checkinFilter === "all" ? "secondary" : "outline"}
                  onClick={() => setCheckinFilter("all")}
                >
                  <Users className="mr-2 h-4 w-4" />
                  Any
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl"
                  variant={checkinFilter === "checked_in" ? "secondary" : "outline"}
                  onClick={() => setCheckinFilter("checked_in")}
                >
                  <UserCheck className="mr-2 h-4 w-4" />
                  Checked-in
                </Button>
                <Button
                  type="button"
                  className="rounded-2xl"
                  variant={checkinFilter === "not_checked_in" ? "secondary" : "outline"}
                  onClick={() => setCheckinFilter("not_checked_in")}
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Not yet
                </Button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="text-muted-foreground">
                Showing{" "}
                <span className="font-medium text-foreground">{filtered.length}</span>{" "}
                ticket{filtered.length === 1 ? "" : "s"}
              </div>

              {(q || statusFilter !== "all" || checkinFilter !== "all") && (
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    setQ("");
                    setStatusFilter("all");
                    setCheckinFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </CardContent>
        </GlowBorder>

        {/* Table */}
        <GlowBorder>
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold tracking-tight">Tickets</div>
                <div className="text-sm text-muted-foreground">
                  Buyer details, ticket type and check-in status.
                </div>
              </div>
            </div>

            <Separator className="my-4" />

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-16 rounded-2xl border bg-background/55 animate-pulse"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border bg-background/55 p-8 text-center">
                <div className="text-lg font-semibold">No tickets found</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Try a different search or clear filters.
                </div>
                <div className="mt-4 flex justify-center gap-2">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => {
                      setQ("");
                      setStatusFilter("all");
                      setCheckinFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                  <Button className="rounded-2xl" onClick={load}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reload
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border overflow-hidden bg-background/55">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Check-in</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {filtered.map((t) => {
                      const checkedInAt = t.checkin?.checked_in_at
                        ? new Date(t.checkin.checked_in_at)
                        : null;

                      const statusIsActive = t.status === "active";

                      return (
                        <TableRow key={t.id} className="hover:bg-background/40">
                          <TableCell className="align-top">
                            <div className="flex items-start gap-3">
                              <div
                                className={[
                                  "mt-1 h-8 w-8 rounded-2xl grid place-items-center border",
                                  checkedInAt
                                    ? "bg-secondary/40"
                                    : statusIsActive
                                      ? "bg-primary/10"
                                      : "bg-muted/50",
                                ].join(" ")}
                              >
                                {checkedInAt ? (
                                  <BadgeCheck className="h-4 w-4" />
                                ) : statusIsActive ? (
                                  <TicketIcon className="h-4 w-4" />
                                ) : (
                                  <Clock className="h-4 w-4" />
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="font-mono text-xs text-muted-foreground">
                                  {shortCode(t.ticket_code)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Issued:{" "}
                                  {t.issued_at
                                    ? new Date(t.issued_at).toLocaleString()
                                    : "—"}
                                </div>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="align-top">
                            <div className="font-medium">
                              {t.order?.buyer_name || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t.order?.buyer_email || "—"}
                            </div>
                            {t.order?.buyer_phone ? (
                              <div className="text-xs text-muted-foreground">
                                {t.order.buyer_phone}
                              </div>
                            ) : null}
                          </TableCell>

                          <TableCell className="align-top">
                            <div className="font-medium">
                              {t.ticket_type?.name || "—"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatMoneyINRPaise(t.ticket_type?.price_cents || 0)}
                            </div>
                          </TableCell>

                          <TableCell className="align-top">
                            <Badge
                              className="rounded-full"
                              variant={statusIsActive ? "default" : "secondary"}
                            >
                              {t.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="align-top">
                            {checkedInAt ? (
                              <div className="inline-flex items-center gap-2 text-sm">
                                <span className="text-green-500">●</span>
                                <span>{checkedInAt.toLocaleString()}</span>
                              </div>
                            ) : (
                              <div className="text-sm text-muted-foreground">—</div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </GlowBorder>
      </div>
    </div>
  );
}
