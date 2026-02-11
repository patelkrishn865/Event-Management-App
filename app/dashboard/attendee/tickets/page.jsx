"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { QRCodeCanvas } from "qrcode.react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { GlowBorder } from "@/components/ui/glow-border";

import {
  ArrowRight,
  CalendarDays,
  Copy,
  MapPin,
  Printer,
  Search,
  Ticket,
  CheckCircle2,
  CircleX,
  RotateCcw,
  RefreshCw,
  ArrowLeft,
} from "lucide-react";

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "-";
  }
}

function formatDateOnly(iso) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return null;
  }
}

function getValidityInfo(validForDate) {
  if (!validForDate) return null;

  const today = new Date().toISOString().slice(0, 10);
  const v = validForDate.slice(0, 10);

  if (v === today) {
    return { label: "Valid today", variant: "default" };
  }
  if (v > today) {
    return {
      label: `Valid on ${formatDateOnly(validForDate)}`,
      variant: "secondary",
    };
  }
  return { label: "Expired", variant: "destructive" };
}

function rupees(paise) {
  const n = Number(paise || 0) / 100;
  return `₹ ${n.toFixed(2)}`;
}


function statusBadge(status, validForDate) {
  const s = (status || "").toLowerCase();

  // If active but expired, don't show "Active"
  if (s === "active") {
    const info = getValidityInfo(validForDate);
    if (info?.label === "Expired") return null;

    return (
      <Badge className="rounded-full" variant="default">
        Active
      </Badge>
    );
  }
  if (s === "used") {
    return (
      <Badge className="rounded-full" variant="secondary">
        Used
      </Badge>
    );
  }
  if (s === "refunded") {
    return (
      <Badge className="rounded-full" variant="outline">
        Refunded
      </Badge>
    );
  }
  if (s === "cancelled") {
    return (
      <Badge className="rounded-full" variant="destructive">
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge className="rounded-full" variant="outline">
      {status || "—"}
    </Badge>
  );
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function MyTicketsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState(null);
  const [printingTicket, setPrintingTicket] = useState(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [toast]);

  async function load() {
    setLoading(true);
    setMsg(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;

    if (!user) {
      router.push("/auth/login");
      return;
    }

    // 1) Load tickets (NO nested checkins)
    const { data, error } = await supabase
      .from("tickets")
      .select(
        `
        id,status,qr_payload,ticket_code,created_at,valid_for_date,
        events:events ( id,title,location,starts_at ),
        ticket_type:ticket_types ( id,name,price_cents,currency ),
        order:orders!inner ( id,buyer_id )
      `
      )
      .eq("order.buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setTickets([]);
      setLoading(false);
      return;
    }

    const baseTickets = data || [];

    // 2) Fetch checkins in one call and merge
    try {
      const ticketIds = baseTickets.map((t) => t.id).filter(Boolean);

      if (ticketIds.length === 0) {
        setTickets([]);
        setLoading(false);
        return;
      }

      const { data: checkins, error: cErr } = await supabase
        .from("ticket_checkins")
        .select("ticket_id, checked_in_at")
        .in("ticket_id", ticketIds);

      if (cErr) throw cErr;

      const latestByTicket = new Map();
      for (const c of checkins || []) {
        const prev = latestByTicket.get(c.ticket_id);
        if (!prev) {
          latestByTicket.set(c.ticket_id, c.checked_in_at);
        } else {
          const prevT = new Date(prev).getTime();
          const curT = new Date(c.checked_in_at).getTime();
          if (
            Number.isFinite(curT) &&
            (!Number.isFinite(prevT) || curT > prevT)
          ) {
            latestByTicket.set(c.ticket_id, c.checked_in_at);
          }
        }
      }

      const merged = baseTickets.map((t) => ({
        ...t,
        checked_in_at: latestByTicket.get(t.id) || null,
      }));

      setTickets(merged);
    } catch (e) {
      // Even if checkins fail, still show tickets
      setTickets(baseTickets);
      setMsg(
        (prev) => prev || `Check-ins load failed: ${e?.message || String(e)}`
      );
    }

    setLoading(false);
  }

  function handlePrintTicket(ticket) {
    setPrintingTicket(ticket);
    // Give more time for the print view to render
    setTimeout(() => {
      window.print();
      setPrintingTicket(null);
    }, 500);
  }

  useEffect(() => {
    load();
  }, [router]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return tickets;

    return (tickets || []).filter((t) => {
      const title = (t?.events?.title || "").toLowerCase();
      const loc = (t?.events?.location || "").toLowerCase();
      const code = (t?.ticket_code || "").toLowerCase();
      const type = (t?.ticket_type?.name || "").toLowerCase();
      return (
        title.includes(term) ||
        loc.includes(term) ||
        code.includes(term) ||
        type.includes(term)
      );
    });
  }, [tickets, q]);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* background blobs */}
      <div className={cn("pointer-events-none absolute inset-0 -z-10", printingTicket && "no-print")}>
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-10 -right-40 h-140 w-140 rounded-full bg-secondary/18 blur-3xl" />
        <div className="absolute -bottom-55 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className={cn("mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6", printingTicket && "no-print")}>
        {/* Header */}
        <GlowBorder>
          <CardContent className="p-6 sm:p-10 relative overflow-hidden">
            <div className={cn("relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between", printingTicket && "no-print")}>
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                  <Ticket className="h-3.5 w-3.5" />
                  Tickets & QR passes
                </div>

                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  My Tickets
                </h1>

                <p className="mt-2 text-sm text-muted-foreground">
                  View your purchased tickets, QR codes, and check-in status.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55 no-print"
                  onClick={() => router.push("/dashboard/events")}
                >
                  <ArrowLeft className="ml-2 h-4 w-4" />
                  Browse Events
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55 no-print"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55 no-print"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save
                </Button>
              </div>
            </div>

            <div className={cn("relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", (printingTicket) && "no-print")}>
              <div className="relative w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-2xl pl-9 bg-background/60"
                  placeholder="Search by event, location, ticket type, or code..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                {loading ? "Loading..." : `${filtered.length} ticket(s)`}
              </div>
            </div>
          </CardContent>
        </GlowBorder>

        {/* toast */}
        {toast ? (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
            <div className="rounded-2xl border bg-background/80 backdrop-blur px-4 py-2 text-sm shadow-lg">
              {toast}
            </div>
          </div>
        ) : null}

        {msg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        {/* Content */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border bg-card/70 overflow-hidden"
              >
                <div className="h-44 bg-muted animate-pulse" />
                <div className="p-4 space-y-3">
                  <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
                  <div className="h-3 w-2/3 bg-muted animate-pulse rounded" />
                  <div className="h-10 w-full bg-muted animate-pulse rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlowBorder>
            <CardContent className="p-10 text-center space-y-3">
              <div className="text-xl font-semibold tracking-tight">
                No tickets found
              </div>
              <div className="text-sm text-muted-foreground">
                Buy a ticket from the Events page and it will show up here.
              </div>
              <div className="pt-2 flex justify-center gap-2 flex-wrap">
                <Button
                  className="rounded-2xl"
                  onClick={() => router.push("/dashboard/events")}
                >
                  Browse Events
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setQ("")}
                >
                  Clear search
                </Button>
              </div>
            </CardContent>
          </GlowBorder>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => {
              const title = t?.events?.title || "Event";
              const location = t?.events?.location || "—";
              const startsAt = t?.events?.starts_at;
              const typeName = t?.ticket_type?.name || "Ticket";
              const price = t?.ticket_type?.price_cents || 0;
              const code = t?.ticket_code || "";
              const qr = t?.qr_payload || "";
              const status = (t?.status || "").toLowerCase();

              const checkedAt = t?.checked_in_at || null;

              return (
                <GlowBorder key={t.id} className="hover:shadow-lg">
                  <div className="rounded-3xl overflow-hidden">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold tracking-tight">
                            {title}
                          </div>

                          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{location}</span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                              <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">
                                {formatDate(startsAt)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {statusBadge(status, t.valid_for_date)}

                          {t.valid_for_date && (
                            <Badge
                              variant={
                                getValidityInfo(t.valid_for_date)?.variant
                              }
                              className="rounded-full text-[11px]"
                            >
                              {getValidityInfo(t.valid_for_date)?.label}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator className="my-4" />

                      <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="text-sm min-w-0">
                          <div className="font-medium truncate">{typeName}</div>
                          <div className="text-xs text-muted-foreground">
                            {rupees(price)}
                          </div>
                        </div>

                        {status === "used" ? (
                          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                            <CheckCircle2 className="h-4 w-4" />
                            Checked in
                          </div>
                        ) : status === "refunded" ? (
                          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                            <RotateCcw className="h-4 w-4" />
                            Refunded
                          </div>
                        ) : status === "cancelled" ? (
                          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                            <CircleX className="h-4 w-4" />
                            Cancelled
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                            <Ticket className="h-4 w-4" />
                            Ready
                          </div>
                        )}
                      </div>

                      <div className="mt-4">
                        {status === "used" ? (
                          <div className="rounded-2xl border bg-background/60 p-4">
                            <div className="text-sm font-semibold">
                              Checked in ✅
                            </div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {checkedAt
                                ? `At: ${formatDate(checkedAt)}`
                                : "Time not available"}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-2xl border bg-white p-3 flex justify-center">
                            <div className="w-full max-w-55 flex justify-center">
                              <QRCodeCanvas value={qr} size={170} />
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        {code ? (
                          <div className="rounded-2xl border bg-background/60 px-3 py-2">
                            <div className="text-[11px] text-muted-foreground">
                              Ticket code
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2 min-w-0">
                              <div className="text-sm font-mono truncate min-w-0">
                                {code}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-xl shrink-0"
                                onClick={async () => {
                                  const ok = await copyText(code);
                                  setToast(
                                    ok ? "Copied ticket code" : "Copy failed"
                                  );
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {status !== "used" && qr ? (
                          <div className="rounded-2xl border bg-background/60 px-3 py-2 w-full">
                            <div className="text-[11px] text-muted-foreground">
                              QR payload
                            </div>
                            <div className="mt-0.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 min-w-0">
                              <div className="text-xs font-mono truncate min-w-0">
                                {qr}
                              </div>
                              <Button
                                type="button"
                                variant="outline"
                                className="h-9 rounded-xl shrink-0"
                                onClick={async () => {
                                  const ok = await copyText(qr);
                                  setToast(
                                    ok ? "Copied QR payload" : "Copy failed"
                                  );
                                }}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ) : null}

                        {t.valid_for_date && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            🎫 Valid for:{" "}
                            <span className="font-medium text-foreground">
                              {formatDateOnly(t.valid_for_date)}
                            </span>
                          </div>
                        )}

                        {t?.created_at ? (
                          <div className="text-xs text-muted-foreground">
                            Purchased: {formatDate(t.created_at)}
                          </div>
                        ) : null}
                      </div>

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        <Button
                          className="rounded-2xl"
                          onClick={() =>
                            router.push(`/dashboard/events/${t?.events?.id}`)
                          }
                        >
                          View Event
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() =>
                            router.push(`/dashboard/events/${t?.events?.id}/feedback`)
                          }
                        >
                          Feedback
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-2xl border-primary/20 text-primary hover:bg-primary/5"
                          onClick={() => handlePrintTicket(t)}
                        >
                          <Printer className="mr-2 h-4 w-4" />
                          Print
                        </Button>
                      </div>
                    </div>
                  </div>
                </GlowBorder>
              );
            })}
          </div>
        )}
      </div>

      {/* ── PRINT-ONLY COMPONENT ───────────────────────────── */}
      {printingTicket && (
        <div className="print-only block bg-white text-black min-h-screen p-4 sm:p-10">
          <div className="max-w-3xl mx-auto border-[3px] border-black rounded-xl overflow-hidden bg-white shadow-none">
            {/* Ticket Header */}
            <div className="bg-black text-white p-6 flex justify-between items-center px-10">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter">
                  Entry Pass
                </h1>
                <p className="text-sm opacity-80 font-medium">Official Event Ticket</p>
              </div>
              <div className="text-right">
                <Ticket className="h-10 w-10 opacity-50" />
              </div>
            </div>

            <div className="p-8 sm:p-10 space-y-8">
              {/* Event Info */}
              <div className="space-y-4">
                <h2 className="text-4xl font-bold tracking-tight text-black">
                  {printingTicket.events?.title}
                </h2>

                <div className="grid grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Date & Time</p>
                    <p className="text-lg font-semibold">{formatDate(printingTicket.events?.starts_at)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Venue</p>
                    <p className="text-lg font-semibold">{printingTicket.events?.location || "TBA"}</p>
                  </div>
                </div>
              </div>

              {/* Passenger/Attendee Section (Simulated Boarding Pass style) */}
              <div className="bg-gray-50 rounded-lg p-6 grid grid-cols-2 gap-8 border border-gray-100">
                <div>
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Ticket Type</p>
                  <p className="text-xl font-bold text-primary">{printingTicket.ticket_type?.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{rupees(printingTicket.ticket_type?.price_cents)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest">Ticket Code</p>
                  <p className="text-xl font-mono font-bold">{printingTicket.ticket_code}</p>
                </div>
              </div>

              {/* QR Code Section */}
              <div className="flex flex-col items-center justify-center pt-6 space-y-6">
                <div className="p-6 border-4 border-black rounded-2xl bg-white inline-block">
                  <QRCodeCanvas
                    value={printingTicket.qr_payload || ""}
                    size={240}
                    level="Q"
                    includeMargin={true}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold uppercase tracking-widest">Scan at the entrance</p>
                  <p className="text-xs text-gray-400">Electronic validation required for entry</p>
                </div>
              </div>
            </div>

            {/* Footer with small print */}
            <div className="border-t-2 border-dashed border-gray-200 p-8 pt-6 mt-4">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-[9px] text-gray-400">Purchased on: {formatDate(printingTicket.created_at)}</p>
                  <p className="text-[9px] text-gray-400">Order ID: {printingTicket.order?.id}</p>
                </div>
                <div className="text-right max-w-[200px]">
                  <p className="text-[9px] leading-relaxed text-gray-400 italic">
                    This ticket is valid for one-time entry for the specified date only ({formatDateOnly(printingTicket.valid_for_date)}).
                    No refunds or exchanges.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
