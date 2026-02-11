"use client";

import { Suspense, useState, useEffect } from "react";
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

import { ShieldCheck, ArrowRight, Loader2, ArrowLeft } from "lucide-react";

/**
 * Validation Schema
 */
const schema = z.object({
    email: z.string().email("Enter a valid email"),
    token: z.string().min(6, "Enter the verification code").max(8, "Enter the verification code"),
});

function VerifyOtpForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [serverMsg, setServerMsg] = useState(null);
    const [loading, setLoading] = useState(false);

    const initialEmail = searchParams.get("email") || "";

    const form = useForm({
        resolver: zodResolver(schema),
        defaultValues: { email: initialEmail, token: "" },
    });

    async function onSubmit(values) {
        setServerMsg(null);
        setLoading(true);

        try {
            const { error } = await supabase.auth.verifyOtp({
                email: values.email.trim(),
                token: values.token.trim(),
                type: "recovery",
            });

            if (error) throw error;

            // Successful verification logs the user in
            // Redirect to the reset password page
            router.push("/auth/reset-password");
        } catch (err) {
            setServerMsg(err.message || "Invalid or expired code. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
            {/* Background blobs */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl animate-pulse-slow" />
                <div className="absolute top-20 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl animate-pulse-slow delay-500" />
                <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl animate-pulse-slow delay-1000" />
            </div>

            <GlowBorder className="w-full max-w-lg">
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="space-y-4 text-center pb-2">
                        <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="h-8 w-8 text-primary" />
                        </div>
                        <CardTitle className="text-3xl font-bold tracking-tight">
                            Verify Code
                        </CardTitle>
                        <CardDescription className="text-base">
                            Enter the verification code sent to your email
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-4">
                        {serverMsg && (
                            <Alert variant="destructive" className="rounded-2xl border-destructive/20 bg-destructive/10">
                                <AlertDescription className="text-center font-medium">{serverMsg}</AlertDescription>
                            </Alert>
                        )}

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email Address</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="you@example.com"
                                                    className="rounded-2xl h-11"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="token"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Verification Token</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="12345678"
                                                    maxLength={8}
                                                    className="rounded-2xl h-11 text-center text-2xl tracking-[0.5em] font-bold"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <Button
                                    type="submit"
                                    className="w-full rounded-2xl h-11 font-semibold text-lg"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <div className="flex items-center gap-2 text-primary-foreground text-opacity-80">
                                            <Loader2 className="h-5 w-5 animate-spin" /> Verifying...
                                        </div>
                                    ) : (
                                        <span className="flex items-center gap-2">
                                            Verify Code <ArrowRight className="h-5 w-5" />
                                        </span>
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full rounded-2xl text-muted-foreground"
                                    onClick={() => router.push("/auth/forgot-password")}
                                >
                                    <ArrowLeft className="mr-2 h-4 w-4" />
                                    Back to Forgot Password
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </GlowBorder>
        </div>
    );
}

export default function VerifyOtpPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <VerifyOtpForm />
        </Suspense>
    );
}
