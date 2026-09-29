"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWhatsAppLinkCode, unlinkWhatsApp } from "@/app/actions/whatsapp";
import ConfirmDialog from "@/components/board/ConfirmDialog";
import {
  DANGER_BUTTON,
  HINT_CLASS,
  LABEL_CLASS,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  StatusMessage,
  type Status,
} from "@/components/profile/ui";
import { formatWhatsAppNumber, whatsAppChatUrl } from "@/lib/whatsappNumber";

/**
 * Links the user's WhatsApp number: they get a code here and send it from
 * WhatsApp to Stickly's number, and the webhook links the number it came
 * from. The page doesn't hear about it, so "I sent it" refreshes it.
 */
export default function WhatsAppLink({
  linkedNumber,
  botNumber,
}: {
  linkedNumber: string | null;
  botNumber: string;
}) {
  const t = useTranslations("profile.whatsapp");
  const tErrors = useTranslations("errors");
  const format = useFormatter();
  const router = useRouter();
  const [pendingCode, setPendingCode] = useState<{ code: string; expiresAt: Date } | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [isConfirmingUnlink, setIsConfirmingUnlink] = useState(false);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setStatus(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setStatus({ type: "error", text: tErrors("GENERIC") });
      }
    });
  }

  function generateCode() {
    run(async () => setPendingCode(await createWhatsAppLinkCode()));
  }

  function unlink() {
    setIsConfirmingUnlink(false);
    run(async () => {
      await unlinkWhatsApp();
      setPendingCode(null);
      setStatus({ type: "success", text: t("unlinked") });
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2 pt-6">
      <h2 className={LABEL_CLASS}>{t("title")}</h2>
      {linkedNumber ? (
        <>
          <p className={HINT_CLASS}>
            {t("linkedTo", { number: formatWhatsAppNumber(linkedNumber) })}
          </p>
          <button
            type="button"
            onClick={() => setIsConfirmingUnlink(true)}
            disabled={isPending}
            className={`self-start ${DANGER_BUTTON}`}
          >
            {t("unlink")}
          </button>
        </>
      ) : pendingCode ? (
        <>
          <p className={HINT_CLASS}>
            {t("sendCode", { number: formatWhatsAppNumber(botNumber) })}
          </p>
          <p className="font-mono text-2xl tracking-[0.3em] text-zinc-900 dark:text-zinc-50">
            {pendingCode.code}
          </p>
          <p className={HINT_CLASS}>
            {t("expiresAt", { time: format.dateTime(pendingCode.expiresAt, { timeStyle: "short" }) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsAppChatUrl(botNumber, pendingCode.code)}
              target="_blank"
              rel="noopener noreferrer"
              className={PRIMARY_BUTTON}
            >
              {t("openWhatsApp")}
            </a>
            <button type="button" onClick={() => router.refresh()} className={SECONDARY_BUTTON}>
              {t("sent")}
            </button>
            <button type="button" onClick={generateCode} disabled={isPending} className={SECONDARY_BUTTON}>
              {t("newCode")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={HINT_CLASS}>{t("hint")}</p>
          <button
            type="button"
            onClick={generateCode}
            disabled={isPending}
            className={`self-start ${PRIMARY_BUTTON}`}
          >
            {t("link")}
          </button>
        </>
      )}
      <StatusMessage status={status} />
      {isConfirmingUnlink && (
        <ConfirmDialog
          title={t("confirmUnlinkTitle")}
          message={t("confirmUnlinkMessage")}
          confirmLabel={t("unlink")}
          onConfirm={unlink}
          onCancel={() => setIsConfirmingUnlink(false)}
        />
      )}
    </section>
  );
}
