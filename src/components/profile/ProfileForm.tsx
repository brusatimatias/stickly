"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useId, useRef, useState, useTransition } from "react";
import {
  confirmPasswordResetWithGoogle,
  setPassword,
  updateAvatar,
  updateProfileName,
} from "@/app/actions/profile";
import { CameraIcon, EyeIcon, EyeOffIcon, UserIcon } from "@/components/profile/icons";
import {
  HINT_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  StatusMessage,
  type Status,
} from "@/components/profile/ui";
import InstallApp from "@/components/profile/InstallApp";
import NotificationSettings from "@/components/profile/NotificationSettings";
import WhatsAppLink from "@/components/profile/WhatsAppLink";
import { resizeImageToDataUrl } from "@/lib/image";
import { FOCUS_RING } from "@/components/focusRing";

const AVATAR_TARGET_SIZE = 128;
const MIN_PASSWORD_LENGTH = 8;
const STATUS_CLEAR_DELAY_MS = 2500;

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
  canResetWithGoogle,
  recentGoogleSignIn,
  openPasswordForm,
  whatsapp,
  notifications,
}: {
  name: string;
  email: string;
  avatarSrc: string | null;
  hasPassword: boolean;
  /** The user has Google linked, so a forgotten password can be reset by signing in again. */
  canResetWithGoogle: boolean;
  /** The session just signed in with Google, which stands in for the current password. */
  recentGoogleSignIn: boolean;
  /** Back from confirming with Google: start with the password form open. */
  openPasswordForm: boolean;
  /** Null when the WhatsApp chat isn't configured, which hides the section. */
  whatsapp: { linkedNumber: string | null; botNumber: string } | null;
  /** Null when push isn't configured (no VAPID keys). */
  notifications: { vapidPublicKey: string } | null;
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

  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(openPasswordForm);
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const ids = { name: useId(), currentPassword: useId(), password: useId(), confirmPassword: useId() };

  useAutoClearStatus(nameStatus, () => setNameStatus(null));
  useAutoClearStatus(avatarStatus, () => setAvatarStatus(null));
  useAutoClearStatus(passwordStatus, () => setPasswordStatus(null));

  const trimmedName = name.trim();
  const canSaveName = trimmedName.length > 0 && trimmedName !== initialName.trim();

  const needsCurrentPassword = hasPassword && !recentGoogleSignIn;
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatched = confirmPassword.length > 0 && password !== confirmPassword;
  const canSavePassword =
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirmPassword &&
    (!needsCurrentPassword || currentPassword.length > 0);

  function saveName(event: FormEvent) {
    event.preventDefault();
    if (!canSaveName || isNamePending) return;
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

  function closePasswordForm() {
    setIsEditingPassword(false);
    setCurrentPassword("");
    setPasswordValue("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowCurrentPassword(false);
  }

  function savePassword(event: FormEvent) {
    event.preventDefault();
    if (!canSavePassword || isPasswordPending) return;
    setPasswordStatus(null);
    startPasswordTransition(async () => {
      try {
        await setPassword(password, needsCurrentPassword ? currentPassword : undefined);
        closePasswordForm();
        setPasswordStatus({ type: "success", text: t("saved") });
        // A first-time password flips hasPassword, which the server provides.
        router.refresh();
      } catch (error) {
        setPasswordStatus({ type: "error", text: errorMessage(tErrors, error) });
        // The Google sign in stopped being recent while the form was open:
        // refreshing brings the current password field back.
        if (!needsCurrentPassword && error instanceof Error && error.message === "CURRENT_PASSWORD_REQUIRED") {
          router.refresh();
        }
      }
    });
  }

  function confirmWithGoogle() {
    // Redirects to Google and back to the profile with the form open.
    startGoogleTransition(() => confirmPasswordResetWithGoogle());
  }

  const eyeButtonClass =
    `absolute inset-y-0 right-2 flex cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 pointer-coarse:right-0 pointer-coarse:w-10 dark:hover:text-zinc-300 ${FOCUS_RING}`;

  return (
    <div className="flex w-full max-w-sm flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
      <section className="flex flex-col items-center gap-3 pb-6">
        {/* A shortcut for the mouse; keyboard and screen readers use the text button below. */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAvatarPending}
          tabIndex={-1}
          aria-hidden
          className="group relative h-24 w-24 cursor-pointer overflow-hidden rounded-full disabled:cursor-wait"
        >
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- may be a data URL, no need for next/image optimization here
            <img
              src={avatarPreview}
              alt={name || tCommon("yourAvatar")}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
              <UserIcon className="h-12 w-12" />
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <CameraIcon className="h-7 w-7" />
          </span>
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isAvatarPending}
          className={SECONDARY_BUTTON}
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
        <StatusMessage status={avatarStatus} />
      </section>

      <form onSubmit={saveName} className="flex flex-col gap-2 py-6">
        <label htmlFor={ids.name} className={LABEL_CLASS}>
          {t("name")}
        </label>
        <div className="flex gap-2">
          <input
            id={ids.name}
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className={`flex-1 ${INPUT_CLASS}`}
          />
          <button type="submit" disabled={!canSaveName || isNamePending} className={PRIMARY_BUTTON}>
            {isNamePending ? t("saving") : t("save")}
          </button>
        </div>
        <StatusMessage status={nameStatus} />
      </form>

      <section className="flex flex-col gap-2 pt-6 not-last:pb-6">
        <h2 className={LABEL_CLASS}>{hasPassword ? t("changePassword") : t("setPassword")}</h2>
        <p className={HINT_CLASS}>{t("passwordHint", { email })}</p>
        {isEditingPassword ? (
          <form onSubmit={savePassword} className="flex flex-col gap-2">
            {hasPassword && !needsCurrentPassword && (
              <p className={HINT_CLASS}>{t("recentGoogleSignInHint")}</p>
            )}
            {needsCurrentPassword && (
              <div className="relative">
                <label htmlFor={ids.currentPassword} className="sr-only">
                  {t("currentPasswordPlaceholder")}
                </label>
                <input
                  id={ids.currentPassword}
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder={t("currentPasswordPlaceholder")}
                  autoComplete="current-password"
                  autoFocus
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  className={`${INPUT_CLASS} pr-9 pointer-coarse:pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((value) => !value)}
                  aria-label={showCurrentPassword ? t("hideCurrentPassword") : t("showCurrentPassword")}
                  className={eyeButtonClass}
                >
                  {showCurrentPassword ? (
                    <EyeOffIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
            {needsCurrentPassword && canResetWithGoogle && (
              <button
                type="button"
                onClick={confirmWithGoogle}
                disabled={isGooglePending || isPasswordPending}
                className="self-start cursor-pointer text-xs text-zinc-500 underline underline-offset-2 hover:text-zinc-800 disabled:cursor-wait disabled:opacity-60 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {t("forgotPasswordConfirmWithGoogle")}
              </button>
            )}
            <div className="relative">
              <label htmlFor={ids.password} className="sr-only">
                {t("newPasswordPlaceholder")}
              </label>
              <input
                id={ids.password}
                type={showPassword ? "text" : "password"}
                placeholder={t("newPasswordPlaceholder")}
                autoComplete="new-password"
                autoFocus={!needsCurrentPassword}
                value={password}
                onChange={(event) => setPasswordValue(event.target.value)}
                aria-invalid={tooShort}
                className={`${INPUT_CLASS} pr-9 pointer-coarse:pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? t("hidePasswords") : t("showPasswords")}
                className={eyeButtonClass}
              >
                {showPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
              </button>
            </div>
            <p className={`text-xs ${tooShort ? "text-red-500 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"}`}>
              {t("mustBeAtLeast", { count: MIN_PASSWORD_LENGTH })}
            </p>
            <label htmlFor={ids.confirmPassword} className="sr-only">
              {t("confirmPasswordPlaceholder")}
            </label>
            <input
              id={ids.confirmPassword}
              type={showPassword ? "text" : "password"}
              placeholder={t("confirmPasswordPlaceholder")}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              aria-invalid={mismatched}
              className={INPUT_CLASS}
            />
            {mismatched && <p className="text-xs text-red-500 dark:text-red-400">{t("passwordsDontMatch")}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!canSavePassword || isPasswordPending}
                className={PRIMARY_BUTTON}
              >
                {isPasswordPending ? t("saving") : t("savePassword")}
              </button>
              <button
                type="button"
                onClick={closePasswordForm}
                disabled={isPasswordPending}
                className={SECONDARY_BUTTON}
              >
                {t("cancel")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPasswordStatus(null);
              setIsEditingPassword(true);
            }}
            className={`self-start ${SECONDARY_BUTTON}`}
          >
            {hasPassword ? t("changePassword") : t("setPassword")}
          </button>
        )}
        <StatusMessage status={passwordStatus} />
      </section>

      {whatsapp && <WhatsAppLink {...whatsapp} />}
      <InstallApp />
      {notifications && <NotificationSettings {...notifications} />}
    </div>
  );
}
