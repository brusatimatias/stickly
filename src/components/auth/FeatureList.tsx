import { useTranslations } from "next-intl";

const FEATURE_KEYS = [
  "featureBoard",
  "featureDrag",
  "featureCalendar",
  "featureDrafts",
  "featureChat",
  "featureWhatsApp",
] as const;

export default function FeatureList() {
  const t = useTranslations("auth");

  return (
    <ul className="w-full space-y-2 text-left text-sm text-zinc-600 dark:text-zinc-300">
      {FEATURE_KEYS.map((key) => (
        <li key={key} className="flex items-start gap-2">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
          {t(key)}
        </li>
      ))}
    </ul>
  );
}
