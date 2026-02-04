"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

import {
  ArrowLeft,
  CameraOff,
  RefreshCw,
  ShieldCheck,
  Keyboard,
  AlertCircle,
  Loader2,
} from "lucide-react";

function formatDateTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "—";
  }
}

function buildDeviceInfo() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return `ua=${navigator.userAgent}; tz=${tz}; lang=${navigator.language}`;
  } catch {
    return null;
  }
}

export default function StaffScanPage() {
  const { eventId } = useParams();
  const router = useRouter();
  const eventIdStr = String(eventId || "");

  const [authStatus, setAuthStatus] = useState("checking");
  const [msg, setMsg] = useState(null);
  const [scannerStatus, setScannerStatus] = useState("stopped");
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [history, setHistory] = useState([]);

  const scannerRef = useRef(null);
  const runningRef = useRef(false);
  const busyRef = useRef(false);
  const pauseTimerRef = useRef(null);

  function pushHistory(kind, title, subtitle) {
    setHistory((prev) => [
      { at: new Date().toISOString(), kind, title, subtitle },
      ...prev.slice(0, 9),
    ]);
  }

  useEffect(() => {
    async function verifyStaffAccess() {
      setAuthStatus("checking");

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAuthStatus("unauthorized");
        setMsg("Please log in to access the scanner.");
        setTimeout(() => router.replace("/auth/login"), 2500);
        return;
      }

      const { data: eventData } = await supabase
        .from("events")
        .select("organizer_id")
        .eq("id", eventIdStr)
        .single();

      if (!eventData) {
        setAuthStatus("error");
        setMsg("Event not found.");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile) {
        setAuthStatus("error");
        setMsg("Error loading profile.");
        return;
      }

      const isOrganizer = eventData.organizer_id === user.id;
      const isAdmin = profile.role === "admin";
      let isStaff = false;

      if (!isOrganizer && !isAdmin) {
        const { data: staff } = await supabase
          .from("event_staff")
          .select("event_id")
          .eq("event_id", eventIdStr)
          .eq("user_id", user.id)
          .maybeSingle();
        isStaff = !!staff;
      }

      if (isOrganizer || isAdmin || isStaff) {
        setAuthStatus("authorized");
        setMsg(isAdmin ? "Admin access" : isOrganizer ? "Organizer access" : "Staff access");
      } else {
        setAuthStatus("unauthorized");
        setMsg("No permission for this event.");
      }
    }

    verifyStaffAccess();
  }, [eventIdStr, router]);

  async function verifyPayload(payload) {
    if (!payload || busyRef.current) return;

    busyRef.current = true;
    setBusy(true);
    setScannerStatus("verifying");

    // Immediately stop scanning to avoid re-reading same code
    await stopScanner();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("No active session");

      const res = await fetch("/api/verify-qr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          qr_payload: payload,
          event_id: eventIdStr,
          device_info: buildDeviceInfo(),
        }),
      });

      const out = await res.json().catch(() => ({}));

      let nextStatus = "ready";
      let nextMsg = null;

      if (res.ok && out.ok) {
        nextStatus = "success";
        nextMsg = `✅ Checked in – Ticket ID: ${out.ticket_id}`;
        pushHistory("success", "Checked in", `Ticket ID: ${out.ticket_id}`);
      } else if (out.status === "not_valid_yet") {
        nextStatus = "warning";
        nextMsg = `⏳ Not valid yet. Valid from ${out.valid_for_date}`;
        pushHistory("warning", "Not valid yet", `From ${out.valid_for_date}`);
      } else if (out.status === "expired") {
        nextStatus = "error";
        nextMsg = `❌ Expired (was valid on ${out.valid_for_date})`;
        pushHistory("error", "Expired", `Was valid on ${out.valid_for_date}`);
      } else if (out.status === "already_checked_in") {
        nextStatus = "already";
        nextMsg = `⚠️ Already checked in at ${formatDateTime(out.checked_in_at)}`;
        pushHistory("already", "Already checked in", formatDateTime(out.checked_in_at));
      } else {
        nextStatus = "error";
        nextMsg = `❌ ${out.error || "Invalid QR code"}`;
        pushHistory("error", "Failed", out.error || "Invalid");
      }

      setScannerStatus(nextStatus);
      setMsg(nextMsg);

      // Pause longer after result so user can read it
      setTimeout(() => {
        if (authStatus === "authorized" && !busyRef.current) {
          startScanner();
        }
      }, 4500); // 4.5 seconds — enough to read message

    } catch (err) {
      setScannerStatus("error");
      setMsg(`❌ ${String(err)}`);
      pushHistory("error", "Error", String(err));

      setTimeout(() => {
        if (authStatus === "authorized" && !busyRef.current) {
          startScanner();
        }
      }, 3000);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function startScanner() {
    if (authStatus !== "authorized" || busy) return;

    setMsg(null);
    setScannerStatus("starting");

    await stopScanner();

    try {
      const qr = new Html5Qrcode("qr-reader");
      scannerRef.current = qr;
      runningRef.current = true;

      await qr.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        (decodedText) => {
          if (busyRef.current) return;
          verifyPayload(decodedText);
        },
        () => { }
      );

      setScannerStatus("ready");
      setMsg("Scanner active. Point at QR code.");
    } catch (e) {
      setScannerStatus("error");
      setMsg(`Camera error: ${String(e)}`);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        if (runningRef.current) await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch { }
    }

    runningRef.current = false;
    scannerRef.current = null;
    setScannerStatus("stopped");
  }

  function onManualSubmit(e) {
    e.preventDefault();
    const v = manual.trim();
    if (!v || !v.startsWith("v1.")) {
      setMsg("Invalid format – must start with v1.");
      return;
    }
    setManual("");
    verifyPayload(v);
  }

  useEffect(() => {
    if (authStatus === "authorized") {
      startScanner();
    }
    return () => stopScanner();
  }, [authStatus]);

  if (authStatus === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (authStatus !== "authorized") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">{msg}</p>
            <Button className="mt-4 w-full" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-6">
        <Card className="rounded-3xl border bg-card/80 backdrop-blur">
          <CardHeader className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" className="rounded-2xl bg-background/55" onClick={() => router.back()}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>

                <div className="flex items-center gap-2">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border bg-background/55">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Staff Scanner</CardTitle>
                    <CardDescription>Event ID: <span className="font-medium">{eventIdStr}</span></CardDescription>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={startScanner}
                  disabled={scannerStatus === "starting" || scannerStatus === "ready" || busy}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Restart
                </Button>

                {/* Stop button always enabled when scanner is running */}
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={stopScanner}
                  disabled={scannerStatus === "stopped" || scannerStatus === "starting"}
                >
                  <CameraOff className="mr-2 h-4 w-4" />
                  Stop
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="pb-6 space-y-6">
            <div className="rounded-3xl border bg-background/55 p-4">
              <div className="relative overflow-hidden rounded-2xl border bg-black aspect-square max-w-100 mx-auto">
                <div id="qr-reader" className="w-full h-full" />
                {scannerStatus === "ready" && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-72 h-72 border-4 border-primary/70 rounded-2xl animate-pulse-slow" />
                  </div>
                )}
              </div>

              <div className="mt-4 text-center text-sm font-medium min-h-12 flex items-center justify-center">
                {busy ? (
                  <span className="text-primary flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                  </span>
                ) : scannerStatus === "ready" ? (
                  "Point camera at QR code"
                ) : scannerStatus === "verifying" ? (
                  <span className="text-blue-600">Checking ticket...</span>
                ) : scannerStatus === "success" ? (
                  <span className="text-green-600 text-lg">✅ Check-in successful</span>
                ) : scannerStatus === "warning" ? (
                  <span className="text-amber-600 text-lg">{msg}</span>
                ) : scannerStatus === "already" ? (
                  <span className="text-yellow-600">{msg}</span>
                ) : scannerStatus === "error" ? (
                  <span className="text-destructive text-lg">{msg}</span>
                ) : (
                  ""
                )}
              </div>
            </div>

            <Card className="rounded-3xl border bg-background/55">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Keyboard className="h-4 w-4" />
                  Manual QR entry
                </CardTitle>
                <CardDescription>Paste full payload (starts with v1.)</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={onManualSubmit} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={manual}
                    onChange={(e) => setManual(e.target.value)}
                    placeholder="v1.TICKETCODE.abcdef1234567890"
                    className="rounded-2xl flex-1"
                    disabled={busy}
                  />
                  <Button type="submit" className="rounded-2xl" disabled={busy || !manual.trim()}>
                    Verify
                  </Button>
                </form>
              </CardContent>
            </Card>

            {history.length > 0 && (
              <div className="rounded-3xl border bg-background/55 p-4">
                <div className="text-sm font-medium mb-3">Recent scans</div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {history.map((h, i) => (
                    <div
                      key={`${h.at}-${i}`}
                      className="rounded-2xl border bg-card/70 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="font-medium">
                          {h.kind === "success" ? "✅" : h.kind === "warning" ? "⏳" : h.kind === "already" ? "⚠️" : "❌"} {h.title}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(h.at)}
                        </div>
                      </div>
                      {h.subtitle && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {h.subtitle}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}