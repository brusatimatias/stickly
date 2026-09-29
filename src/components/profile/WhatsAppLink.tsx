"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createWhatsAppLinkCode, unlinkWhatsApp } from "@/app/actions/whatsapp";
import { formatWhatsAppNumber, whatsAppChatUrl } from "@/lib/whatsappNumber";

const BUTTON_CLASS =
  "rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900";

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
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch {
        setError(tErrors("GENERIC"));
      }
    });
  }

  function generateCode() {
    run(async () => setPendingCode(await createWhatsAppLinkCode()));
  }

  function unlink() {
    run(async () => {
      await unlinkWhatsApp();
      setPendingCode(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-2 pt-6">
      <h2 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t("title")}</h2>
      {linkedNumber ? (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("linkedTo", { number: formatWhatsAppNumber(linkedNumber) })}
          </p>
          <button type="button" onClick={unlink} disabled={isPending} className={`self-start ${BUTTON_CLASS}`}>
            {t("unlink")}
          </button>
        </>
      ) : pendingCode ? (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("sendCode", { number: formatWhatsAppNumber(botNumber) })}
          </p>
          <p className="font-mono text-2xl tracking-[0.3em] text-zinc-900 dark:text-zinc-50">
            {pendingCode.code}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {t("expiresAt", { time: format.dateTime(pendingCode.expiresAt, { timeStyle: "short" }) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={whatsAppChatUrl(botNumber, pendingCode.code)}
              target="_blank"
              rel="noopener noreferrer"
              className={BUTTON_CLASS}
            >
              {t("openWhatsApp")}
            </a>
            <button type="button" onClick={() => router.refresh()} className={BUTTON_CLASS}>
              {t("sent")}
            </button>
            <button type="button" onClick={generateCode} disabled={isPending} className={BUTTON_CLASS}>
              {t("newCode")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("hint")}</p>
          <button type="button" onClick={generateCode} disabled={isPending} className={`self-start ${BUTTON_CLASS}`}>
            {t("link")}
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </section>
  );
}
