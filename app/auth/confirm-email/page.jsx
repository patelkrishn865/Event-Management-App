"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { GlowBorder } from "@/components/ui/glow-border";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, ArrowRight } from "lucide-react";

export default function ConfirmEmailPage() {
    const router = useRouter();

    return (
        <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
            {/* Visual Background */}
            <div className="pointer-events-none absolute inset-0 -z-10">
                <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl animate-pulse-slow" />
                <div className="absolute top-20 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl animate-pulse-slow delay-500" />
                <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl animate-pulse-slow delay-1000" />
            </div>

            <GlowBorder className="w-full max-w-lg animate-fade-in-up">
                <Card className="border-none shadow-none bg-transparent">
                    <CardHeader className="space-y-4 text-center pb-2">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                            <CheckCircle2 className="h-10 w-10 text-green-500" />
                        </div>
                        <CardTitle className="text-3xl font-bold tracking-tight text-foreground">
                            Email Confirmed!
                        </CardTitle>
                        <CardDescription className="text-base text-muted-foreground">
                            Your email has been successfully verified. You can now log in to your account.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="pt-4 text-center">
                        <Button
                            onClick={() => router.push("/auth/login")}
                            className="w-full rounded-2xl h-11 font-semibold text-lg"
                        >
                            <span className="flex items-center gap-2">
                                Go to Login <ArrowRight className="h-5 w-5" />
                            </span>
                        </Button>
                    </CardContent>
                </Card>
            </GlowBorder>
        </div>
    );
}
