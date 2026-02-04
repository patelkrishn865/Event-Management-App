"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import z from "zod";

import {
  ArrowLeft,
  ExternalLink,
  Users,
  MessageSquare,
  Ticket,
  ShieldCheck,
  Copy,
  Image as ImageIcon,
  CalendarDays,
  MapPin,
  Save,
  Edit,
  Trash2,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

const STORAGE_BUCKET = "event-banners";

const eventEditSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().max(2000).optional().or(z.literal("")),
  location: z.string().max(200).optional().or(z.literal("")),
  banner_url: z.string().optional().or(z.literal("")),
  startsAt: z.string().min(1, "Start date/time required"),
  endsAt: z.string().optional().or(z.literal("")),
  status: z.enum(["draft", "published", "cancelled", "completed"]),
});

const ticketTypeSchema = z.object({
  name: z.string().min(2, "Name is required"),
  price_rupees: z.coerce.number().min(1, "Min ₹1"),
  capacity: z.coerce.number().min(0),
  currency: z.string().min(3).max(3).default("INR"),
  sale_starts_at: z.string().optional().or(z.literal("")),
  sale_ends_at: z.string().optional().or(z.literal("")),
});

const staffSchema = z.object({
  email: z.string().email("Valid email required"),
  staff_role: z.enum(["staff", "manager"]).default("staff"),
});

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function formatMoneyINRPaise(paise) {
  const n = Number(paise || 0);
  return `₹ ${(n / 100).toFixed(2)}`;
}

function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function extFromFile(file) {
  const ext = file?.name?.split(".").pop()?.toLowerCase();
  return ext && ext.length <= 6 ? ext : "png";
}

function safeFileName(name = "") {
  return name.toLowerCase().replace(/[^a-z0-9-_.]/g, "-");
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

// ── Skeleton for Header Card ───────────────────────────────────────────────
function SkeletonHeaderCard() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
        <div className="space-y-3">
          <div className="h-10 w-32 bg-muted rounded-2xl" />
          <div className="h-10 w-64 bg-muted rounded-lg" />
          <div className="flex flex-wrap gap-2">
            <div className="h-6 w-24 bg-muted rounded-full" />
            <div className="h-6 w-32 bg-muted rounded-full" />
            <div className="h-6 w-28 bg-muted rounded-full" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="h-10 w-32 bg-muted rounded-2xl" />
          <div className="h-10 w-32 bg-muted rounded-2xl" />
          <div className="h-10 w-32 bg-muted rounded-2xl" />
          <div className="h-10 w-32 bg-muted rounded-2xl" />
        </div>
      </div>
    </div>
  );
}

// ── Skeleton for Overview Quick Links & Status ─────────────────────────────
function SkeletonOverview() {
  return (
    <div className="grid gap-4 lg:grid-cols-3 animate-pulse">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border bg-background/55 p-4 space-y-4">
          <div className="h-7 w-48 bg-muted rounded" />
          <div className="space-y-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-background/60 p-4 space-y-2">
                <div className="h-5 w-48 bg-muted rounded" />
                <div className="h-4 w-96 bg-muted rounded" />
                <div className="flex gap-2">
                  <div className="h-9 w-28 bg-muted rounded-2xl" />
                  <div className="h-9 w-28 bg-muted rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border bg-background/55 p-4 space-y-4">
          <div className="h-7 w-32 bg-muted rounded" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border bg-background/60 p-4">
                <div className="h-4 w-32 bg-muted rounded mb-2" />
                <div className="h-8 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton for Details Form ──────────────────────────────────────────────
function SkeletonDetailsForm() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-11 w-full bg-muted rounded-2xl" />
          </div>
        ))}
      </div>
      <div className="h-11 w-40 bg-muted rounded-2xl" />
    </div>
  );
}

// ── Skeleton for Tickets Table ─────────────────────────────────────────────
function SkeletonTicketsTable() {
  return (
    <div className="animate-pulse">
      <div className="rounded-3xl bg-card/80 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-b bg-background/40">
              {Array.from({ length: 6 }).map((_, i) => (
                <TableHead key={i}>
                  <div className="h-5 w-20 bg-muted rounded" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i} className="border-b last:border-none">
                {Array.from({ length: 6 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-5 w-32 bg-muted rounded" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Skeleton for Staff Section ─────────────────────────────────────────────
function SkeletonStaffSection() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-11 w-full bg-muted rounded-2xl" />
          </div>
        ))}
        <div className="flex items-end">
          <div className="h-10 w-32 bg-muted rounded-2xl" />
        </div>
      </div>

      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-2xl border bg-background/55 p-4">
            <div className="space-y-2">
              <div className="h-5 w-48 bg-muted rounded" />
              <div className="h-4 w-64 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 w-24 bg-muted rounded-full" />
              <div className="h-9 w-28 bg-muted rounded-2xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrganizerEventManagePage() {
  const { id } = useParams();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState("overview");

  const [loading, setLoading] = useState(true);
  const [serverMsg, setServerMsg] = useState(null);

  const [event, setEvent] = useState(null);
  const [ticketTypes, setTicketTypes] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [editingTicketId, setEditingTicketId] = useState(null);

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [bannerPreview, setBannerPreview] = useState(null);

  const eventForm = useForm({
    resolver: zodResolver(eventEditSchema),
    defaultValues: {
      title: "",
      description: "",
      location: "",
      banner_url: "",
      startsAt: "",
      endsAt: "",
      status: "draft",
    },
    mode: "onChange",
  });

  const ticketForm = useForm({
    resolver: zodResolver(ticketTypeSchema),
    defaultValues: {
      name: "General",
      price_rupees: 199,
      capacity: 100,
      currency: "INR",
      sale_starts_at: "",
      sale_ends_at: "",
      is_active: true,
    },
    mode: "onChange",
  });

  const staffForm = useForm({
    resolver: zodResolver(staffSchema),
    defaultValues: { email: "", staff_role: "staff" },
    mode: "onChange",
  });

  const canSaveEvent = useMemo(
    () => eventForm.formState.isValid && !eventForm.formState.isSubmitting,
    [eventForm.formState.isValid, eventForm.formState.isSubmitting]
  );

  const canAddTicket = useMemo(
    () => ticketForm.formState.isValid && !ticketForm.formState.isSubmitting,
    [ticketForm.formState.isValid, ticketForm.formState.isSubmitting]
  );

  const canAddStaff = useMemo(
    () => staffForm.formState.isValid && !staffForm.formState.isSubmitting,
    [staffForm.formState.isValid, staffForm.formState.isSubmitting]
  );

  const publicEventUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/events/${id}`;
  }, [id]);

  const staffScanUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/staff/scan/${id}`;
  }, [id]);

  const stats = useMemo(() => {
    const totalTypes = ticketTypes.length;
    const activeTypes = ticketTypes.filter((t) => t.is_active).length;
    const staffCount = staffList.length;
    return { totalTypes, activeTypes, staffCount };
  }, [ticketTypes, staffList]);

  async function loadAll() {
    setLoading(true);
    setServerMsg(null);

    const { data: sessionWrap } = await supabase.auth.getSession();
    const session = sessionWrap?.session;
    if (!session?.user) return router.replace("/auth/login");

    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (evErr) {
      setServerMsg(evErr.message);
      setLoading(false);
      return;
    }

    setEvent(ev);

    eventForm.reset({
      title: ev.title || "",
      description: ev.description || "",
      location: ev.location || "",
      banner_url: ev.banner_url || "",
      startsAt: toLocalInputValue(ev.starts_at),
      endsAt: toLocalInputValue(ev.ends_at),
      status: ev.status || "draft",
    });

    const { data: tt, error: ttErr } = await supabase
      .from("ticket_types")
      .select("*")
      .eq("event_id", id)
      .order("created_at", { ascending: true });

    if (ttErr) setServerMsg(ttErr.message);
    setTicketTypes(tt || []);

    const { data: staffRows, error: sErr } = await supabase
      .from("event_staff")
      .select(
        `
        user_id, staff_role, created_at,
        profile:profiles!event_staff_user_id_fkey ( id, full_name, email )
      `
      )
      .eq("event_id", id)
      .order("created_at", { ascending: false });

    if (sErr) setServerMsg(sErr.message);
    setStaffList(staffRows || []);

    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, [id]);

  useEffect(() => {
    return () => {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    };
  }, [bannerPreview]);

  async function saveEvent(values) {
    setServerMsg(null);

    const startsIso = new Date(values.startsAt).toISOString();
    const endsIso = values.endsAt
      ? new Date(values.endsAt).toISOString()
      : null;

    const { error } = await supabase
      .from("events")
      .update({
        title: values.title.trim(),
        description: values.description?.trim() || null,
        location: values.location?.trim() || null,
        banner_url: values.banner_url?.trim() || null,
        starts_at: startsIso,
        ends_at: endsIso,
        status: values.status,
      })
      .eq("id", id);

    if (error) setServerMsg(error.message);
    await loadAll();
  }

  async function uploadBanner(file) {
    if (!file) return;

    setServerMsg(null);

    if (!file.type.startsWith("image/"))
      return setServerMsg("Please select an image file.");
    if (file.size > 5 * 1024 * 1024) return setServerMsg("Max 5MB allowed.");

    try {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      setBannerPreview(URL.createObjectURL(file));
    } catch {}

    setUploadingBanner(true);

    try {
      const ext = extFromFile(file);
      const path = `${id}/${Date.now()}-${safeFileName(file.name || "banner")}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (upErr) return setServerMsg(upErr.message);

      const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      const publicUrl = data?.publicUrl;

      if (!publicUrl) return setServerMsg("Upload done but URL not generated.");

      const { error: dbErr } = await supabase
        .from("events")
        .update({ banner_url: publicUrl })
        .eq("id", id);
      if (dbErr) return setServerMsg(dbErr.message);

      eventForm.setValue("banner_url", publicUrl, {
        shouldDirty: true,
        shouldValidate: true,
      });
      setServerMsg("Banner uploaded ✅");
      await loadAll();
    } finally {
      setUploadingBanner(false);
    }
  }

  async function clearBanner() {
    setServerMsg(null);
    eventForm.setValue("banner_url", "", {
      shouldDirty: true,
      shouldValidate: true,
    });

    try {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
    } catch {}
    setBannerPreview(null);

    const { error } = await supabase
      .from("events")
      .update({ banner_url: null })
      .eq("id", id);

    if (error) setServerMsg(error.message);
    else {
      setServerMsg("Banner cleared ✅");
      await loadAll();
    }
  }

  async function addTicketType(values) {
    setServerMsg(null);

    const price_cents = Math.round(Number(values.price_rupees) * 100);
    const sale_starts_at = values.sale_starts_at
      ? new Date(values.sale_starts_at).toISOString()
      : null;
    const sale_ends_at = values.sale_ends_at
      ? new Date(values.sale_ends_at).toISOString()
      : null;

    if (editingTicketId) {
      const { error } = await supabase
        .from("ticket_types")
        .update({
          name: values.name.trim(),
          price_cents,
          capacity: values.capacity,
          currency: values.currency,
          sale_starts_at,
          sale_ends_at,
          is_active: values.is_active,
        })
        .eq("id", editingTicketId);

      if (error) return setServerMsg(error.message);
      setServerMsg("Ticket type updated successfully!");
      setEditingTicketId(null);
    } else {
      const { error } = await supabase.from("ticket_types").insert({
        event_id: id,
        name: values.name.trim(),
        price_cents,
        capacity: values.capacity,
        currency: values.currency,
        sale_starts_at,
        sale_ends_at,
        is_active: values.is_active,
      });

      if (error) return setServerMsg(error.message);
      setServerMsg("Ticket type added successfully!");
    }

    ticketForm.reset({
      name: "General",
      price_rupees: 199,
      capacity: 100,
      currency: "INR",
      sale_starts_at: "",
      sale_ends_at: "",
    });

    await loadAll();
  }

  function startEditTicket(ticket) {
    setEditingTicketId(ticket.id);
    ticketForm.reset({
      name: ticket.name,
      price_rupees: ticket.price_cents / 100,
      capacity: ticket.capacity,
      currency: ticket.currency,
      sale_starts_at: toLocalInputValue(ticket.sale_starts_at),
      sale_ends_at: toLocalInputValue(ticket.sale_ends_at),
      is_active: ticket.is_active,
    });
  }

  function cancelEdit() {
    setEditingTicketId(null);
    ticketForm.reset({
      name: "General",
      price_rupees: 199,
      capacity: 100,
      currency: "INR",
      sale_starts_at: "",
      sale_ends_at: "",
      is_active: true,
    });
  }

  async function toggleTicketActive(t) {
    setServerMsg(null);

    const { error } = await supabase
      .from("ticket_types")
      .update({ is_active: !t.is_active })
      .eq("id", t.id);

    if (error) return setServerMsg(error.message);
    await loadAll();
  }

  async function deleteTicketType(tid) {
    setServerMsg(null);

    const { error } = await supabase
      .from("ticket_types")
      .delete()
      .eq("id", tid);

    if (error) {
      if (error.code === "23503") {
        return setServerMsg(
          "This ticket type has sales. You can only Disable it, not delete."
        );
      }
      return setServerMsg(error.message);
    }

    await loadAll();
  }

  async function assignStaff(values) {
    setServerMsg(null);
    const email = values.email.toLowerCase().trim();

    const { data: staffUserId, error: rpcErr } = await supabase.rpc(
      "get_user_id_by_email",
      { p_email: email }
    );

    if (rpcErr) return setServerMsg(rpcErr.message);
    if (!staffUserId)
      return setServerMsg(
        "No user found with this email. Ask them to sign up first."
      );

    const { error: insErr } = await supabase.from("event_staff").insert({
      event_id: id,
      user_id: staffUserId,
      staff_role: values.staff_role,
    });

    if (insErr) {
      if (insErr.code === "23505")
        return setServerMsg("Already added as staff.");
      return setServerMsg(insErr.message);
    }

    staffForm.reset({ email: "", staff_role: "staff" });
    await loadAll();
  }

  async function removeStaff(userId) {
    setServerMsg(null);

    const { error } = await supabase
      .from("event_staff")
      .delete()
      .eq("event_id", id)
      .eq("user_id", userId);

    if (error) return setServerMsg(error.message);
    await loadAll();
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      setServerMsg("Copied to clipboard ✅");
      setTimeout(() => setServerMsg(null), 1200);
    } catch {
      setServerMsg("Copy failed. Please copy manually.");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl" />
          <div className="absolute top-10 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl" />
          <div className="absolute -bottom-60 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
          {/* Header Skeleton */}
          <GlowBorder>
            <CardContent className="p-6 sm:p-8 animate-pulse">
              <SkeletonHeaderCard />
            </CardContent>
          </GlowBorder>

          {/* Tabs Skeleton */}
          <GlowBorder>
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 w-32 bg-muted rounded-2xl" />
                ))}
              </div>
            </CardContent>
          </GlowBorder>

          {/* Tab Content Skeleton */}
          <GlowBorder>
            <div className="p-6 animate-pulse">
              {/* Overview tab skeleton */}
              {activeTab === "overview" && <SkeletonOverview />}

              {/* Details tab skeleton */}
              {activeTab === "details" && <SkeletonDetailsForm />}

              {/* Tickets tab skeleton */}
              {activeTab === "tickets" && <SkeletonTicketsTable />}

              {/* Staff tab skeleton */}
              {activeTab === "staff" && <SkeletonStaffSection />}
            </div>
          </GlowBorder>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-6 space-y-3">
        <p className="text-sm text-destructive">
          {serverMsg || "Event not found"}
        </p>
        <Button
          variant="outline"
          onClick={() => router.push("/dashboard/organizer/events")}
        >
          Back
        </Button>
      </div>
    );
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
        {/* Header */}
        <GlowBorder>
          <CardContent className="p-6 sm:p-8 relative overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-secondary/10" />
  
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push("/dashboard/organizer/events")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
  
                <h1 className="mt-4 text-3xl font-semibold tracking-tight truncate">
                  {event.title}
                </h1>
  
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
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
                </div>
  
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Badge className="rounded-full" variant="secondary">
                    {event.status}
                  </Badge>
                  <Badge className="rounded-full" variant="outline">
                    Ticket types: {stats.activeTypes}/{stats.totalTypes}
                  </Badge>
                  <Badge className="rounded-full" variant="outline">
                    Staff: {stats.staffCount}
                  </Badge>
                </div>
              </div>
  
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() =>
                    router.push(`/dashboard/organizer/events/${id}/attendees`)
                  }
                >
                  <Users className="mr-2 h-4 w-4" />
                  Attendees
                </Button>
  
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() =>
                    router.push(`/dashboard/organizer/events/${id}/feedback`)
                  }
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Feedback
                </Button>
  
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => window.open(publicEventUrl, "_blank")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Public Page
                </Button>
  
                <Button
                  className="rounded-2xl"
                  onClick={() => router.push(`/staff/scan/${id}`)}
                >
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Staff Scan
                </Button>
              </div>
            </div>
          </CardContent>
        </GlowBorder>
  
        {serverMsg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{serverMsg}</AlertDescription>
          </Alert>
        )}
  
        {/* Tabs */}
        <GlowBorder>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="rounded-2xl"
                variant={activeTab === "overview" ? "default" : "outline"}
                onClick={() => setActiveTab("overview")}
              >
                Overview
              </Button>
              <Button
                type="button"
                className="rounded-2xl"
                variant={activeTab === "details" ? "default" : "outline"}
                onClick={() => setActiveTab("details")}
              >
                Details
              </Button>
              <Button
                type="button"
                className="rounded-2xl"
                variant={activeTab === "tickets" ? "default" : "outline"}
                onClick={() => setActiveTab("tickets")}
              >
                <Ticket className="mr-2 h-4 w-4" />
                Ticket Types
              </Button>
              <Button
                type="button"
                className="rounded-2xl"
                variant={activeTab === "staff" ? "default" : "outline"}
                onClick={() => setActiveTab("staff")}
              >
                <Users className="mr-2 h-4 w-4" />
                Staff
              </Button>
            </div>
          </CardContent>
        </GlowBorder>
  
        {/* Overview */}
        {activeTab === "overview" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <GlowBorder className="lg:col-span-2">
              <div className="p-4 py-6">
                <CardHeader>
                  <CardTitle className="text-xl">Quick links</CardTitle>
                  <CardDescription>
                    Share links with attendees and staff.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 my-3">
                  <div className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium">Public event page</div>
                      <div className="text-xs text-muted-foreground break-all">
                        {publicEventUrl}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => copy(publicEventUrl)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        className="rounded-2xl"
                        onClick={() => window.open(publicEventUrl, "_blank")}
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                    </div>
                  </div>
  
                  <div className="rounded-2xl border bg-background/55 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium">Staff scan link</div>
                      <div className="text-xs text-muted-foreground break-all">
                        {staffScanUrl}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => copy(staffScanUrl)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        className="rounded-2xl"
                        onClick={() => router.push(`/staff/scan/${id}`)}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Open
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </div>
            </GlowBorder>
  
            <GlowBorder>
              <div className="p-4 py-6">
                <CardHeader>
                  <CardTitle className="text-xl">Status</CardTitle>
                  <CardDescription>At a glance</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 py-3">
                  <div className="rounded-2xl border bg-background/55 p-4">
                    <div className="text-xs text-muted-foreground">
                      Event status
                    </div>
                    <div className="mt-2">
                      {event.status ? (
                        <Badge className="rounded-full">{event.status}</Badge>
                      ) : (
                        "—"
                      )}
                    </div>
                  </div>
  
                  <div className="rounded-2xl border bg-background/55 p-4">
                    <div className="text-xs text-muted-foreground">
                      Ticket types
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {stats.activeTypes} active / {stats.totalTypes} total
                    </div>
                  </div>
  
                  <div className="rounded-2xl border bg-background/55 p-4">
                    <div className="text-xs text-muted-foreground">
                      Staff assigned
                    </div>
                    <div className="mt-1 text-lg font-semibold">
                      {stats.staffCount}
                    </div>
                  </div>
                </CardContent>
              </div>
            </GlowBorder>
          </div>
        )}
  
        {/* Details */}
        {activeTab === "details" && (
          <GlowBorder>
            <div className="p-4 py-6">
              <CardHeader>
                <CardTitle className="text-xl">Event details</CardTitle>
                <CardDescription>
                  Update details and publish when ready.
                </CardDescription>
              </CardHeader>
  
              <CardContent>
                <Form {...eventForm}>
                  <form
                    onSubmit={eventForm.handleSubmit(saveEvent)}
                    className="grid gap-4"
                  >
                    <div className="grid my-3 grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={eventForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Title</FormLabel>
                            <FormControl>
                              <Input
                                className="rounded-2xl"
                                value={field.value ?? ""}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
  
                      <FormField
                        control={eventForm.control}
                        name="location"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Location</FormLabel>
                            <FormControl>
                              <Input
                                className="rounded-2xl"
                                value={field.value ?? ""}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
  
                      {/* ✅ Banner Upload + Preview */}
                      <FormField
                        control={eventForm.control}
                        name="banner_url"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Banner</FormLabel>
  
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="rounded-2xl border bg-background/55 p-3">
                                <div className="flex items-center gap-2">
                                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                                  <div className="text-sm font-medium">
                                    Upload from device
                                  </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  JPG/PNG/WebP • max 5MB
                                </p>
  
                                <Input
                                  type="file"
                                  accept="image/*"
                                  className="mt-3 rounded-2xl"
                                  disabled={uploadingBanner}
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) uploadBanner(f);
                                    e.target.value = "";
                                  }}
                                />
  
                                <div className="mt-3 flex gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl"
                                    disabled={
                                      uploadingBanner ||
                                      (!field.value && !bannerPreview)
                                    }
                                    onClick={clearBanner}
                                  >
                                    Clear
                                  </Button>
  
                                  <Button
                                    type="button"
                                    className="rounded-2xl"
                                    disabled
                                  >
                                    {uploadingBanner
                                      ? "Uploading..."
                                      : "Auto upload"}
                                  </Button>
                                </div>
  
                                {field.value ? (
                                  <p className="mt-3 text-[11px] text-muted-foreground break-all">
                                    Stored URL: {field.value}
                                  </p>
                                ) : null}
                              </div>
  
                              <div className="rounded-2xl border bg-background/55 p-3">
                                <div className="text-sm font-medium">
                                  Preview
                                </div>
  
                                {bannerPreview || field.value ? (
                                  <div className="mt-3 rounded-2xl overflow-hidden border">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={bannerPreview || field.value}
                                      alt="Banner preview"
                                      className="h-48 w-full object-cover"
                                    />
                                  </div>
                                ) : (
                                  <div className="mt-3 h-48 rounded-2xl border flex items-center justify-center text-xs text-muted-foreground">
                                    No banner selected
                                  </div>
                                )}
                              </div>
                            </div>
  
                            <FormMessage />
                          </FormItem>
                        )}
                      />
  
                      <FormField
                        control={eventForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem className="sm:col-span-2">
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                className="rounded-2xl min-h-27.5"
                                value={field.value ?? ""}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
  
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:col-span-2">
                        <FormField
                          control={eventForm.control}
                          name="startsAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Starts at</FormLabel>
                              <FormControl>
                                <Input
                                  className="rounded-2xl"
                                  type="datetime-local"
                                  value={field.value ?? ""}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
  
                        <FormField
                          control={eventForm.control}
                          name="endsAt"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Ends at (optional)</FormLabel>
                              <FormControl>
                                <Input
                                  className="rounded-2xl"
                                  type="datetime-local"
                                  value={field.value ?? ""}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
  
                        <FormField
                          control={eventForm.control}
                          name="status"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Status</FormLabel>
                              <FormControl>
                                <select
                                  {...field}
                                  className="h-11 w-full rounded-2xl border bg-background px-3 text-sm"
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
  
                      <div className="sm:col-span-2 flex flex-wrap gap-2">
                        <Button
                          type="submit"
                          disabled={!canSaveEvent}
                          className="rounded-2xl"
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {eventForm.formState.isSubmitting
                            ? "Saving..."
                            : "Save changes"}
                        </Button>
  
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl"
                          onClick={() => window.open(publicEventUrl, "_blank")}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Preview public page
                        </Button>
                      </div>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </div>
          </GlowBorder>
        )}
  
        {/* Ticket Types */}
        {activeTab === "tickets" && (
          <GlowBorder>
            <div className="p-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Ticket Types</CardTitle>
                <CardDescription>
                  Create and manage ticket tiers.
                </CardDescription>
              </CardHeader>
  
              <CardContent className="space-y-6">
                {/* Add / Edit Form */}
                <Form {...ticketForm}>
                  <form
                    onSubmit={ticketForm.handleSubmit(addTicketType)}
                    className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
                  >
                    <FormField
                      control={ticketForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input
                              className="rounded-2xl"
                              {...field}
                              placeholder="General / VIP / Early Bird"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
  
                    <FormField
                      control={ticketForm.control}
                      name="price_rupees"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (₹)</FormLabel>
                          <FormControl>
                            <Input
                              className="rounded-2xl"
                              type="number"
                              min={0}
                              step={1}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
  
                    <FormField
                      control={ticketForm.control}
                      name="capacity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Capacity (0 = unlimited)</FormLabel>
                          <FormControl>
                            <Input
                              className="rounded-2xl"
                              type="number"
                              min={0}
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
  
                    <FormField
                      control={ticketForm.control}
                      name="sale_starts_at"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale starts (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              className="rounded-2xl"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
  
                    <FormField
                      control={ticketForm.control}
                      name="sale_ends_at"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sale ends (optional)</FormLabel>
                          <FormControl>
                            <Input
                              type="datetime-local"
                              className="rounded-2xl"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
  
                    <FormField
                      control={ticketForm.control}
                      name="is_active"
                      render={({ field }) => (
                        <FormItem className="flex items-center ml-4 gap-2 pt-6 md:col-span-1">
                          <FormControl>
                            <Checkbox
                              checked
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel>Active</FormLabel>
                        </FormItem>
                      )}
                    />
  
                    <div className="md:col-span-3 lg:col-span-3 flex flex-wrap gap-3 pt-2">
                      <Button
                        type="submit"
                        className="rounded-2xl"
                        disabled={ticketForm.formState.isSubmitting}
                      >
                        {editingTicketId
                          ? "Update Ticket Type"
                          : "Add Ticket Type"}
                      </Button>
  
                      {editingTicketId && (
                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-2xl"
                          onClick={cancelEdit}
                        >
                          <X className="mr-2 h-4 w-4" />
                          Cancel Edit
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
  
                <Separator className="my-6" />
  
                {ticketTypes.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    No ticket types created yet. Add one above.
                  </div>
                ) : (
                  <GlowBorder>
  <div className="rounded-3xl bg-card/80 backdrop-blur overflow-hidden">
    <Table>
      <TableHeader>
        <TableRow className="border-b bg-background/40">
          <TableHead className="text-center text-xs font-medium text-muted-foreground py-4">
            Type
          </TableHead>
          <TableHead className="text-center text-xs font-medium text-muted-foreground py-4">
            Price
          </TableHead>
          <TableHead className="text-center text-xs font-medium text-muted-foreground py-4">
            Capacity
          </TableHead>
          <TableHead className="text-center text-xs font-medium text-muted-foreground py-4">
            Sale Period
          </TableHead>
          <TableHead className="text-center text-xs font-medium text-muted-foreground py-4">
            Status
          </TableHead>
          <TableHead className="text-right text-xs font-medium text-muted-foreground py-4 pr-6">
            Actions
          </TableHead>
        </TableRow>
      </TableHeader>
  
      <TableBody>
        {ticketTypes.map((t) => (
          <TableRow
            key={t.id}
            className="border-b last:border-none hover:bg-accent/20 transition"
          >
            {/* Type */}
            <TableCell className="text-center font-medium py-5">
              {t.name}
            </TableCell>
  
            {/* Price */}
            <TableCell className="text-center py-5 font-medium">
              {formatMoneyINRPaise(t.price_cents)}
            </TableCell>
  
            {/* Capacity */}
            <TableCell className="text-center py-5 text-sm">
              {t.capacity === 0 ? (
                <span className="italic text-muted-foreground">Unlimited</span>
              ) : (
                t.capacity
              )}
            </TableCell>
  
            {/* Sale period */}
            <TableCell className="text-center py-5 text-xs text-muted-foreground leading-relaxed">
              {t.sale_starts_at || t.sale_ends_at ? (
                <>
                  {t.sale_starts_at && (
                    <div>Starts: {formatDateTime(t.sale_starts_at)}</div>
                  )}
                  {t.sale_starts_at && t.sale_ends_at && (
                    <div className="opacity-40 my-0.5">—</div>
                  )}
                  {t.sale_ends_at && (
                    <div>Ends: {formatDateTime(t.sale_ends_at)}</div>
                  )}
                </>
              ) : (
                <span className="italic opacity-70">Always open</span>
              )}
            </TableCell>
  
            {/* Status */}
            <TableCell className="text-center py-5">
              <Badge
                variant={t.is_active ? "default" : "secondary"}
                className="rounded-full px-3 py-1 text-xs"
              >
                {t.is_active ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
  
            {/* Actions */}
            <TableCell className="text-right py-5 pr-6">
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl bg-background/60"
                  onClick={() => startEditTicket(t)}
                >
                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>
  
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-2xl bg-background/60"
                  onClick={() => toggleTicketActive(t)}
                >
                  {t.is_active ? "Disable" : "Enable"}
                </Button>
  
                <Button
                  variant="outline"
                  size="icon"
                  className="rounded-2xl bg-background/60 text-destructive hover:bg-destructive/10"
                  onClick={() => deleteTicketType(t.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
  </GlowBorder>
  
                )}
              </CardContent>
            </div>
          </GlowBorder>
        )}
  
        {/* Staff */}
        {activeTab === "staff" && (
          <GlowBorder>
            <div className="p-4 py-6">
              <CardHeader>
                <CardTitle className="text-xl">Event staff</CardTitle>
                <CardDescription>
                  Assign staff who can scan/check-in tickets.
                </CardDescription>
              </CardHeader>
  
              <CardContent className="space-y-4 my-3">
                <Form {...staffForm}>
                  <form
                    onSubmit={staffForm.handleSubmit(assignStaff)}
                    className="grid gap-4 md:grid-cols-4"
                  >
                    <FormField
                      control={staffForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Staff email</FormLabel>
                          <FormControl>
                            <Input
                              className="rounded-2xl"
                              {...field}
                              value={field.value ?? ""}
                              placeholder="staff@example.com"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
  
                    <FormField
                      control={staffForm.control}
                      name="staff_role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <FormControl>
                            <select
                              {...field}
                              className="h-11 w-full rounded-2xl border bg-background px-3 text-sm"
                            >
                              <option value="staff">staff</option>
                              <option value="manager">manager</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
  
                    <div className="flex items-end">
                      <Button
                        type="submit"
                        disabled={!canAddStaff}
                        className="rounded-2xl"
                      >
                        {staffForm.formState.isSubmitting
                          ? "Adding..."
                          : "Add staff"}
                      </Button>
                    </div>
                  </form>
                </Form>
  
                <Separator />
  
                {staffList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No staff assigned yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {staffList.map((s) => (
                      <div
                        key={s.user_id}
                        className="flex items-center justify-between rounded-2xl border bg-background/55 p-4"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {s.profile?.full_name || "—"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {s.profile?.email || "—"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="rounded-full" variant="secondary">
                            {s.staff_role}
                          </Badge>
                          <Button
                            variant="destructive"
                            className="rounded-2xl"
                            onClick={() => removeStaff(s.user_id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
  
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => copy(staffScanUrl)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Staff Scan Link
                  </Button>
                  <Button
                    className="rounded-2xl"
                    onClick={() => router.push(`/staff/scan/${id}`)}
                  >
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Open Scanner
                  </Button>
                </div>
              </CardContent>
            </div>
          </GlowBorder>
        )}
      </div>
    </div>
  );
}
