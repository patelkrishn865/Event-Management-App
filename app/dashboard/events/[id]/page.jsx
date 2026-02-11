"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import {
  CalendarDays,
  MapPin,
  Ticket,
  Minus,
  Plus,
  ShieldCheck,
  ArrowLeft,
  ReceiptIndianRupee,
  AlertCircle,
  LayoutDashboard,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { GlowBorder } from "@/components/ui/glow-border";

// ── Form Schema ─────────────────────────────────────────────────────────
const buyerSchema = z.object({
  buyer_name: z.string().min(2, "Name required"),
  buyer_email: z.string().email("Valid email required"),
  buyer_phone: z.string().optional().or(z.literal("")),
});

// ── Helpers ─────────────────────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "-";
  }
}

function rupees(paise) {
  const n = Number(paise || 0) / 100;
  return `₹ ${n.toFixed(2)}`;
}


// ── Real-time countdown in days + HH:mm:ss ──────────────────────────────
function getCountdown(targetDate) {
  if (!targetDate) return "00:00:00";

  const now = Date.now();
  const target = new Date(targetDate).getTime();
  let diff = target - now;

  if (diff <= 0) return "00:00:00";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  diff %= 1000 * 60 * 60 * 24;

  const hours = Math.floor(diff / (1000 * 60 * 60));
  diff %= 1000 * 60 * 60;

  const minutes = Math.floor(diff / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const timeStr = [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(seconds).padStart(2, "0"),
  ].join(":");

  return days > 0 ? `${days}d ${timeStr}` : timeStr;
}

function getTicketStatus(t, isEventCompleted) {
  const now = Date.now();

  if (isEventCompleted) {
    return { label: "Event ended", variant: "secondary" };
  }

  const start = t.sale_starts_at ? new Date(t.sale_starts_at).getTime() : null;
  const end = t.sale_ends_at ? new Date(t.sale_ends_at).getTime() : null;

  if (t.capacity !== 0 && t.remaining === 0) {
    return { label: "Sold out", variant: "destructive" };
  }

  if (start && now < start) {
    return {
      label: `Sales start in ${getCountdown(t.sale_starts_at)}`,
      variant: "secondary",
    };
  }

  if (end && now > end) {
    return { label: "Sales ended", variant: "secondary" };
  }

  if (end) {
    return {
      label: `On sale · Ends in ${getCountdown(t.sale_ends_at)}`,
      variant: "default",
    };
  }

  return { label: "On sale", variant: "default" };
}

function canBuyTicket(t, isEventCompleted) {
  const now = Date.now();
  if (isEventCompleted) return false;

  const start = t.sale_starts_at ? new Date(t.sale_starts_at).getTime() : null;
  const end = t.sale_ends_at ? new Date(t.sale_ends_at).getTime() : null;

  if (!t.is_active) return false;
  if (t.capacity !== 0 && t.remaining === 0) return false;
  if (start && now < start) return false;
  if (end && now > end) return false;

  return true;
}

function QtyControl({ value, onChange, disabled }) {
  const v = Number(value || 0);

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-10 rounded-2xl"
        disabled={disabled || v <= 0}
        onClick={() => onChange(Math.max(0, v - 1))}
      >
        <Minus className="h-4 w-4" />
      </Button>

      <div className="min-w-11 text-center text-sm font-semibold">{v}</div>

      <Button
        type="button"
        variant="outline"
        className="h-10 w-10 rounded-2xl"
        disabled={disabled}
        onClick={() => onChange(v + 1)}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ── Skeleton for ticket card (matches real ticket card) ─────────────────────
function SkeletonTicketCard() {
  return (
    <div className="rounded-3xl border bg-background/60 p-5 animate-pulse">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-6 w-48 bg-muted rounded-md" />
          <div className="h-5 w-32 bg-muted rounded-md" />
          <div className="h-4 w-40 bg-muted rounded-md" />
        </div>
        <div className="flex flex-col items-end gap-4">
          <div className="h-6 w-24 bg-muted rounded-full" />
          <div className="flex gap-2">
            <div className="h-10 w-10 bg-muted rounded-2xl" />
            <div className="h-10 w-11 bg-muted rounded-2xl" />
            <div className="h-10 w-10 bg-muted rounded-2xl" />
          </div>
        </div>
      </div>
      <div className="mt-4 pt-3 border-t">
        <div className="h-5 w-32 bg-muted rounded-md" />
      </div>
    </div>
  );
}

// ── Skeleton for checkout panel ────────────────────────────────────────────
function SkeletonCheckoutPanel() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-8 w-32 bg-muted rounded-lg" />
      <div className="h-32 w-full bg-muted rounded-2xl" />
      <div className="h-11 w-full bg-muted rounded-2xl" />
      <div className="h-11 w-full bg-muted rounded-2xl" />
      <div className="h-11 w-full bg-muted rounded-2xl" />
    </div>
  );
}

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [types, setTypes] = useState([]);
  const [qty, setQty] = useState({});
  const [msg, setMsg] = useState(null);
  const [eventDays, setEventDays] = useState([]);
  const [selectedDayId, setSelectedDayId] = useState(null);
  const [userRole, setUserRole] = useState(null);

  // Force re-render every second for live countdown
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => forceUpdate((x) => x + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const isCompleted = useMemo(() => {
    if (!event) return false;
    const end = event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at);
    return end < new Date();
  }, [event]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMsg(null);

      try {
        // Fetch event data from API route (uses supabaseAdmin to bypass RLS)
        const res = await fetch(`/api/events/${id}`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to fetch event");
        }
        const ev = await res.json();

        if (!mounted) return;

        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", sessionData.session.user.id)
            .single();
          if (profile) setUserRole(profile.role);
        }

        if (ev.status !== "published") {
          setMsg("This event is not published.");
          return;
        }

        const { data: days, error: dErr } = await supabase
          .from("event_days")
          .select("id, day_date, label")
          .eq("event_id", id)
          .order("day_date", { ascending: true });

        if (dErr) setMsg(dErr.message);

        setEventDays(days || []);
        setSelectedDayId(days?.[0]?.id || null);

        const { data: tt, error: tErr } = await supabase
          .from("ticket_type_availability")
          .select(
            `
            id,
            name,
            price_cents,
            currency,
            capacity,
            remaining,
            is_active,
            is_on_sale,
            sale_starts_at,
            sale_ends_at,
            created_at
          `
          )
          .eq("event_id", id)
          .eq("is_active", true)
          .order("created_at", { ascending: true });

        if (tErr) setMsg(tErr.message);

        setEvent(ev);
        setTypes(tt || []);
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
  }, [id]);

  const isEventCompleted = useMemo(() => {
    if (!event) return false;
    const now = new Date();
    const eventEnd = event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at);
    return now > eventEnd;
  }, [event]);

  const items = useMemo(() => {
    return (types || [])
      .map((t) => ({
        ticket_type_id: t.id,
        name: t.name,
        price_cents: Number(t.price_cents || 0),
        quantity: Number(qty[t.id] || 0),
      }))
      .filter((x) => x.quantity > 0);
  }, [types, qty]);

  const totalPaise = useMemo(() => {
    return items.reduce((sum, it) => sum + it.price_cents * it.quantity, 0);
  }, [items]);

  const totalQty = useMemo(() => {
    return items.reduce((sum, it) => sum + it.quantity, 0);
  }, [items]);

  const form = useForm({
    resolver: zodResolver(buyerSchema),
    defaultValues: { buyer_name: "", buyer_email: "", buyer_phone: "" },
    mode: "onChange",
  });

  const canCheckout = useMemo(() => {
    return (
      !isEventCompleted &&
      !!selectedDayId &&
      totalQty > 0 &&
      form.formState.isValid &&
      !form.formState.isSubmitting &&
      items.every((it) => {
        const t = types.find((x) => x.id === it.ticket_type_id);
        return t && canBuyTicket(t, isEventCompleted) && (t.capacity === 0 || it.quantity <= t.remaining);
      })
    );
  }, [selectedDayId, totalQty, form.formState.isValid, form.formState.isSubmitting, items, types, isEventCompleted]);

  function setTypeQty(typeId, next) {
    const t = types.find((x) => x.id === typeId);
    if (!t) return;

    const max = t.remaining ?? Infinity;
    const safeQty = Math.min(Math.max(0, next), max);

    setQty((prev) => ({ ...prev, [typeId]: safeQty }));
  }

  async function checkout(values) {
    setMsg(null);

    if (items.length === 0) return setMsg("Select at least 1 ticket.");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        event_id: id,
        event_day_id: selectedDayId,
        items: items.map((x) => ({
          ticket_type_id: x.ticket_type_id,
          quantity: x.quantity,
        })),
        buyer_name: values.buyer_name,
        buyer_email: values.buyer_email,
        buyer_phone: values.buyer_phone || null,
        success_url: `${window.location.origin}/payment/success`,
        cancel_url: `${window.location.origin}/dashboard/events/${id}`,
      }),
    });

    const out = await res.json().catch(() => ({}));
    if (!res.ok) return setMsg(out?.error || "Checkout failed");
    if (!out?.checkout_url) return setMsg("No checkout url returned");

    window.location.href = out.checkout_url;
  }
  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute top-10 -right-40 h-140 w-140 rounded-full bg-secondary/18 blur-3xl" />
          <div className="absolute -bottom-55 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
          {/* top actions skeleton */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Skeleton className="h-10 w-28 rounded-2xl" />
          </div>

          {/* hero skeleton – redesigned for better visibility */}
          <GlowBorder>
            <div className="flex flex-col bg-background/50 rounded-3xl overflow-hidden shadow-2xl">
              {/* Banner Area */}
              <div className="relative h-[45vh] min-h-[320px] w-full bg-muted animate-pulse">
                <Skeleton className="h-full w-full" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              </div>

              {/* Text Area Skeleton */}
              <div className="relative -mt-16 mx-6 sm:mx-8 mb-8">
                <div className="bg-background/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 border shadow-2xl space-y-4">
                  <div className="flex gap-2">
                    <Skeleton className="h-5 w-20 rounded-full" />
                    <Skeleton className="h-5 w-28 rounded-full" />
                  </div>
                  <Skeleton className="h-10 w-4/5 rounded-lg" />
                  <div className="flex flex-wrap gap-4">
                    <Skeleton className="h-5 w-40" />
                    <Skeleton className="h-5 w-56" />
                  </div>
                  <Skeleton className="h-16 w-full rounded-md" />
                </div>
              </div>
            </div>
          </GlowBorder>

          {/* main layout skeleton */}
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
            {/* ticket picker skeleton */}
            <GlowBorder>
              <CardContent className="p-6 sm:p-8 space-y-5 animate-pulse">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-8 w-48 rounded-lg" />
                  <Skeleton className="h-8 w-32 rounded-full" />
                </div>

                <Separator />

                <GlowBorder>
                  <CardContent className="p-5 space-y-3">
                    <Skeleton className="h-5 w-32 rounded-md" />
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-28 rounded-2xl" />
                      ))}
                    </div>
                  </CardContent>
                </GlowBorder>

                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonTicketCard key={i} />
                  ))}
                </div>
              </CardContent>
            </GlowBorder>

            {/* checkout panel skeleton */}
            <div className="lg:sticky lg:top-6 space-y-4">
              <GlowBorder>
                <CardContent className="p-6 sm:p-8 space-y-5 animate-pulse">
                  <Skeleton className="h-8 w-32 rounded-lg" />
                  <Separator />
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Separator />
                  <Skeleton className="h-11 w-full rounded-2xl" />
                  <Skeleton className="h-11 w-full rounded-2xl" />
                  <Skeleton className="h-11 w-full rounded-2xl" />
                </CardContent>
              </GlowBorder>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 space-y-3">
        <Alert className="rounded-2xl">
          <AlertDescription>{msg || "Event not found"}</AlertDescription>
        </Alert>
        <Button
          variant="outline"
          className="rounded-2xl"
          onClick={() => router.push("/dashboard/events")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to events
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-10 -right-40 h-140 w-140 rounded-full bg-secondary/18 blur-3xl" />
        <div className="absolute -bottom-55 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* top actions */}
        <div className="inline-flex items-center gap-2 rounded-2xl border bg-background/55 px-3 py-2 text-xs text-muted-foreground w-fit">
          <LayoutDashboard className="h-4 w-4" />
          <span className="font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => router.push("/dashboard")}>Dashboard</span>
          <span className="text-muted-foreground">•</span>
          <span className="font-medium cursor-pointer hover:text-foreground transition-colors" onClick={() => router.push("/dashboard/events")}>Events</span>
          <span className="text-muted-foreground">•</span>
          <span className="font-medium text-foreground truncate max-w-[150px]">{event?.title || "Details"}</span>
          {userRole && (
            <>
              <span className="text-muted-foreground">•</span>
              <Badge className="rounded-full" variant="secondary">{userRole}</Badge>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="outline"
            className="rounded-2xl"
            onClick={() => {
              if (userRole === "admin") {
                router.push("/dashboard/admin/events");
              } else {
                router.push("/dashboard/events");
              }
            }}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => router.push("/dashboard/attendee/tickets")}>
              <Ticket className="mr-2 h-4 w-4" />
              My Tickets
            </Button>

            {event?.starts_at && (new Date() > (event.ends_at ? new Date(event.ends_at) : new Date(event.starts_at))) && (
              <Button variant="outline" className="rounded-2xl" onClick={() => router.push(`/dashboard/events/${id}/feedback`)}>
                <ShieldCheck className="mr-2 h-4 w-4" />
                Submit Feedback
              </Button>
            )}
          </div>
        </div>

        {/* hero – balanced & clear redesign */}
        <GlowBorder>
          <div className="flex flex-col bg-background/50 rounded-3xl overflow-hidden shadow-2xl border">
            {/* Banner – full visibility */}
            <div className="relative h-[45vh] min-h-[320px] w-full bg-muted overflow-hidden">
              {event.banner_url ? (
                <img
                  src={event.banner_url}
                  alt={event.title}
                  className="h-full w-full object-cover object-center"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/10 via-background/40 to-secondary/10 flex items-center justify-center">
                  <span className="text-6xl opacity-20">🎟️</span>
                </div>
              )}

              {/* Subtle overlay to soften top of image if needed */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
            </div>

            {/* Info Card – overlapping for style but not hiding image content */}
            <div className="relative -mt-16 mx-6 sm:mx-8 mb-8 z-10">
              <div className="bg-background/95 backdrop-blur-xl rounded-2xl p-6 sm:p-10 border shadow-2xl">
                {/* Badges – clean & readable */}
                <div className="flex flex-wrap items-center gap-2 mb-4">
                  <Badge className="rounded-full bg-primary/10 text-primary border-primary/20 hover:bg-primary/20 transition-colors text-xs px-3 py-1">
                    {event.category || "Others"}
                  </Badge>
                  <Badge className={`rounded-full ${isCompleted ? 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20' : 'bg-green-500/10 text-green-600 border-green-500/20'} text-xs px-3 py-1`}>
                    {isCompleted ? "Completed" : "Published"}
                  </Badge>
                  <Badge variant="outline" className="rounded-full text-xs px-3 py-1 bg-muted/30">
                    <CalendarDays className="mr-1.5 h-3.5 w-3.5" />
                    {formatDate(event.starts_at)}
                  </Badge>
                </div>

                {/* Title – prominent and clear */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground leading-tight">
                  {event.title}
                </h1>

                {/* Meta details */}
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground border-t pt-6">
                  <div className="inline-flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-primary/10">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold opacity-50">Location</div>
                      <div className="font-semibold text-foreground">{event.location || "—"}</div>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-secondary/20">
                      <CalendarDays className="h-4 w-4 text-secondary-foreground" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold opacity-50">Schedule</div>
                      <div className="font-semibold text-foreground">
                        {formatDate(event.starts_at)}
                        {event.ends_at ? ` → ${formatDate(event.ends_at)}` : ""}
                      </div>
                    </div>
                  </div>

                  <div className="inline-flex items-center gap-2.5">
                    <div className="p-2 rounded-full bg-accent/20">
                      <ShieldCheck className="h-4 w-4 text-accent-foreground" />
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold opacity-50">Organizer</div>
                      <div className="font-semibold text-foreground">{event.organizer?.full_name || "Unknown"}</div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {event.description && (
                  <div className="mt-8">
                    <div className="text-[10px] uppercase tracking-wider font-bold opacity-50 mb-2">About this event</div>
                    <p className="text-base text-muted-foreground leading-relaxed">
                      {event.description}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </GlowBorder>

        {msg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] items-start">
          {/* ticket picker */}
          <GlowBorder>
            <CardContent className="p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xl font-semibold tracking-tight">
                    Select tickets
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Choose quantity per type.
                  </div>
                </div>
                <Badge className="rounded-full" variant="outline">
                  {totalQty} selected
                </Badge>
              </div>

              {isEventCompleted && (
                <Alert className="rounded-2xl border-orange-500/20 bg-orange-500/5">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-700 font-medium">
                    This event has ended. Tickets are no longer available for purchase.
                  </AlertDescription>
                </Alert>
              )}

              <Separator />

              <GlowBorder>
                <CardContent className="p-5 space-y-3">
                  <div className="text-sm font-medium">Select day</div>

                  <div className="flex flex-wrap gap-2">
                    {eventDays.map((d) => (
                      <Button
                        key={d.id}
                        type="button"
                        variant={selectedDayId === d.id ? "default" : "outline"}
                        className="rounded-2xl"
                        onClick={() => setSelectedDayId(d.id)}
                      >
                        {d.label || new Date(d.day_date).toDateString()}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </GlowBorder>

              {types.length === 0 ? (
                <div className="rounded-2xl border bg-background/60 p-6 text-sm text-muted-foreground">
                  No active ticket types available.
                </div>
              ) : (
                <div className="space-y-3">
                  {types.map((t) => {
                    const v = Number(qty[t.id] || 0);
                    const price = Number(t.price_cents || 0);
                    const status = getTicketStatus(t, isEventCompleted);
                    const canBuy = canBuyTicket(t, isEventCompleted);

                    return (
                      <div
                        key={t.id}
                        className="rounded-3xl border bg-background/60 p-5 hover:bg-background/70 hover:shadow-md transition-all duration-200"
                      >
                        <div className="flex items-start justify-between gap-5">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="font-semibold text-base sm:text-lg truncate">
                              {t.name}
                            </div>

                            <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                              <ReceiptIndianRupee className="h-4 w-4" />
                              <span className="font-medium text-foreground">
                                {rupees(price)}
                              </span>
                            </div>

                            <div className="text-xs mt-1">
                              {t.capacity === 0 ? (
                                <span className="text-green-600 font-medium">
                                  Unlimited available
                                </span>
                              ) : t.remaining > 5 ? (
                                <span className="text-muted-foreground font-semibold">
                                  {t.remaining} tickets left
                                </span>
                              ) : t.remaining > 0 ? (
                                <span className="text-orange-600 font-medium">
                                  Only {t.remaining} left – hurry!
                                </span>
                              ) : (
                                <span className="text-destructive font-medium flex items-center gap-1">
                                  <AlertCircle className="h-3.5 w-3.5" />
                                  Sold out
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-4">
                            <Badge
                              variant={status.variant}
                              className="rounded-full px-3 py-0.5 text-xs font-medium"
                            >
                              {status.label}
                            </Badge>

                            <QtyControl
                              value={v}
                              disabled={form.formState.isSubmitting || !canBuy}
                              onChange={(n) => {
                                if (t.capacity !== 0 && n > t.remaining) return;
                                setTypeQty(t.id, n);
                              }}
                            />
                          </div>
                        </div>

                        {v > 0 && (
                          <div className="mt-4 pt-3 border-t text-sm text-muted-foreground flex justify-between items-center">
                            <span>Subtotal</span>
                            <span className="font-medium text-foreground">
                              {rupees(price * v)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </GlowBorder>

          {/* checkout panel */}
          <div className="lg:sticky lg:top-6 space-y-4">
            <GlowBorder>
              <CardContent className="p-6 sm:p-8 space-y-5">
                <div>
                  <div className="text-xl font-semibold tracking-tight">
                    Checkout
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Enter buyer details to proceed.
                  </div>
                </div>

                <Separator />

                <div className="rounded-2xl border bg-background/60 p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Items</span>
                    <span className="font-medium">{totalQty}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Total</span>
                    <span className="text-base font-semibold">
                      {rupees(totalPaise)}
                    </span>
                  </div>
                </div>

                <Separator />

                <form onSubmit={form.handleSubmit(checkout)} className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">Name</label>
                    <Input
                      className="mt-2 h-11 rounded-2xl bg-background/60"
                      placeholder="Your full name"
                      {...form.register("buyer_name")}
                    />
                    {form.formState.errors?.buyer_name?.message && (
                      <p className="mt-1 text-xs text-destructive">
                        {form.formState.errors.buyer_name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Email</label>
                    <Input
                      className="mt-2 h-11 rounded-2xl bg-background/60"
                      placeholder="you@example.com"
                      {...form.register("buyer_email")}
                    />
                    {form.formState.errors?.buyer_email?.message && (
                      <p className="mt-1 text-xs text-destructive">
                        {form.formState.errors.buyer_email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="text-sm font-medium">Phone (optional)</label>
                    <Input
                      className="mt-2 h-11 rounded-2xl bg-background/60"
                      placeholder="e.g. 9XXXXXXXXX"
                      {...form.register("buyer_phone")}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-11 rounded-2xl"
                    disabled={!canCheckout}
                  >
                    {form.formState.isSubmitting ? "Redirecting..." : "Proceed to payment"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    You’ll be redirected to complete payment securely.
                  </p>
                </form>
              </CardContent>
            </GlowBorder>
          </div>
        </div>
      </div>
    </div>
  );
}
