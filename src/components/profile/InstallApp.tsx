"use client";

import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { isAndroid, isIOS, isStandalone } from "@/components/device";
import { promptInstall, useInstallState } from "@/components/installPrompt";
import { HINT_CLASS, LABEL_CLASS, PRIMARY_BUTTON, SECTION_CLASS } from "@/components/profile/ui";

type Platform = "ios" | "android" | null;

function getPlatform(): Platform {
  // Already running as the installed app: nothing to offer.
  if (isStandalone()) return null;
  if (isIOS()) return "ios";
  if (isAndroid()) return "android";
  // Desktop: the browser's own install button is enough there.
  return null;
}

const noSubscription = () => () => {};

/**
 * Offers installing Stickly on phones and tablets: the browser's install
 * dialog where there is one (Chromium on Android), the steps otherwise (iOS
 * only installs from the Share menu). Hidden on desktop and once installed.
 */
export default function InstallApp() {
  const t = useTranslations("profile.install");
  // The platform can only be known in the browser: null while server rendering.
  const platform = useSyncExternalStore(noSubscription, getPlatform, () => null);
  const { prompt, installed } = useInstallState();

  if (!platform) return null;

  return (
    <section className={SECTION_CLASS}>
      <h2 className={LABEL_CLASS}>{t("title")}</h2>
      {installed ? (
        <p className={HINT_CLASS}>{t("installed")}</p>
      ) : (
        <>
          <p className={HINT_CLASS}>{t("hint")}</p>
          {platform === "android" && prompt ? (
            <button
              type="button"
              onClick={() => promptInstall(prompt)}
              className={`self-start ${PRIMARY_BUTTON}`}
            >
              {t("install")}
            </button>
          ) : (
            <ol className={`list-decimal pl-4 ${HINT_CLASS}`}>
              {(platform === "ios" ? ["iosStep1", "iosStep2", "iosStep3"] : ["androidStep1", "androidStep2"]).map(
                (step) => (
                  <li key={step}>{t(step)}</li>
                )
              )}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
