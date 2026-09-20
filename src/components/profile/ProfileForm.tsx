"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ChangeEvent, useEffect, useRef, useState, useTransition } from "react";
import { setPassword, updateAvatar, updateProfileName } from "@/app/actions/profile";
import { EyeIcon, EyeOffIcon, UserIcon } from "@/components/profile/icons";
import { resizeImageToDataUrl } from "@/lib/image";

const AVATAR_TARGET_SIZE = 128;
const MIN_PASSWORD_LENGTH = 8;
const STATUS_CLEAR_DELAY_MS = 2500;

type Status = { type: "success" | "error"; text: string } | null;

/** Clears a success status message a couple seconds after it's set. */
function useAutoClearStatus(status: Status, clear: () => void) {
  useEffect(() => {
    if (status?.type !== "success") return;
    const timeout = setTimeout(clear, STATUS_CLEAR_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [status, clear]);
}

function errorMessage(tErrors: ReturnType<typeof useTranslations>, error: unknown): string {
  const code = error instanceof Error ? error.message : undefined;
  return code && tErrors.has(code) ? tErrors(code) : tErrors("GENERIC");
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
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<Status>(null);
  const [isNamePending, startNameTransition] = useTransition();

  const [avatarPreview, setAvatarPreview] = useState(avatarSrc);
  const [avatarStatus, setAvatarStatus] = useState<Status>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();

  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordPending, startPasswordTransition] = useTransition();

  useAutoClearStatus(nameStatus, () => setNameStatus(null));
  useAutoClearStatus(avatarStatus, () => setAvatarStatus(null));
  useAutoClearStatus(passwordStatus, () => setPasswordStatus(null));

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
        setNameStatus({ type: "success", text: t("saved") });
        router.refresh();
      } catch (error) {
        setNameStatus({ type: "error", text: errorMessage(tErrors, error) });
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
          setAvatarStatus({ type: "success", text: t("saved") });
          router.refresh();
        } catch (error) {
          setAvatarStatus({ type: "error", text: errorMessage(tErrors, error) });
        }
      });
    } catch {
      setAvatarStatus({ type: "error", text: t("couldNotProcessImage") });
    }
  }

  function savePassword() {
    if (!canSavePassword) return;
    setPasswordStatus(null);
    startPasswordTransition(async () => {
      try {
        await setPassword(password);
        setPasswordValue("");
        setConfirmPassword("");
        setPasswordStatus({ type: "success", text: t("saved") });
      } catch (error) {
        setPasswordStatus({ type: "error", text: errorMessage(tErrors, error) });
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
            alt={name || tCommon("yourAvatar")}
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
          {isAvatarPending ? t("uploading") : t("changeAvatar")}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        {avatarStatus && (
          <p
            className={`text-xs ${avatarStatus.type === "error" ? "text-red-500" : "text-zinc-500"}`}
          >
            {avatarStatus.text}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 py-6">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {t("name")}
        </label>
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
            {isNamePending ? t("saving") : t("save")}
          </button>
        </div>
        {nameStatus && (
          <p
            className={`text-xs ${nameStatus.type === "error" ? "text-red-500" : "text-zinc-500"}`}
          >
            {nameStatus.text}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 pt-6">
        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {hasPassword ? t("changePassword") : t("setPassword")}
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {t("passwordHint", { email })}
        </p>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder={t("newPasswordPlaceholder")}
            value={password}
            onChange={(event) => setPasswordValue(event.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-1.5 pr-9 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? t("hidePasswords") : t("showPasswords")}
            className="absolute inset-y-0 right-2 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
        </div>
        {tooShort && (
          <p className="text-xs text-red-500">
            {t("mustBeAtLeast", { count: MIN_PASSWORD_LENGTH })}
          </p>
        )}
        <input
          type={showPassword ? "text" : "password"}
          placeholder={t("confirmPasswordPlaceholder")}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {mismatched && <p className="text-xs text-red-500">{t("passwordsDontMatch")}</p>}
        <button
          type="button"
          onClick={savePassword}
          disabled={!canSavePassword || isPasswordPending}
          className="self-start rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {isPasswordPending ? t("saving") : t("savePassword")}
        </button>
        {passwordStatus && (
          <p
            className={`text-xs ${passwordStatus.type === "error" ? "text-red-500" : "text-zinc-500"}`}
          >
            {passwordStatus.text}
          </p>
        )}
      </section>
    </div>
  );
}
