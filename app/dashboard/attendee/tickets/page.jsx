"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { QRCodeCanvas } from "qrcode.react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";

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

function statusBadge(status) {
  const s = (status || "").toLowerCase();

  if (s === "active") {
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
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-10 -right-40 h-140 w-140 rounded-full bg-secondary/18 blur-3xl" />
        <div className="absolute -bottom-55 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-6">
        {/* Header */}
        <GlowBorder>
          <CardContent className="p-6 sm:p-10 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />
            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
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
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/events")}
                >
                  Browse Events
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={load}
                  disabled={loading}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => window.print()}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print / Save
                </Button>
              </div>
            </div>

            <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
                  onClick={() => router.push("/events")}
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
                          {statusBadge(status)}

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

                      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                          className="rounded-2xl"
                          onClick={() =>
                            router.push(`/events/${t?.events?.id}`)
                          }
                        >
                          View Event
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() =>
                            router.push(`/events/${t?.events?.id}/feedback`)
                          }
                        >
                          Feedback
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
    </div>
  );
}
