"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { Mail, ArrowLeft, KeyRound, Loader2 } from "lucide-react";
import { GlowBorder } from "@/components/ui/glow-border";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
});


export default function ForgotPasswordPage() {
  const router = useRouter();
  const [serverMsg, setServerMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
    mode: "onChange",
  });

  const canSubmit = useMemo(
    () => form.formState.isValid && !form.formState.isSubmitting && !loading,
    [form.formState.isValid, form.formState.isSubmitting, loading]
  );

  async function onSubmit(values) {
    setServerMsg(null);
    setLoading(true);

    try {
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/reset-password`
          : "https://event-management-app-lac-pi.vercel.app/auth/reset-password";

      const { error } = await supabase.auth.resetPasswordForEmail(values.email.trim(), {
        redirectTo,
      });

      if (error) throw error;

      setServerMsg("If an account exists, you will receive a verification code. Redirecting to verification...");

      // Redirect to OTP verification page after a short delay
      setTimeout(() => {
        router.push(`/auth/verify-otp?email=${encodeURIComponent(values.email.trim())}`);
      }, 2000);
    } catch (err) {
      setServerMsg(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      {/* Background blobs — same as login/signup/dashboard */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl animate-pulse-slow" />
        <div className="absolute top-20 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl animate-pulse-slow delay-500" />
        <div className="absolute -bottom-60 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <GlowBorder className="w-full max-w-lg animate-fade-in-up">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="space-y-4 text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              Forgot Password
            </CardTitle>
            <CardDescription className="text-base">
              We'll send you a code to reset your password
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {serverMsg && (
              <Alert
                variant={serverMsg.includes("sent") ? "default" : "destructive"}
                className="rounded-2xl"
              >
                <AlertDescription className="text-center">{serverMsg}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="you@example.com"
                            autoComplete="email"
                            className="rounded-2xl h-11 pl-10"
                            {...field}
                          />
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full rounded-2xl h-11 font-medium"
                  disabled={!canSubmit || loading}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending reset code...
                    </div>
                  ) : (
                    "Send Reset Code"
                  )}
                </Button>

                {/* Back to login */}
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full rounded-2xl text-muted-foreground hover:text-primary hover:bg-primary/5"
                  onClick={() => router.push("/auth/login")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </GlowBorder>
    </div>
  );
}