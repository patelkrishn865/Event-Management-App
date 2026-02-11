"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GlowBorder } from "@/components/ui/glow-border";
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

import { Eye, EyeOff, LogIn, ArrowRight, KeyRound } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});


function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverMsg, setServerMsg] = useState(null);
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onChange",
  });

  const canSubmit = useMemo(
    () => form.formState.isValid && !form.formState.isSubmitting && !loading,
    [form.formState.isValid, form.formState.isSubmitting, loading]
  );

  // Check for error parameter from callback redirect or hash
  useEffect(() => {
    // 1. Check query parameters
    const error = searchParams.get('error');
    if (error) {
      setServerMsg(decodeURIComponent(error));
      // Clear the query param to avoid re-showing on refresh
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
      return;
    }

    // 2. Check hash (common for Supabase errors)
    const hash = window.location.hash;
    if (hash && hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1)); // remove #
      const errorDescription = params.get('error_description');
      const errorMsg = params.get('error');

      if (errorDescription || errorMsg) {
        setServerMsg(decodeURIComponent(errorDescription || errorMsg).replace(/\+/g, ' '));
        // Clear hash
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [searchParams]);

  async function onSubmit(values) {
    setServerMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: values.email.trim(),
        password: values.password,
      });

      if (error) throw error;

      router.push("/dashboard");
    } catch (err) {
      setServerMsg(err.message || "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      {/* Background blobs — same as dashboard & signup */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-130 w-130 rounded-full bg-primary/18 blur-3xl animate-pulse-slow" />
        <div className="absolute top-20 -right-44 h-140 w-140 rounded-full bg-secondary/14 blur-3xl animate-pulse-slow delay-500" />
        <div className="absolute -bottom-60 left-1/3 h-130 w-130 rounded-full bg-primary/10 blur-3xl animate-pulse-slow delay-1000" />
      </div>

      <GlowBorder className="w-full max-w-lg animate-fade-in-up">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="space-y-4 text-center pb-2">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <LogIn className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">
              Welcome Back
            </CardTitle>
            <CardDescription className="text-base">
              Log in to manage your events and tickets
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 pt-4">
            {serverMsg && (
              <Alert variant="destructive" className="rounded-2xl">
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
                        <Input
                          placeholder="you@example.com"
                          autoComplete="email"
                          className="rounded-2xl h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Password */}
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password</FormLabel>
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() => router.push("/auth/forgot-password")}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPass ? "text" : "password"}
                            autoComplete="current-password"
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

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full rounded-2xl h-11 font-medium"
                  disabled={!canSubmit || loading}
                >
                  {loading ? (
                    <>Logging in...</>
                  ) : (
                    <>
                      Log In <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>

                {/* Sign up link */}
                <p className="text-center text-sm text-muted-foreground pt-2">
                  Don't have an account?{" "}
                  <button
                    type="button"
                    className="text-primary font-medium hover:underline"
                    onClick={() => router.push("/auth/signup")}
                  >
                    Sign up
                  </button>
                </p>
              </form>
            </Form>
          </CardContent>
        </Card>
      </GlowBorder>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}