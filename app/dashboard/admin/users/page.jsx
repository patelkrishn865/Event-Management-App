"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { GlowBorder } from "@/components/ui/glow-border";

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
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from "lucide-react";


function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return "—";
  }
}

function roleBadge(role) {
  if (role === "admin") return <Badge>Admin</Badge>;
  if (role === "organizer") return <Badge variant="secondary">Organizer</Badge>;
  if (role === "pending_organizer") return <Badge className="bg-amber-500 text-white hover:bg-amber-600 border-none">Pending Organizer</Badge>;
  return <Badge variant="outline">Attendee</Badge>;
}

// ── Skeleton for each user item (matches real card) ─────────────────────────
function SkeletonUserItem() {
  return (
    <div className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:justify-between animate-pulse">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-10 bg-muted rounded-full" /> {/* avatar placeholder */}
          <div className="h-5 w-40 bg-muted rounded-md" /> {/* name */}
          <div className="h-5 w-24 bg-muted rounded-full" /> {/* role badge */}
        </div>
        <div className="h-4 w-64 bg-muted rounded" /> {/* email */}
        <div className="h-4 w-48 bg-muted rounded" /> {/* joined date */}
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-36 bg-muted rounded-2xl" />
        <div className="h-9 w-36 bg-muted rounded-2xl" />
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);

  async function load(clearMsg = true) {
    setLoading(true);
    if (clearMsg) setMsg(null);
    const { data: sessionWrap } = await supabase.auth.getSession();
    const user = sessionWrap?.session?.user;
    if (!user) return router.replace("/auth/login");
    setCurrentUserId(user.id);

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (pErr || profile?.role !== "admin") {
      return router.replace("/dashboard");
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, role, created_at")
      .order("created_at", { ascending: false });

    if (error) return setMsg({ type: "error", text: error.message });
    setUsers(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return users.filter((u) => {
      if (roleFilter === "requests") {
        if (u.role !== "pending_organizer") return false;
      } else if (roleFilter !== "all" && u.role !== roleFilter) {
        return false;
      }
      if (!term) return true;
      return (
        u.email?.toLowerCase().includes(term) ||
        u.full_name?.toLowerCase().includes(term)
      );
    });
  }, [users, q, roleFilter]);

  async function changeRole(userId, role) {
    setUpdatingId(userId);
    setMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/admin/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId, role }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to update role");
      }

      setMsg({ type: "success", text: `Role updated to ${role} ✅` });
      await load(false); // don't clear the success message
    } catch (error) {
      console.error("Update error:", error);
      setMsg({ type: "error", text: error.message });
    } finally {
      setUpdatingId(null);
    }
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

                <h1 className="mt-4 text-3xl font-semibold">Users</h1>
                <p className="text-sm text-muted-foreground">
                  Manage platform users and roles.
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
          <Alert
            variant={msg.type === "success" ? "default" : "destructive"}
            className={cn(
              "rounded-2xl border-2 transition-all duration-300",
              msg.type === "success"
                ? "border-emerald-500/20 bg-emerald-50/5 dark:bg-emerald-500/10"
                : "border-destructive/20 bg-destructive/5 dark:bg-destructive/10"
            )}
          >
            {msg.type === "success" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className="font-medium">
              {msg.text}
            </AlertDescription>
          </Alert>
        )}

        <GlowBorder>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 rounded-2xl"
                placeholder="Search name or email…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "requests", "admin", "organizer", "attendee"].map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={roleFilter === r ? "default" : "outline"}
                  className="rounded-2xl capitalize"
                  onClick={() => setRoleFilter(r)}
                >
                  {r === "requests" ? "Pending Requests" : r}
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
                  <SkeletonUserItem key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                No users found
              </div>
            ) : (
              filtered.map((u) => (
                <div
                  key={u.id}
                  className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className="font-semibold truncate">
                        {u.full_name || "—"}
                      </div>
                      {roleBadge(u.role)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {u.email} • Joined {fmtDate(u.created_at)}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {u.role !== "organizer" && roleFilter === "requests" && (
                      <Button
                        variant="outline"
                        className="rounded-2xl min-w-32"
                        disabled={updatingId === u.id || currentUserId === u.id}
                        onClick={() => changeRole(u.id, "organizer")}
                      >
                        {updatingId === u.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UserCheck className="mr-2 h-5 w-5" />
                        )}
                        Approve Organizer
                      </Button>
                    )}
                    {u.role !== "attendee" && (
                      <Button
                        variant="outline"
                        className="rounded-2xl min-w-32"
                        disabled={updatingId === u.id || currentUserId === u.id}
                        onClick={() => changeRole(u.id, "attendee")}
                      >
                        {updatingId === u.id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <UserX className="mr-2 h-4 w-4" />
                        )}
                        Make Attendee
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