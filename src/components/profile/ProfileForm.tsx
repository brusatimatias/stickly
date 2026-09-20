"use client";

import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState, useTransition } from "react";
import { setPassword, updateAvatar, updateProfileName } from "@/app/actions/profile";
import { EyeIcon, EyeOffIcon, UserIcon } from "@/components/profile/icons";
import { resizeImageToDataUrl } from "@/lib/image";

const AVATAR_TARGET_SIZE = 128;
const MIN_PASSWORD_LENGTH = 8;
const STATUS_CLEAR_DELAY_MS = 2500;

/** Clears a "Saved"-style status message a couple seconds after it's set. */
function useAutoClearStatus(status: string | null, clear: () => void) {
  useEffect(() => {
    if (status !== "Saved") return;
    const timeout = setTimeout(clear, STATUS_CLEAR_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [status, clear]);
}

export default function ProfileForm({
  name: initialName,
  email,
  avatarSrc,
  hasPassword,
}: {
  name: string;
  email: string;
  avatarSrc: string | null;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<string | null>(null);
  const [isNamePending, startNameTransition] = useTransition();

  const [avatarPreview, setAvatarPreview] = useState(avatarSrc);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();

  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordPending, startPasswordTransition] = useTransition();

  useAutoClearStatus(nameStatus, () => setNameStatus(null));
  useAutoClearStatus(avatarStatus, () => setAvatarStatus(null));
  useEffect(() => {
    if (!passwordSaved) return;
    const timeout = setTimeout(() => setPasswordSaved(false), STATUS_CLEAR_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [passwordSaved]);

  const trimmedName = name.trim();
  const canSaveName = trimmedName.length > 0 && trimmedName !== initialName.trim();

  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatched = confirmPassword.length > 0 && password !== confirmPassword;
  const canSavePassword =
    password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword;

  function saveName() {
    if (!canSaveName) return;
    setNameStatus(null);
    startNameTransition(async () => {
      try {
        await updateProfileName(trimmedName);
        setNameStatus("Saved");
        router.refresh();
      } catch (error) {
        setNameStatus(error instanceof Error ? error.message : "Failed to save");
      }
    });
  }

  async function handleAvatarChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarStatus(null);

    try {
      const dataUrl = await resizeImageToDataUrl(file, AVATAR_TARGET_SIZE);
      setAvatarPreview(dataUrl);
      startAvatarTransition(async () => {
        try {
          await updateAvatar(dataUrl);
          setAvatarStatus("Saved");
          router.refresh();
        } catch (error) {
          setAvatarStatus(error instanceof Error ? error.message : "Failed to save");
        }
      });
    } catch {
      setAvatarStatus("Could not process that image");
    }
  }

  function savePassword() {
    if (!canSavePassword) return;
    setPasswordError(null);
    setPasswordSaved(false);
    startPasswordTransition(async () => {
      try {
        await setPassword(password);
        setPassword("");
        setConfirmPassword("");
        setPasswordSaved(true);
      } catch (error) {
        setPasswordError(error instanceof Error ? error.message : "Failed to save");
      }
    });
  }

  return (
    <div className="flex w-full max-w-sm flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      <section className="flex flex-col items-center gap-3 pb-6">
        {avatarPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- may be a data URL, no need for next/image optimization here
          <img
            src={avatarPreview}
            alt={name || "Your avatar"}
            className="h-24 w-24 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <UserIcon className="h-12 w-12" />
          </div>
        )}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAvatarPending}
          className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {isAvatarPending ? "Uploading…" : "Change avatar"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        {avatarStatus && <p className="text-xs text-zinc-500">{avatarStatus}</p>}
      </section>

      <section className="flex flex-col gap-2 py-6">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Name</label>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={saveName}
            disabled={!canSaveName || isNamePending}
            className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            {isNamePending ? "Saving…" : "Save"}
          </button>
        </div>
        {nameStatus && <p className="text-xs text-zinc-500">{nameStatus}</p>}
      </section>

      <section className="flex flex-col gap-2 pt-6">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {hasPassword ? "Change password" : "Set a password"}
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Lets you sign in with {email} and a password, in addition to Google.
        </p>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="New password"
            value={password}
            onChange={(event) => setPasswordValue(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 pr-9 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide passwords" : "Show passwords"}
            className="absolute inset-y-0 right-2 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
        {tooShort && (
          <p className="text-xs text-red-500">
            Must be at least {MIN_PASSWORD_LENGTH} characters
          </p>
        )}
        <input
          type={showPassword ? "text" : "password"}
          placeholder="Confirm password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {mismatched && <p className="text-xs text-red-500">Passwords don&apos;t match</p>}
        <button
          type="button"
          onClick={savePassword}
          disabled={!canSavePassword || isPasswordPending}
          className="self-start rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {isPasswordPending ? "Saving…" : "Save password"}
        </button>
        {passwordError && <p className="text-xs text-red-500">{passwordError}</p>}
        {passwordSaved && <p className="text-xs text-zinc-500">Saved</p>}
      </section>
    </div>
  );
}
