import { useTranslations } from "next-intl";
import ProfileShell from "@/components/profile/ProfileShell";

// No radius here: each block sets its own, since two radius classes on one
// element don't combine predictably.
const BLOCK = "bg-zinc-200/70 dark:bg-zinc-800/70";
const CARD =
  "flex-col divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white p-8 shadow-xl dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950";

/**
 * The profile's real header (so the way back works while it loads) over a
 * skeleton of the profile cards, in the same layout as `ProfileForm`.
 */
export default function ProfileLoading() {
  const t = useTranslations("profile");

  return (
    <ProfileShell>
      <div
        role="status"
        className="grid h-fit w-full max-w-sm items-start gap-6 motion-safe:animate-pulse lg:max-w-4xl lg:grid-cols-2"
      >
        <div className={`flex ${CARD}`}>
          <span className="sr-only">{t("loadingProfile")}</span>
          <div aria-hidden className="flex flex-col items-center gap-3 pb-6">
            <div className={`h-24 w-24 rounded-full ${BLOCK}`} />
            <div className={`h-8 w-32 rounded-full ${BLOCK}`} />
          </div>
          <div aria-hidden className="flex flex-col gap-2 py-6">
            <div className={`rounded-md h-4 w-16 ${BLOCK}`} />
            <div className="flex gap-2">
              <div className={`h-9 flex-1 rounded-lg ${BLOCK}`} />
              <div className={`h-9 w-20 rounded-full ${BLOCK}`} />
            </div>
          </div>
          <div aria-hidden className="flex flex-col gap-2 pt-6">
            <div className={`rounded-md h-4 w-32 ${BLOCK}`} />
            <div className={`rounded-md h-3 w-full ${BLOCK}`} />
            <div className={`rounded-md h-3 w-2/3 ${BLOCK}`} />
            <div className={`mt-1 h-8 w-40 rounded-full ${BLOCK}`} />
          </div>
        </div>
        {/* The notifications card, beside the account on wide screens. */}
        <div aria-hidden className={`hidden lg:flex ${CARD}`}>
          <div className="flex flex-col gap-2">
            <div className={`rounded-md h-4 w-28 ${BLOCK}`} />
            <div className={`rounded-md h-3 w-full ${BLOCK}`} />
            <div className={`mt-1 h-8 w-36 rounded-full ${BLOCK}`} />
            <div className={`mt-4 rounded-md h-4 w-40 ${BLOCK}`} />
            <div className={`h-9 w-full rounded-lg ${BLOCK}`} />
          </div>
        </div>
      </div>
    </ProfileShell>
  );
}
