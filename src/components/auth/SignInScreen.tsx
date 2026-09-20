import { getTranslations } from "next-intl/server";
import type { CSSProperties } from "react";
import { signIn } from "@/auth";
import CredentialsSignInForm from "@/components/auth/CredentialsSignInForm";
import FoldedCorner from "@/components/board/FoldedCorner";
import LocaleSwitcher from "@/components/LocaleSwitcher";

const STICKER_PALETTE = [
  { bg: "bg-yellow-200", border: "border-yellow-300" },
  { bg: "bg-pink-200", border: "border-pink-300" },
  { bg: "bg-sky-200", border: "border-sky-300" },
  { bg: "bg-green-200", border: "border-green-300" },
  { bg: "bg-purple-200", border: "border-purple-300" },
  { bg: "bg-orange-200", border: "border-orange-300" },
  { bg: "bg-teal-200", border: "border-teal-300" },
  { bg: "bg-indigo-200", border: "border-indigo-300" },
  { bg: "bg-rose-200", border: "border-rose-300" },
  { bg: "bg-lime-200", border: "border-lime-300" },
] as const;

const STICKER_SIZE = "h-[7.2rem] w-[7.2rem] sm:h-36 sm:w-36";

const STICKER_COUNT = 14;

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

// Two rings (an inner one that can peek out from behind the card, an outer
// one further from center) so stickers scatter and overlap without ever
// fully covering the sign-in card in the middle.
function buildStickers() {
  return Array.from({ length: STICKER_COUNT }, (_, index) => {
    const ring = index % 2 === 0 ? [2, 30] : [58, 90];
    const top = randomBetween(2, 92);
    const left = Math.random() < 0.5 ? randomBetween(ring[0], ring[1]) : randomBetween(100 - ring[1], 100 - ring[0]);
    return {
      key: index,
      top,
      left,
      rotation: randomBetween(-20, 20),
      driftX: randomBetween(-10, 10),
      driftY: randomBetween(-12, 12),
      duration: randomBetween(5, 9),
      delay: randomBetween(0, 4),
      ...randomItem(STICKER_PALETTE),
    };
  });
}

export default async function SignInScreen() {
  const t = await getTranslations("auth");
  const stickers = buildStickers();
  const features = [t("featureBoard"), t("featureDrag"), t("featureCalendar")];

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden bg-zinc-50 px-6 py-16 dark:bg-black">
      <div className="absolute right-4 top-4 z-10">
        <LocaleSwitcher />
      </div>
      {stickers.map((sticker) => (
        <div
          key={sticker.key}
          aria-hidden
          className="absolute animate-sticker-float"
          style={
            {
              top: `${sticker.top}%`,
              left: `${sticker.left}%`,
              "--sticker-drift-x": `${sticker.driftX}px`,
              "--sticker-drift-y": `${sticker.driftY}px`,
              "--sticker-duration": `${sticker.duration}s`,
              animationDelay: `${sticker.delay}s`,
            } as CSSProperties
          }
        >
          <div
            className={`relative flex flex-col gap-1.5 rounded-sm border p-3 shadow-[2px_4px_6px_rgba(0,0,0,0.2)] ${STICKER_SIZE} ${sticker.bg} ${sticker.border}`}
            style={{ transform: `rotate(${sticker.rotation}deg)` }}
          >
            <span className="h-1.5 w-2/3 rounded-full bg-black/15" />
            <span className="h-1.5 w-full rounded-full bg-black/15" />
            <span className="h-1.5 w-1/2 rounded-full bg-black/15" />
            <FoldedCorner />
          </div>
        </div>
      ))}

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center gap-6 rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Stickly
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("tagline")}
        </p>

        <ul className="w-full space-y-2 text-left text-sm text-zinc-600 dark:text-zinc-300">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              {feature}
            </li>
          ))}
        </ul>

        <form
          action={async () => {
            "use server";
            await signIn("google");
          }}
          className="w-full"
        >
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-3 rounded-full border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.94H1.29v3.1A12 12 0 0 0 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.29 14.3a7.2 7.2 0 0 1 0-4.6v-3.1H1.29a12 12 0 0 0 0 10.8z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.6l4 3.1C6.23 6.86 8.88 4.75 12 4.75z"
              />
            </svg>
            {t("signInWithGoogle")}
          </button>
        </form>

        <div className="flex w-full items-center gap-3 text-xs text-zinc-400 dark:text-zinc-500">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          {t("or")}
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <CredentialsSignInForm />
      </div>
    </div>
  );
}
