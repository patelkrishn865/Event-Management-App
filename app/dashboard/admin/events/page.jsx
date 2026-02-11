"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CardContent,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";

import {
  ArrowLeft,
  Ban,
  CalendarDays,
  ExternalLink,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  Upload,
  User,
  Plus,
  X,
  UploadCloud,
  Image as ImageIcon,
  ArrowRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { GlowBorder } from "@/components/ui/glow-border";

const BUCKET = "event-banners";

const COMMON_LOCATIONS = [
  "Surat",
  "Ahmedabad",
  "Mumbai",
  "Pune",
  "Bangalore",
  "Delhi",
  "Hyderabad",
  "Jaipur",
  "Chennai",
  "Goa",
];
const EVENT_CATEGORIES = [
  "Music",
  "Technology",
  "Business",
  "Workshop",
  "Social",
  "Party",
  "Arts",
  "Sports",
  "Other",
];

const eventSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().min(1, "Location is required").max(200),
  startsAt: z.string().min(1, "Start date/time is required").refine((val) => {
    const start = new Date(val).getTime();
    return start >= Date.now() - 60000;
  }, "Start date/time cannot be in the past"),
  endsAt: z.string().min(1, "End date/time is required"),
  status: z.enum(["draft", "pending", "published", "cancelled", "completed"]).default("published"),
  banner_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  category: z.string().min(1, "Category is required"),
}).superRefine((data, ctx) => {
  if (data.startsAt && data.endsAt) {
    const start = new Date(data.startsAt).getTime();
    const end = new Date(data.endsAt).getTime();
    if (end < start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "End date must be after start date",
        path: ["endsAt"],
      });
    }
  }
});

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch (e) {
    return "—";
  }
}

function safeExt(filename = "") {
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts.pop().toLowerCase() : "jpg";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext;
  return "jpg";
}

function statusBadge(ev) {
  const status = ev.status;
  const s = (status || "").toLowerCase();

  const isPast = ev.ends_at
    ? new Date(ev.ends_at) < new Date()
    : ev.starts_at
      ? new Date(ev.starts_at) < new Date()
      : false;

  if (s === "published" && isPast) {
    return (
      <Badge className="bg-cyan-500/10 text-cyan-500 border-cyan-500/20 hover:bg-cyan-500/20">
        Completed
      </Badge>
    );
  }

  if (s === "published") return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20">Published</Badge>;
  if (s === "pending") return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 hover:bg-amber-500/20">Pending</Badge>;
  if (status === "draft") return <Badge variant="secondary">Draft</Badge>;
  if (status === "cancelled")
    return <Badge variant="destructive">Cancelled</Badge>;
  if (status === "completed") return <Badge variant="outline">Completed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

// ── Skeleton for each event item (matches real card) ────────────────────────
function SkeletonEventItem() {
  return (
    <div className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:justify-between animate-pulse">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-48 bg-muted rounded-md" />
          <div className="h-5 w-24 bg-muted rounded-full" />
        </div>
        <div className="h-4 w-64 bg-muted rounded" />
        <div className="flex flex-wrap gap-3">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-4 w-40 bg-muted rounded" />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="h-9 w-28 bg-muted rounded-2xl" />
        <div className="h-9 w-28 bg-muted rounded-2xl" />
        <div className="h-9 w-28 bg-muted rounded-2xl" />
      </div>
    </div>
  );
}

export default function AdminEventsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [events, setEvents] = useState([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  const [open, setOpen] = useState(false);
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
      status: "published", // Admin events are published by default
      banner_url: "",
      category: "Other",
    },
    mode: "onChange",
  });

  const canSubmit = useMemo(() => {
    return form.formState.isValid && !form.formState.isSubmitting && !uploadingBanner;
  }, [form.formState.isValid, form.formState.isSubmitting, uploadingBanner]);

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
      .from("events")
      .select(
        `
        id,
        title,
        status,
        location,
        starts_at,
        ends_at,
        category,
        organizer:profiles!events_organizer_id_fkey(
        full_name,
        email
        )`
      )
      .order("created_at", { ascending: false });

    if (error) return setMsg(error.message);
    setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = q.toLowerCase();
    return events.filter((e) => {
      const isPast = e.ends_at
        ? new Date(e.ends_at) < new Date()
        : e.starts_at
          ? new Date(e.starts_at) < new Date()
          : false;

      const effectiveStatus = (e.status === "published" && isPast) ? "completed" : e.status;

      if (status !== "all" && effectiveStatus !== status) return false;
      if (!term) return true;
      return (
        e.title?.toLowerCase().includes(term) ||
        e.organizer?.email?.toLowerCase().includes(term)
      );
    });
  }, [events, q, status]);

  async function updateStatus(eventId, newStatus) {
    if (newStatus === "published") {
      const ev = events.find((e) => e.id === eventId);
      if (ev && new Date(ev.starts_at).getTime() < Date.now()) {
        setMsg("Cannot publish an event that has already started/passed.");
        return;
      }
    }
    const { error } = await supabase
      .from("events")
      .update({ status: newStatus })
      .eq("id", eventId);
    if (error) return setMsg(error.message);
    load();
  }

  function resetBannerPicker() {
    setBannerFile(null);
    setBannerPreview("");
    try {
      if (fileRef.current) fileRef.current.value = "";
    } catch { }
  }

  function onPickBanner(file) {
    setMsg(null);
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setMsg("Please select a JPG, PNG, or WEBP image.");
      return;
    }
    const maxMB = 5;
    if (file.size > maxMB * 1024 * 1024) {
      setMsg(`Banner too large. Max ${maxMB}MB.`);
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
    setMsg(null);
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
      setMsg(e?.message || String(e));
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
        status: "published", // Auto-published for Admin
        banner_url: bannerUrl || null,
        category: values.category,
      })
      .select("id")
      .single();

    if (error) {
      return setMsg(error.message);
    }

    setMsg("Event created and published! 🚀");

    setTimeout(async () => {
      form.reset({
        title: "",
        description: "",
        location: "",
        startsAt: "",
        endsAt: "",
        status: "published",
        banner_url: "",
        category: "Other",
      });
      resetBannerPicker();
      setOpen(false);
      await load();
    }, 1500);
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

                <h1 className="mt-4 text-3xl font-semibold">All Events</h1>
                <p className="text-sm text-muted-foreground">
                  Manage every event on the platform.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={load} className="rounded-2xl">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>

                {/* Create Event Dialog */}
                <Dialog
                  open={open}
                  onOpenChange={(v) => {
                    setOpen(v);
                    setMsg(null);
                    if (!v) {
                      form.reset({
                        title: "",
                        description: "",
                        location: "",
                        startsAt: "",
                        endsAt: "",
                        status: "published",
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
                          <div className="relative">
                            <div className="inline-flex items-center gap-2 rounded-full border bg-background/55 px-3 py-1 text-xs text-muted-foreground">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              Admin Action
                            </div>
                            <DialogHeader className="mt-3 space-y-1">
                              <DialogTitle className="text-2xl tracking-tight">Create Event</DialogTitle>
                              <DialogDescription>
                                Add details, upload a banner. Event will be <strong>auto-published</strong>.
                              </DialogDescription>
                            </DialogHeader>
                          </div>
                        </div>

                        <Separator />

                        <div className="max-h-[65vh] overflow-y-auto">
                          <div className="p-6 sm:p-7 space-y-5">
                            {msg && (
                              <Alert className="rounded-2xl">
                                <AlertDescription>{msg}</AlertDescription>
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
                                            <div className="relative">
                                              <Input
                                                className="rounded-2xl h-11 bg-background/60"
                                                placeholder="e.g. Surat"
                                                list="location-hints"
                                                {...field}
                                              />
                                              <datalist id="location-hints">
                                                {COMMON_LOCATIONS.map((loc) => (
                                                  <option key={loc} value={loc} />
                                                ))}
                                              </datalist>
                                            </div>
                                          </FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )}
                                    />

                                    <FormField
                                      control={form.control}
                                      name="category"
                                      render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Category</FormLabel>
                                          <FormControl>
                                            <select
                                              {...field}
                                              className="h-11 w-full rounded-2xl border bg-background/60 px-3 text-sm"
                                            >
                                              {EVENT_CATEGORIES.map((c) => (
                                                <option key={c} value={c}>
                                                  {c}
                                                </option>
                                              ))}
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
                                          <FormLabel>Ends at</FormLabel>
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
                                      setMsg(null);
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
                                    {form.formState.isSubmitting ? "Creating..." : "Create & Publish"}
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
          </CardContent>
        </GlowBorder>

        {msg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        <GlowBorder>
          <CardContent className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 rounded-2xl"
                placeholder="Search event or organizer email..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-2xl border bg-background/60 backdrop-blur p-1 gap-1">
                {["all", "pending", "published", "draft", "completed", "cancelled"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={[
                      "px-3 py-1.5 text-xs rounded-xl transition-all duration-200 font-medium whitespace-nowrap",
                      status === s
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/40",
                    ].join(" ")}
                    onClick={() => setStatus(s)}
                  >
                    {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </GlowBorder>

        <GlowBorder>
          <CardContent className="p-4 sm:p-6 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonEventItem key={i} />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-10">
                No events found
              </div>
            ) : (
              filtered.map((ev) => (
                <div
                  key={ev.id}
                  className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold truncate">{ev.title}</div>
                      {statusBadge(ev)}
                      <Badge variant="outline" className="rounded-full">
                        {ev.category || "Others"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-3">
                      <span className="inline-flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        {ev.organizer?.full_name || "—"}
                      </span>
                      <span>{ev.organizer?.email}</span>
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {fmtDate(ev.starts_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => router.push(`/dashboard/events/${ev.id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Public
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() =>
                        router.push(`/dashboard/admin/events/${ev.id}`)
                      }
                    >
                      Manage
                    </Button>
                    {ev.status === "pending" && (
                      <Button
                        className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => updateStatus(ev.id, "published")}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    )}
                    {ev.status !== "published" && ev.status !== "pending" && (
                      <Button
                        className="rounded-2xl"
                        onClick={() => updateStatus(ev.id, "published")}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Publish
                      </Button>
                    )}
                    {ev.status !== "cancelled" && (
                      <Button
                        variant="destructive"
                        className="rounded-2xl"
                        onClick={() => updateStatus(ev.id, "cancelled")}
                      >
                        <Ban className="mr-2 h-4 w-4" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </GlowBorder>
      </div>
    </div >
  );
}