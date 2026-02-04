"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, ArrowRight, Ticket, Sparkles } from "lucide-react";

function GlowBorder({ children, className = "" }) {
  return (
    <div
      className={[
        "rounded-3xl p-px bg-linear-to-br",
        "from-primary/45 via-foreground/10 to-secondary/40",
        "shadow-sm hover:shadow-md transition-all duration-300",
        className,
      ].join(" ")}
    >
      <div className="rounded-3xl bg-card/80 backdrop-blur-md">{children}</div>
    </div>
  );
}

export default function PaymentSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Optional: small confetti or celebration effect (you can add confetti.js later)
    document.body.classList.add("celebrate");
    return () => document.body.classList.remove("celebrate");
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      {/* Background blobs - same as dashboard */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl animate-pulse-slow" />
        <div className="absolute top-20 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl animate-pulse-slow delay-500" />
        <div className="absolute -bottom-60 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <GlowBorder className="w-full max-w-lg animate-fade-in-up">
        <Card className="border-none shadow-none bg-transparent">
          <CardContent className="p-8 sm:p-10 text-center space-y-8">
            {/* Success Icon */}
            <div className="mx-auto relative w-24 h-24 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping-slow" />
              <CheckCircle2 className="h-20 w-20 text-primary animate-bounce-once" />
            </div>

            {/* Heading */}
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Payment Successful!
              </h1>
              <p className="text-lg text-muted-foreground">
                Thank you for your purchase
              </p>
            </div>

            {/* Message */}
            <div className="space-y-4">
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                Your tickets have been successfully processed.<br />
                They will appear in your dashboard shortly.
              </p>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
                <Sparkles className="h-4 w-4" />
                Processing usually takes a few seconds
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button
                size="lg"
                className="rounded-2xl px-8"
                onClick={() => router.push("/dashboard/attendee/tickets")}
              >
                <Ticket className="mr-2 h-5 w-5" />
                View My Tickets
              </Button>

              <Button
                variant="outline"
                size="lg"
                className="rounded-2xl px-8"
                onClick={() => router.push("/events")}
              >
                Browse More Events
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </GlowBorder>
    </div>
  );
}

