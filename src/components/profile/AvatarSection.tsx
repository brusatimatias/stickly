"use client";

import { useTranslations } from "next-intl";
import { type ChangeEvent, useRef, useState, useTransition } from "react";
import { updateAvatar } from "@/app/actions/profile";
import { useErrorMessage } from "@/components/errorMessage";
import { CameraIcon, UserIcon } from "@/components/icons";
import { SECONDARY_BUTTON, StatusMessage, useAutoClearStatus, type Status } from "@/components/profile/ui";
import { resizeImageToDataUrl } from "@/lib/image";

const AVATAR_TARGET_SIZE = 128;

export default function AvatarSection({ avatarSrc, name }: { avatarSrc: string | null; name: string }) {
  const t = useTranslations("profile");
  const tCommon = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState(avatarSrc);
  const [avatarStatus, setAvatarStatus] = useState<Status>(null);
  const [isAvatarPending, startAvatarTransition] = useTransition();
  useAutoClearStatus(avatarStatus, setAvatarStatus);

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
        } catch (error) {
          setAvatarStatus({ type: "error", text: errorMessage(error) });
        }
      });
    } catch {
      setAvatarStatus({ type: "error", text: t("couldNotProcessImage") });
    }
  }

  return (
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

  );
}
