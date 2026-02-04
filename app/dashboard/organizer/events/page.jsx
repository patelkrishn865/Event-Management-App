"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";

import {
  CalendarDays,
  Filter,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  ArrowRight,
  LayoutGrid,
  List,
  Image as ImageIcon,
  UploadCloud,
  X,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const BUCKET = "event-banners";

const eventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  startsAt: z.string().min(1, "Start date/time is required"),
  endsAt: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "cancelled", "completed"]),
  banner_url: z.string().url("Invalid URL").optional().or(z.literal("")),
});

function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "-";
  }
}

function isUpcoming(startsAt) {
  if (!startsAt) return false;
  const t = new Date(startsAt).getTime();
  return Number.isFinite(t) ? t >= Date.now() - 5 * 60 * 1000 : false;
}

function statusBadge(status) {
  const s = (status || "").toLowerCase();
  
  if (s === "published") return <Badge className="rounded-full bg-emerald-600/90 text-white">Published</Badge>;
  if (s === "draft")     return <Badge className="rounded-full bg-amber-600/80 text-white">Draft</Badge>;
  if (s === "cancelled") return <Badge className="rounded-full bg-red-600/90 text-white">Cancelled</Badge>;
  if (s === "completed") return (
    <Badge className="rounded-full bg-cyan-700/80 text-cyan-100 border-cyan-500/50">
      Completed
    </Badge>
  );

  return <Badge className="rounded-full bg-gray-700/80 text-gray-200 border-gray-600/50">{status || "—"}</Badge>;
}

function GlowBorder({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-3xl p-px bg-linear-to-br",
        "from-primary/45 via-foreground/10 to-secondary/40",
        "shadow-sm hover:shadow-md transition",
        className,
      ].join(" ")}
    >
      <div className="rounded-3xl bg-card/80 backdrop-blur">{children}</div>
    </div>
  );
}

function safeExt(filename = "") {
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  return "jpg";
}

export default function OrganizerEventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [serverMsg, setServerMsg] = useState(null);
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("");
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [view, setView] = useState("grid");

  const fileRef = useRef(null);
  const [bannerFile, setBannerFile] = useState(null);
  const [bannerPreview, setBannerPreview] = useState("");
  const [uploadingBanner, setUploadingBanner] = useState(false);

  const form = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      startsAt: "",
      endsAt: "",
      status: "draft",
      banner_url: "",
    },
    mode: "onChange",
  });

  const canSubmit = useMemo(() => {
    return form.formState.isValid && !form.formState.isSubmitting && !uploadingBanner;
  }, [form.formState.isValid, form.formState.isSubmitting, uploadingBanner]);

  async function ensureOrganizer() {
    const { data: sessionWrap } = await supabase.auth.getSession();
    const session = sessionWrap?.session;
    if (!session?.user) {
      router.replace("/auth/login");
      return null;
    }
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", session.user.id)
      .single();
    if (error) {
      setServerMsg(error.message);
      return null;
    }
    const r = profile?.role || "attendee";
    setRole(r);
    if (profile?.role !== "organizer" && profile?.role !== "admin") {
      router.replace("/dashboard");
      return null;
    }
    return session.user.id;
  }

  async function loadEvents() {
    setServerMsg(null);
    setLoading(true);
    const ok = await ensureOrganizer();
    if (!ok) return;
    const { data: sessionWrap } = await supabase.auth.getSession();
    const user = sessionWrap.session?.user;

    const { data, error } = await supabase
      .from("events")
      .select("id,title,location,starts_at,ends_at,status,created_at,banner_url")
      .eq('organizer_id', user.id)
      .order("created_at", { ascending: false });

    if (error) setServerMsg(error.message);
    setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadEvents();
  }, []);

  const stats = useMemo(() => {
    const total = events.length;
    const published = events.filter((e) => e.status === "published").length;
    const draft = events.filter((e) => e.status === "draft").length;
    const upcoming = events.filter((e) => e.status === "published" && isUpcoming(e.starts_at)).length;
    return { total, published, draft, upcoming };
  }, [events]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (events || [])
      .filter((ev) => (statusFilter === "all" ? true : ev.status === statusFilter))
      .filter((ev) => {
        if (!term) return true;
        const t = (ev.title || "").toLowerCase();
        const l = (ev.location || "").toLowerCase();
        return t.includes(term) || l.includes(term);
      });
  }, [events, q, statusFilter]);

  function resetBannerPicker() {
    setBannerFile(null);
    setBannerPreview("");
    try {
      if (fileRef.current) fileRef.current.value = "";
    } catch {}
  }

  function onPickBanner(file) {
    setServerMsg(null);
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setServerMsg("Please select a JPG, PNG, or WEBP image.");
      return;
    }
    const maxMB = 5;
    if (file.size > maxMB * 1024 * 1024) {
      setServerMsg(`Banner too large. Max ${maxMB}MB.`);
      return;
    }
    setBannerFile(file);
    const url = URL.createObjectURL(file);
    setBannerPreview(url);
  }

  async function uploadBannerIfAny(organizerId) {
    if (!bannerFile) return null;
    setUploadingBanner(true);
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
      const ext = safeExt(bannerFile.name);
      const path = `${organizerId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bannerFile, {
          cacheControl: "3600",
          upsert: false,
          contentType: bannerFile.type,
        });
      if (upErr) throw upErr;
      const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
      return publicUrl;
    } finally {
      setUploadingBanner(false);
    }
  }

  async function onCreate(values) {
    setServerMsg(null);
    const { data: sessionWrap } = await supabase.auth.getSession();
    const session = sessionWrap?.session;
    if (!session?.user) return router.replace("/auth/login");
    const organizerId = session.user.id;
    const startsISO = new Date(values.startsAt).toISOString();
    const endsISO = values.endsAt ? new Date(values.endsAt).toISOString() : null;
    let bannerUrl = null;
    try {
      bannerUrl = await uploadBannerIfAny(organizerId);
    } catch (e) {
      setServerMsg(e?.message || String(e));
      return;
    }
    const { data, error } = await supabase
      .from("events")
      .insert({
        organizer_id: organizerId,
        title: values.title.trim(),
        description: values.description?.trim() || null,
        location: values.location?.trim() || null,
        starts_at: startsISO,
        ends_at: endsISO,
        status: values.status,
        banner_url: bannerUrl || null,
      })
      .select("id")
      .single();
    if (error) return setServerMsg(error.message);
    form.reset({
      title: "",
      description: "",
      location: "",
      startsAt: "",
      endsAt: "",
      status: "draft",
      banner_url: "",
    });
    resetBannerPicker();
    setOpen(false);
    router.push(`/dashboard/organizer/events/${data.id}`);
  }

  // ── Skeleton for Event Card (matches new blackish style) ────────────────────
  function SkeletonEventCard() {
    return (
      <GlowBorder>
        <div className="rounded-3xl overflow-hidden bg-card/80 backdrop-blur-sm animate-pulse">
          <div className="relative h-44 bg-muted">
            <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 space-y-2">
              <div className="h-6 w-3/4 bg-muted/60 rounded" />
              <div className="h-4 w-1/2 bg-muted/40 rounded" />
            </div>
          </div>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 w-24 bg-muted/60 rounded" />
              <div className="h-5 w-20 bg-muted/40 rounded-full" />
            </div>
            <div className="h-10 w-full bg-muted/60 rounded-2xl" />
          </CardContent>
        </div>
      </GlowBorder>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-12 -right-40 h-140 w-140 rounded-full bg-secondary/18 blur-3xl" />
        <div className="absolute -bottom-55 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {/* HERO */}
        <GlowBorder>
          <CardContent className="p-6 sm:p-10 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />

            <div className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    className="rounded-2xl bg-background/55"
                    onClick={() => router.push("/dashboard")}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Dashboard
                  </Button>
                </div>

                <div className="inline-flex items-center gap-2 rounded-full border bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Organizer Dashboard
                </div>

                <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                  Your Events
                </h1>

                <p className="text-sm text-muted-foreground">
                  Create events, manage ticket types, assign staff, and track check-ins.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={loadEvents}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                <Dialog
                  open={open}
                  onOpenChange={(v) => {
                    setOpen(v);
                    setServerMsg(null);
                    if (!v) {
                      form.reset({
                        title: "",
                        description: "",
                        location: "",
                        startsAt: "",
                        endsAt: "",
                        status: "draft",
                      });
                      resetBannerPicker();
                    }
                  }}
                >
                  <DialogTrigger asChild>
                    <Button className="rounded-2xl">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Event
                    </Button>
                  </DialogTrigger>

                  <DialogContent className="p-0 border-0 bg-transparent shadow-none sm:max-w-2xl max-h-[90vh] overflow-hidden">
                    <GlowBorder className="w-full">
                      <div className="rounded-3xl bg-card/85 backdrop-blur overflow-hidden">
                        <div className="relative p-6 sm:p-7">
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/10" />

                          <div className="relative">
                            <div className="inline-flex items-center gap-2 rounded-full border bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                              <Sparkles className="h-3.5 w-3.5" />
                              New event
                            </div>

                            <DialogHeader className="mt-3 space-y-1">
                              <DialogTitle className="text-2xl tracking-tight">Create Event</DialogTitle>
                              <DialogDescription>
                                Add details, upload a banner, and publish when ready.
                              </DialogDescription>
                            </DialogHeader>
                          </div>
                        </div>

                        <Separator />

                        <div className="max-h-[65vh] overflow-y-auto">
                          <div className="p-6 sm:p-7 space-y-5">
                            {serverMsg && (
                              <Alert className="rounded-2xl">
                                <AlertDescription>{serverMsg}</AlertDescription>
                              </Alert>
                            )}

                            {/* Banner */}
                            <div className="rounded-3xl border bg-background/55 p-4 sm:p-5">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold">Event banner</div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    JPG / PNG / WEBP (max 5MB). Optional.
                                  </div>
                                </div>

                                {bannerFile && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl bg-background/60"
                                    onClick={resetBannerPicker}
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Remove
                                  </Button>
                                )}
                              </div>

                              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <input
                                    ref={fileRef}
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => onPickBanner(e.target.files?.[0] || null)}
                                  />

                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="w-full rounded-2xl bg-background/60 h-11"
                                    onClick={() => fileRef.current?.click()}
                                    disabled={uploadingBanner}
                                  >
                                    <UploadCloud className="mr-2 h-4 w-4" />
                                    Choose image
                                  </Button>

                                  <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                                    <ImageIcon className="h-4 w-4 shrink-0" />
                                    <span className="truncate">
                                      {bannerFile ? bannerFile.name : "No file selected"}
                                    </span>
                                  </div>

                                  {uploadingBanner && (
                                    <div className="text-xs text-muted-foreground">Uploading…</div>
                                  )}
                                </div>

                                <div className="rounded-2xl border overflow-hidden bg-muted">
                                  {bannerPreview ? (
                                    <img
                                      src={bannerPreview}
                                      alt="Banner preview"
                                      className="h-36 w-full object-cover"
                                    />
                                  ) : (
                                    <div className="h-36 w-full bg-linear-to-br from-primary/15 via-background to-secondary/15 flex items-center justify-center">
                                      <ImageIcon className="h-12 w-12 text-muted-foreground/30" />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            <Form {...form}>
                              <form onSubmit={form.handleSubmit(onCreate)} className="space-y-5">
                                <div className="rounded-3xl border bg-background/55 p-4 sm:p-5 space-y-4">
                                  <div>
                                    <div className="text-sm font-semibold">Basics</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Title, location and description.
                                    </div>
                                  </div>

                                  <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Title</FormLabel>
                                        <FormControl>
                                          <Input
                                            className="rounded-2xl h-11 bg-background/60"
                                            placeholder="Tech Meetup 2026"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name="location"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Location</FormLabel>
                                          <FormControl>
                                            <Input
                                              className="rounded-2xl h-11 bg-background/60"
                                              placeholder="Surat"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name="status"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Status</FormLabel>
                                          <FormControl>
                                            <select
                                              {...field}
                                              className="h-11 w-full rounded-2xl border bg-background/60 px-3 text-sm"
                                            >
                                              <option value="draft">Draft</option>
                                              <option value="published">Published</option>
                                              <option value="cancelled">Cancelled</option>
                                              <option value="completed">Completed</option>
                                            </select>
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>

                                  <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                      <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                          <Textarea
                                            className="rounded-2xl min-h-24 bg-background/60"
                                            placeholder="What is this event about?"
                                            {...field}
                                          />
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )}
                                  />
                                </div>

                                <div className="rounded-3xl border bg-background/55 p-4 sm:p-5 space-y-4">
                                  <div>
                                    <div className="text-sm font-semibold">Schedule</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Set start/end time.
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <FormField
                                      control={form.control}
                                      name="startsAt"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Starts at</FormLabel>
                                          <FormControl>
                                            <Input
                                              className="rounded-2xl h-11 bg-background/60"
                                              type="datetime-local"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name="endsAt"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Ends at (optional)</FormLabel>
                                          <FormControl>
                                            <Input
                                              className="rounded-2xl h-11 bg-background/60"
                                              type="datetime-local"
                                              {...field}
                                            />
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />
                                  </div>
                                </div>

                                <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl bg-background/60"
                                    onClick={() => {
                                      setOpen(false);
                                      setServerMsg(null);
                                      form.reset();
                                      resetBannerPicker();
                                    }}
                                  >
                                    Cancel
                                  </Button>

                                  <Button
                                    type="submit"
                                    className="rounded-2xl"
                                    disabled={!canSubmit}
                                  >
                                    {form.formState.isSubmitting ? "Creating..." : "Create Event"}
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                  </Button>
                                </div>
                              </form>
                            </Form>
                          </div>
                        </div>
                      </div>
                    </GlowBorder>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Stats */}
            <div className="relative mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border bg-card/80 backdrop-blur p-4">
                <div className="text-xs text-muted-foreground">Total events</div>
                <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
              </div>
              <div className="rounded-3xl border bg-card/80 backdrop-blur p-4">
                <div className="text-xs text-muted-foreground">Published</div>
                <div className="mt-1 text-2xl font-semibold">{stats.published}</div>
              </div>
              <div className="rounded-3xl border bg-card/80 backdrop-blur p-4">
                <div className="text-xs text-muted-foreground">Drafts</div>
                <div className="mt-1 text-2xl font-semibold">{stats.draft}</div>
              </div>
              <div className="rounded-3xl border bg-card/80 backdrop-blur p-4">
                <div className="text-xs text-muted-foreground">Upcoming (published)</div>
                <div className="mt-1 text-2xl font-semibold">{stats.upcoming}</div>
              </div>
            </div>
          </CardContent>
        </GlowBorder>

        {serverMsg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{serverMsg}</AlertDescription>
          </Alert>
        )}

        {/* Filters */}
        <GlowBorder>
          <CardContent className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-2xl pl-9 bg-background/60"
                  placeholder="Search by title or location..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex items-center gap-2 text-xs text-muted-foreground mr-1">
                  <Filter className="h-4 w-4" />
                  Status:
                </div>
                {["all", "published", "draft", "completed", "cancelled"].map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant={statusFilter === s ? "default" : "outline"}
                    className="rounded-2xl h-10"
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Button>
                ))}

                <Separator orientation="vertical" className="hidden sm:block h-8 mx-2" />

                <Button
                  type="button"
                  variant={view === "grid" ? "default" : "outline"}
                  className="rounded-2xl h-10"
                  onClick={() => setView("grid")}
                >
                  <LayoutGrid className="h-4 w-4 mr-2" />
                  Grid
                </Button>

                <Button
                  type="button"
                  variant={view === "list" ? "default" : "outline"}
                  className="rounded-2xl h-10"
                  onClick={() => setView("list")}
                >
                  <List className="h-4 w-4 mr-2" />
                  List
                </Button>
              </div>
            </div>

            <div className="mt-4 text-sm text-muted-foreground">
              {loading ? "Loading..." : `Showing ${filtered.length} event${filtered.length !== 1 ? "s" : ""}`}
            </div>
          </CardContent>
        </GlowBorder>

        {/* Event Cards */}
        {loading ? (
          <div className={view === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonEventCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <GlowBorder>
            <CardContent className="p-10 text-center space-y-3">
              <div className="text-xl font-semibold tracking-tight">No events found</div>
              <div className="text-sm text-muted-foreground">
                Try clearing search or switching the status filter.
              </div>
              <div className="pt-2 flex justify-center gap-2">
                <Button className="rounded-2xl" onClick={() => setOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Event
                </Button>
                <Button variant="outline" className="rounded-2xl" onClick={() => setQ("")}>
                  Clear search
                </Button>
              </div>
            </CardContent>
          </GlowBorder>
        ) : view === "grid" ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((ev) => (
              <GlowBorder key={ev.id} className="hover:shadow-lg transition-shadow duration-300">
                <div
                  className="group rounded-3xl overflow-hidden cursor-pointer bg-card/80 backdrop-blur-sm"
                  onClick={() => router.push(`/dashboard/organizer/events/${ev.id}`)}
                >
                  <div className="relative h-44 overflow-hidden">
                    {ev.banner_url ? (
                      <img
                        src={ev.banner_url}
                        alt={ev.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="h-full w-full bg-gradient-to-br from-primary/15 via-background/80 to-secondary/15 flex items-center justify-center">
                        <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none" />

                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 text-white">
                      <div className="min-w-0">
                        <div className="truncate text-base font-semibold tracking-tight drop-shadow-md">
                          {ev.title}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs drop-shadow-sm">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{ev.location || "—"}</span>
                        </div>
                      </div>

                      <div className="shrink-0">{statusBadge(ev.status)}</div>
                    </div>
                  </div>

                  <CardContent className="p-4 space-y-3 bg-card/90 backdrop-blur-sm">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="inline-flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        <span>{formatDate(ev.starts_at)}</span>
                      </div>

                      {ev.status === "published" && isUpcoming(ev.starts_at) ? (
                        <Badge className="rounded-full bg-primary/80 text-primary-foreground">
                          Upcoming
                        </Badge>
                      ) : (
                        <Badge className="rounded-full" variant="outline">
                          —
                        </Badge>
                      )}
                    </div>

                    <Button
                      className="w-full rounded-2xl bg-primary/90 hover:bg-primary transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/organizer/events/${ev.id}`);
                      }}
                    >
                      Manage Event
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </CardContent>
                </div>
              </GlowBorder>
            ))}
          </div>
        ) : (
          <GlowBorder>
            <CardContent className="p-4 sm:p-6">
              <div className="space-y-3">
                {filtered.map((ev) => (
                  <div
                    key={ev.id}
                    className="rounded-2xl border bg-card/80 backdrop-blur-sm p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between hover:bg-card/90 transition-colors"
                    onClick={() => router.push(`/dashboard/organizer/events/${ev.id}`)}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold truncate">{ev.title}</div>
                        {statusBadge(ev.status)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          {ev.location || "—"}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDate(ev.starts_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        className="rounded-2xl bg-background/60"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/events/${ev.id}`);
                        }}
                      >
                        Public
                      </Button>
                      <Button
                        className="rounded-2xl"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/dashboard/organizer/events/${ev.id}`);
                        }}
                      >
                        Manage
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </GlowBorder>
        )}
      </div>
    </div>
  );
}