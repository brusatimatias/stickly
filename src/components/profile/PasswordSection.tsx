"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { type FormEvent, useId, useState, useTransition } from "react";
import { confirmPasswordResetWithGoogle, setPassword } from "@/app/actions/profile";
import { errorCode, useErrorMessage } from "@/components/errorMessage";
import { FOCUS_RING } from "@/components/focusRing";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import {
  HINT_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SECTION_CLASS,
  StatusMessage,
  useAutoClearStatus,
  type Status,
} from "@/components/profile/ui";
import { MIN_PASSWORD_LENGTH } from "@/lib/profile";

const eyeButtonClass = `absolute inset-y-0 right-2 flex cursor-pointer items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 pointer-coarse:right-0 pointer-coarse:w-10 dark:hover:text-zinc-300 ${FOCUS_RING}`;

export default function PasswordSection({
  email,
  hasPassword,
  canResetWithGoogle,
  recentGoogleSignIn,
  openPasswordForm,
}: {
  email: string;
  hasPassword: boolean;
  /** The user has Google linked, so a forgotten password can be reset by signing in again. */
  canResetWithGoogle: boolean;
  /** The session just signed in with Google, which stands in for the current password. */
  recentGoogleSignIn: boolean;
  /** Back from confirming with Google: start with the password form open. */
  openPasswordForm: boolean;
}) {
  const t = useTranslations("profile");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPasswordValue] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStatus, setPasswordStatus] = useState<Status>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [isEditingPassword, setIsEditingPassword] = useState(openPasswordForm);
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const ids = { currentPassword: useId(), password: useId(), confirmPassword: useId() };
  useAutoClearStatus(passwordStatus, setPasswordStatus);

  const needsCurrentPassword = hasPassword && !recentGoogleSignIn;
  const tooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;
  const mismatched = confirmPassword.length > 0 && password !== confirmPassword;
  const canSavePassword =
    password.length >= MIN_PASSWORD_LENGTH &&
    password === confirmPassword &&
    (!needsCurrentPassword || currentPassword.length > 0);

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
      } catch (error) {
        setPasswordStatus({ type: "error", text: errorMessage(error) });
        // The Google sign in stopped being recent while the form was open:
        // refreshing brings the current password field back.
        if (!needsCurrentPassword && errorCode(error) === "CURRENT_PASSWORD_REQUIRED") {
          router.refresh();
        }
      }
    });
  }

  function confirmWithGoogle() {
    // Redirects to Google and back to the profile with the form open.
    startGoogleTransition(() => confirmPasswordResetWithGoogle());
  }

  return (
    <section className={SECTION_CLASS}>
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
  );
}
