"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useId, useState, useTransition } from "react";
import { updateProfileName } from "@/app/actions/profile";
import { useErrorMessage } from "@/components/errorMessage";
import {
  INPUT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  StatusMessage,
  useAutoClearStatus,
  type Status,
} from "@/components/profile/ui";

export default function NameSection({ name: initialName }: { name: string }) {
  const t = useTranslations("profile");
  const errorMessage = useErrorMessage();
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [nameStatus, setNameStatus] = useState<Status>(null);
  const [isNamePending, startNameTransition] = useTransition();
  useAutoClearStatus(nameStatus, setNameStatus);

  const trimmedName = name.trim();
  const canSaveName = trimmedName.length > 0 && trimmedName !== initialName.trim();

  function saveName(event: FormEvent) {
    event.preventDefault();
    if (!canSaveName || isNamePending) return;
    setNameStatus(null);
    startNameTransition(async () => {
      try {
        await updateProfileName(trimmedName);
        setNameStatus({ type: "success", text: t("saved") });
      } catch (error) {
        setNameStatus({ type: "error", text: errorMessage(error) });
      }
    });
  }

  return (
    <form onSubmit={saveName} className="flex flex-col gap-2 py-6">
      <label htmlFor={inputId} className={LABEL_CLASS}>
        {t("name")}
      </label>
      <div className="flex gap-2">
        <input
          id={inputId}
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

  );
}
