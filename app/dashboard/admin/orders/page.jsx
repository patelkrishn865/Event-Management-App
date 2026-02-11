"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import {
  ArrowLeft,
  CreditCard,
  ExternalLink,
  IndianRupee,
  RefreshCw,
  Search,
} from "lucide-react";
import { GlowBorder } from "@/components/ui/glow-border";


function statusBadge(status) {
  if (status === "paid") return <Badge>Paid</Badge>;
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>;
  if (status === "refunded") return <Badge variant="outline">Refunded</Badge>;
  if (status === "failed") return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">{status || "—"}</Badge>;
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function rupees(paise) {
  return `₹ ${(Number(paise || 0) / 100).toFixed(2)}`;
}

// ── Skeleton for each order item (matches real card) ────────────────────────
function SkeletonOrderItem() {
  return (
    <div className="rounded-2xl p-4 border bg-background/55 flex flex-col sm:flex-row sm:justify-between gap-3 animate-pulse">
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-5 w-40 bg-muted rounded-md" /> {/* buyer name */}
          <div className="h-5 w-24 bg-muted rounded-full" /> {/* status badge */}
        </div>
        <div className="h-4 w-64 bg-muted rounded" /> {/* email + date */}
        <div className="h-4 w-48 bg-muted rounded" /> {/* event title */}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="h-6 w-28 bg-muted rounded-full" /> {/* amount badge */}
        <div className="h-9 w-28 bg-muted rounded-2xl" /> {/* Stripe button */}
      </div>
    </div>
  );
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [orders, setOrders] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

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
      .from("orders")
      .select(
        `
        id,
        buyer_name,
        buyer_email,
        buyer_phone,
        amount_total_cents,
        currency,
        status,
        provider_payment_id,
        created_at,
        event:events ( id, title )
        `
      )
      .order("created_at", { ascending: false });

    if (error) return setMsg(error.message);
    setOrders(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!term) return true;
      return (
        o.buyer_email?.toLowerCase().includes(term) ||
        o.buyer_name?.toLowerCase().includes(term) ||
        o.provider_payment_id?.toLowerCase().includes(term) ||
        o.event?.title?.toLowerCase().includes(term)
      );
    });
  }, [orders, q, statusFilter]);

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
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Admin Panel</span>
                </div>

                <h1 className="mt-4 text-3xl font-semibold">Orders</h1>
                <div className="text-sm text-muted-foreground">
                  All payments and ticket purchases.
                </div>
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
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 rounded-2xl"
                placeholder="Search email, event, payment id..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["all", "paid", "pending", "failed", "refunded"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === s ? "default" : "outline"}
                  className="rounded-2xl"
                  onClick={() => setStatusFilter(s)}
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
                  <SkeletonOrderItem key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground py-10 text-center">
                No orders found
              </div>
            ) : (
              filtered.map((o) => (
                <div
                  key={o.id}
                  className="rounded-2xl p-4 border bg-background/55 flex flex-col sm:flex-row sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-semibold truncate">
                        {o.buyer_name || "—"}
                      </div>
                      {statusBadge(o.status)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {o.buyer_email} • {fmtDate(o.created_at)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Event: {o.event?.title || "—"}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant='secondary' className='rounded-full'>
                      <IndianRupee className="h-3.5 w-3.5 mr-1" />
                      {rupees(o.amount_total_cents)}
                    </Badge>
                    {o.provider_payment_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        className='rounded-2xl'
                        onClick={() =>
                          window.open(
                            `https://dashboard.stripe.com/payments/${o.provider_payment_id}`,
                            "_blank"
                          )
                        }
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Stripe
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