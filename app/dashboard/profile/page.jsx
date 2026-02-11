"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { GlowBorder } from "@/components/ui/glow-border";

import {
  ArrowLeft,
  Save,
  Upload,
  User,
  UserCheck,
  Loader2,
} from "lucide-react";


export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const [profile, setProfile] = useState({
    full_name: "",
    bio: "",
    avatar_url: "",
    email: "",
    role: "attendee",
  });

  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  // Load profile
  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, bio, avatar_url, role")
        .eq("id", user.id)
        .single();

      if (error) {
        setMessage({ text: error.message, type: "error" });
      } else if (data) {
        setProfile({
          full_name: data.full_name || "",
          bio: data.bio || "",
          avatar_url: data.avatar_url || "",
          email: user.email || "",
          role: data.role || "attendee",
        });
        if (data.avatar_url) setPreviewUrl(data.avatar_url);
      }
      setLoading(false);
    }

    fetchProfile();
  }, [router]);

  // Handle avatar selection + local preview
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ text: "Please select an image file.", type: "error" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ text: "Image size must be under 5MB.", type: "error" });
      return;
    }

    const preview = URL.createObjectURL(file);
    setPreviewUrl(preview);
  };

  // Save profile
  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let avatarUrl = profile.avatar_url;

    // Upload avatar if new file selected
    const file = fileInputRef.current?.files?.[0];
    if (file) {
      try {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, file, {
            cacheControl: "3600",
            upsert: true,
            contentType: file.type,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = urlData.publicUrl;

        if (previewUrl && previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(previewUrl);
        }
      } catch (err) {
        setMessage({ text: err.message || "Failed to upload avatar", type: "error" });
        setSaving(false);
        return;
      }
    }

    // Update database
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name.trim() || null,
        bio: profile.bio.trim() || null,
        avatar_url: avatarUrl || null,
      })
      .eq("id", user.id);

    if (error) {
      setMessage({ text: error.message, type: "error" });
    } else {
      setMessage({ text: "Profile updated successfully!", type: "success" });
      setProfile((prev) => ({ ...prev, avatar_url: avatarUrl || prev.avatar_url }));
      setPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Background blobs */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl" />
          <div className="absolute top-10 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl" />
          <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-6 py-8">
          <GlowBorder>
            <CardContent className="p-8 space-y-8 animate-pulse">
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-48 rounded-lg" />
                <Skeleton className="h-10 w-24 rounded-2xl" />
              </div>

              <div className="flex flex-col md:flex-row gap-10">
                <div className="flex flex-col items-center gap-6 md:w-1/3">
                  <Skeleton className="h-32 w-32 rounded-full" />
                  <Skeleton className="h-8 w-32 rounded-lg" />
                  <Skeleton className="h-5 w-40 rounded" />
                </div>

                <div className="flex-1 space-y-6">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-11 w-full rounded-2xl" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-32 w-full rounded-2xl" />
                  </div>
                  <Skeleton className="h-10 w-40 rounded-2xl" />
                </div>
              </div>
            </CardContent>
          </GlowBorder>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-primary/18 blur-3xl" />
        <div className="absolute top-10 -right-44 h-[560px] w-[560px] rounded-full bg-secondary/14 blur-3xl" />
        <div className="absolute -bottom-60 left-1/3 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        <GlowBorder>
          <CardContent className="p-8 space-y-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold tracking-tight">Your Profile</h1>
              <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            </div>

            {message && (
              <Alert
                variant={message.type === "success" ? "default" : "destructive"}
                className="rounded-2xl"
              >
                <AlertDescription>{message.text}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col md:flex-row gap-10">
              {/* Avatar & Info */}
              <div className="flex flex-col items-center gap-6 md:w-1/3">
                <div className="relative group">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
                    <AvatarImage src={previewUrl || profile.avatar_url} alt={profile.full_name} />
                    <AvatarFallback className="text-5xl bg-primary/10">
                      {profile.full_name?.[0]?.toUpperCase() || <User className="h-12 w-12" />}
                    </AvatarFallback>
                  </Avatar>

                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-2 right-2 bg-primary text-primary-foreground rounded-full p-3 cursor-pointer hover:bg-primary/90 transition shadow-md opacity-90 group-hover:opacity-100"
                  >
                    <Upload className="h-5 w-5" />
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                    />
                  </label>
                </div>

                <div className="text-center space-y-1">
                  <h2 className="text-xl font-semibold">
                    {profile.full_name || "Anonymous User"}
                  </h2>
                  <p className="text-sm text-muted-foreground">{profile.email}</p>
                  <Badge variant="secondary" className="mt-1">
                    {profile.role.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {/* Form */}
              <div className="flex-1 space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={profile.full_name}
                    onChange={(e) =>
                      setProfile({ ...profile, full_name: e.target.value })
                    }
                    placeholder="Krishnkumar"
                    className="rounded-2xl"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Bio</label>
                  <Textarea
                    value={profile.bio}
                    onChange={(e) =>
                      setProfile({ ...profile, bio: e.target.value })
                    }
                    placeholder="I'm an event enthusiast and organizer based in Ahmedabad..."
                    rows={5}
                    className="rounded-2xl resize-none"
                  />
                </div>

                {/* Organizer Application Section */}
                {profile.role === "attendee" && (
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6 space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <UserCheck className="h-5 w-5 text-primary" />
                      Become an Organizer
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Want to host your own events? Apply to become an organizer and get access to our event management tools.
                    </p>
                    <Button
                      variant="outline"
                      className="rounded-xl border-primary text-primary hover:bg-primary hover:text-white"
                      onClick={async () => {
                        try {
                          setSaving(true);
                          const { data: { session } } = await supabase.auth.getSession();
                          const res = await fetch("/api/profile/apply-organizer", {
                            method: "POST",
                            headers: { "Authorization": `Bearer ${session?.access_token}` },
                          });
                          const json = await res.json();
                          if (!res.ok) throw new Error(json.error);
                          setMessage({ text: json.message, type: "success" });
                          setProfile(prev => ({ ...prev, role: "pending_organizer" }));
                        } catch (err) {
                          setMessage({ text: err.message, type: "error" });
                        } finally {
                          setSaving(false);
                        }
                      }}
                      disabled={saving}
                    >
                      Apply Now
                    </Button>
                  </div>
                )}

                {profile.role === "pending_organizer" && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-amber-600 dark:text-amber-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Application Pending
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Your application to become an organizer is currently being reviewed by our administrators. We'll update your status soon!
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <Button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-2xl min-w-[140px]"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Save Profile
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </GlowBorder>
      </div>
    </div>
  );
}