"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CameraIcon, Loader2Icon, CheckIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { saveProfile } from "@/lib/settings/actions";
import { initials } from "@/components/settings/initials";
import type { Profile } from "@/lib/settings/profile";

const SAVE_DEBOUNCE_MS = 700;

export function ProfileSection({ profile }: { profile: Profile }) {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <ProfileCard profile={profile} />
    </div>
  );
}

function ProfileCard({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Persist name + phone plus an optional new avatar file. */
  function persist(nextName: string, nextPhone: string, file: File | null) {
    setError(null);
    setSaved(false);
    const formData = new FormData();
    formData.set("name", nextName);
    formData.set("phone", nextPhone);
    if (file) formData.set("avatar", file);

    startTransition(async () => {
      try {
        const result = await saveProfile(formData);
        setAvatarUrl(result.avatarUrl);
        if (file) {
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
        }
        setSaved(true);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save.");
      }
    });
  }

  /** Debounce a save, replacing any still-pending one. */
  function schedule(run: () => void) {
    setSaved(false);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(run, SAVE_DEBOUNCE_MS);
  }

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setName(value);
    schedule(() => persist(value, phone, null));
  }

  function handlePhoneChange(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setPhone(value);
    schedule(() => persist(name, value, null));
  }

  // Flush a still-pending debounced save immediately (e.g. on blur).
  function flush() {
    if (!debounce.current) return;
    clearTimeout(debounce.current);
    debounce.current = null;
    if (name !== profile.name || phone !== profile.phone) {
      persist(name, phone, null);
    }
  }

  function handlePickFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
    persist(name, phone, file); // avatar saves right away
  }

  const shownAvatar = previewUrl ?? avatarUrl ?? undefined;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="flex max-w-md flex-col gap-6">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="size-16">
            {shownAvatar && <AvatarImage src={shownAvatar} alt="" />}
            <AvatarFallback className="text-lg">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <CameraIcon />
              {avatarUrl || previewUrl ? "Change photo" : "Upload photo"}
            </Button>
            <span className="text-xs text-muted-foreground">
              PNG, JPEG, WebP, or GIF. Up to 5 MB.
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={handlePickFile}
          />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Name</span>
          <Input
            className="h-9"
            value={name}
            onChange={handleNameChange}
            onBlur={flush}
            placeholder="Your name"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <Input
            className="h-9"
            type="email"
            value={profile.email}
            readOnly
            disabled
            placeholder="you@company.com"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Phone</span>
          <Input
            className="h-9"
            type="tel"
            value={phone}
            onChange={handlePhoneChange}
            onBlur={flush}
            placeholder="(555) 555-5555"
          />
        </label>

        <div className="h-5 text-sm text-muted-foreground" aria-live="polite">
          {pending ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2Icon className="size-4 animate-spin" />
              Saving
            </span>
          ) : saved ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" />
              Saved
            </span>
          ) : null}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

