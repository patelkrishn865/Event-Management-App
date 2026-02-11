"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CalendarDays, MapPin, Send, Star } from "lucide-react";
import { GlowBorder } from "@/components/ui/glow-border";


function formatDate(iso) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return "-";
  }
}

export default function EventFeedbackPage() {
  const { id } = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [event, setEvent] = useState(null);
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [suggestions, setSuggestions] = useState("");
  const [userId, setUserId] = useState(null);
  const [eligibleTicketId, setEligibleTicketId] = useState(null);
  const [isCompleted, setIsCompleted] = useState(true);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const canSubmit = useMemo(
    () => rating >= 1 && rating <= 5 && !submitting,
    [rating, submitting]
  );

  async function load() {
    setLoading(true);
    setMsg(null);
    setAlreadySubmitted(false);

    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) {
      router.push("/auth/login");
      return;
    }
    setUserId(user.id);

    // Event
    const { data: ev, error: evErr } = await supabase
      .from("events")
      .select("id,title,starts_at,ends_at,location,status")
      .eq("id", id)
      .single();
    if (evErr) {
      setMsg(evErr.message);
      setLoading(false);
      return;
    }
    setEvent(ev);

    // Check if event is completed
    const now = new Date();
    const eventEnd = ev.ends_at ? new Date(ev.ends_at) : new Date(ev.starts_at);
    if (now < eventEnd) {
      setIsCompleted(false);
      setLoading(false);
      return;
    }

    const { data: existingFb, error: fbErr } = await supabase
      .from("event_feedback")
      .select("id")
      .eq("event_id", id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (fbErr) {
      setMsg(fbErr.message);
      setLoading(false);
      return;
    }
    if (existingFb?.id) {
      setAlreadySubmitted(true);
      setEligibleTicketId(null);
      setLoading(false);
      return;
    }

    const { data: tix, error: tErr } = await supabase
      .from("tickets")
      .select(
        `
        id,
        status,
        order:orders!inner ( buyer_id ),
        ticket_checkins!inner ( id )
      `
      )
      .eq("event_id", id)
      .eq("order.buyer_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tErr) {
      setMsg(tErr.message);
      console.log("Error in ticket select.")
      setLoading(false);
      return;
    }
    if (!tix?.id) {
      setMsg(
        "You can submit feedback only if you checked in to this event."
      );
      setEligibleTicketId(null);
    } else {
      setEligibleTicketId(tix.id);
    }

    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submit() {
    setMsg(null);
    if (!eligibleTicketId || !userId) return;

    setSubmitting(true);
    const { error } = await supabase.from("event_feedback").insert({
      event_id: id,
      ticket_id: eligibleTicketId,
      user_id: userId,
      rating,
      comments: comments.trim() || null,
      suggestions: suggestions.trim() || null,
    });
    setSubmitting(false);

    if (error) return setMsg(error.message);
    router.push(`/dashboard/events/${id}`);
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground p-6">Loading...</div>;
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute top-10 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl" />
        <div className="absolute -bottom-60 left-1/3 h-130w-130 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8 space-y-6">
        {/* Header */}
        <GlowBorder>
          <CardContent className="p-6 sm:p-8 relative overflow-hidden">
            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <Button
                  variant="outline"
                  className="rounded-2xl bg-background/55"
                  onClick={() => router.push(`/dashboard/events/${id}`)}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight">
                  Feedback
                </h1>
                <div className="mt-2 text-sm text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground truncate">
                    {event?.title || "Event"}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {event?.location || "—"}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {formatDate(event?.starts_at)}
                    </span>
                    {event?.status ? (
                      <Badge className="rounded-full" variant="secondary">
                        {event.status}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="rounded-full" variant="outline">
                  Rate 1–5
                </Badge>
              </div>
            </div>
          </CardContent>
        </GlowBorder>

        {msg && (
          <Alert className="rounded-2xl">
            <AlertDescription>{msg}</AlertDescription>
          </Alert>
        )}

        {/* Body */}
        <GlowBorder>
          <div className="p-6 sm:p-8">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-xl">Tell us how it was</CardTitle>
              <CardDescription>
                Your feedback helps organizers improve the next event.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0 space-y-6">
              {alreadySubmitted ? (
                <div className="rounded-2xl border bg-background/55 p-5">
                  <div className="text-base font-semibold">
                    Feedback already submitted ✅
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Thanks! You can go back to the event page.
                  </div>
                  <div className="mt-4">
                    <Button
                      className="rounded-2xl"
                      onClick={() => router.push(`/dashboard/events/${id}`)}
                    >
                      Back to Event
                    </Button>
                  </div>
                </div>
              ) : !isCompleted ? (
                <div className="rounded-2xl border bg-background/55 p-5">
                  <div className="text-base font-semibold">Event Not Over</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Feedback can only be submitted after the event has completed.
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => router.push(`/dashboard/events/${id}`)}
                    >
                      Back to Event
                    </Button>
                  </div>
                </div>
              ) : !eligibleTicketId ? (
                <div className="rounded-2xl border bg-background/55 p-5">
                  <div className="text-base font-semibold">Not eligible</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    You can submit feedback only if you checked in to this
                    event.
                  </div>
                  <div className="mt-4">
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      onClick={() => router.push("/dashboard/events")}
                    >
                      Browse Events
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Rating */}
                  <div className="rounded-2xl border bg-background/55 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">Rating</div>
                        <div className="text-xs text-muted-foreground">
                          Tap a star to rate the event
                        </div>
                      </div>
                      <Badge className="rounded-full" variant="secondary">
                        Selected: {rating}/5
                      </Badge>
                    </div>
                    <div className="mt-4 flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(n)}
                          className={[
                            "h-11 w-11 rounded-2xl border transition",
                            "flex items-center justify-center",
                            rating >= n
                              ? "bg-primary text-primary-foreground border-primary/40 shadow-sm"
                              : "bg-background/50 hover:bg-background border-border",
                          ].join(" ")}
                          aria-label={`Rate ${n}`}
                        >
                          <Star className="h-5 w-5" />
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Comments */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Comments (optional)
                    </div>
                    <Textarea
                      className="rounded-2xl min-h-30"
                      placeholder="What did you like or dislike?"
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                    />
                  </div>

                  {/* Suggestions */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium">
                      Suggestions (optional)
                    </div>
                    <Textarea
                      className="rounded-2xl min-h-30"
                      placeholder="Any improvements for the organizer?"
                      value={suggestions}
                      onChange={(e) => setSuggestions(e.target.value)}
                    />
                  </div>

                  <Button
                    className="w-full rounded-2xl"
                    disabled={!canSubmit}
                    onClick={submit}
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submitting ? "Submitting..." : "Submit feedback"}
                  </Button>

                  <div className="text-xs text-muted-foreground text-center">
                    Tip: keep it honest and helpful 🙂
                  </div>
                </>
              )}
            </CardContent>
          </div>
        </GlowBorder>
      </div>
    </div>
  );
}
