"use client";

import { useEffect, useMemo, useState } from "react";
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

import { KeyRound, Eye, EyeOff, Loader2, ArrowLeft } from "lucide-react";
import { GlowBorder } from "@/components/ui/glow-border";

const schema = z
  .object({
    password: z
      .string()
      .min(6, "Password must be at least 6 characters")
      .max(64, "Password is too long"),
    confirmPassword: z.string().min(1, "Confirm your password"),
  })
  .refine((val) => val.password === val.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });


export default function ResetPasswordPage() {
  const router = useRouter();
  const [serverMsg, setServerMsg] = useState(null);
  const [ready, setReady] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
    mode: "onChange",
  });

  const canSubmit = useMemo(
    () => form.formState.isValid && !form.formState.isSubmitting && !loading,
    [form.formState.isValid, form.formState.isSubmitting, loading]
  );

  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        // 1. Check for 'code' in query params (if Secure Email Links is ON)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        if (code) {
          console.log('Detected code in URL, exchanging for session...');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            console.error('Code exchange error:', exchangeError);
            setServerMsg("The reset link is invalid or has expired.");
            setReady(true);
            return;
          }
          // After exchange, we should have a session
          setReady(true);
          return;
        }

        // 2. Check for hash fragment (if Secure Email Links is OFF)
        // Give it a moment to parse
        await new Promise(r => setTimeout(r, 500));

        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (!session) {
          // One final retry for slower clients
          const { data: { session: retrySession } } = await supabase.auth.getSession();
          if (!retrySession) {
            setServerMsg("Reset link is invalid or has expired. Please request a new one.");
          }
        }
        setReady(true);
      } catch (err) {
        if (!mounted) return;
        setServerMsg("An error occurred. Please try again.");
        setReady(true);
      }
    }

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  async function onSubmit(values) {
    setServerMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: values.password,
      });

      if (error) throw error;

      setServerMsg("Password updated successfully! Redirecting to login...");
      setTimeout(() => router.push("/auth/login"), 1500);
    } catch (err) {
      setServerMsg(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Verifying reset link...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      {/* Background blobs — consistent with login/signup/dashboard */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl animate-pulse-slow" />
        <div className="absolute top-20 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl animate-pulse-slow delay-500" />
        <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <GlowBorder className="w-full max-w-lg animate-fade-in-up">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="space-y-4 text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <KeyRound className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              Set New Password
            </CardTitle>
            <CardDescription className="text-base">
              Choose a strong password for your account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {serverMsg && (
              <Alert
                variant={serverMsg.includes("successfully") ? "default" : "destructive"}
                className="rounded-2xl"
              >
                <AlertDescription className="text-center">{serverMsg}</AlertDescription>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                {/* New Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPass ? "text" : "password"}
                            autoComplete="new-password"
                            className="rounded-2xl h-11 pr-10"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                            onClick={() => setShowPass((s) => !s)}
                          >
                            {showPass ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Confirm Password */}
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPass ? "text" : "password"}
                            autoComplete="new-password"
                            className="rounded-2xl h-11 pr-10"
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-transparent"
                            onClick={() => setShowConfirmPass((s) => !s)}
                          >
                            {showConfirmPass ? (
                              <EyeOff className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Eye className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
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
                      Updating password...
                    </div>
                  ) : (
                    "Update Password"
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