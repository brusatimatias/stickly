import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";
import { FOCUS_RING } from "@/components/focusRing";

export default async function SignOutButton() {
  const t = await getTranslations("auth");
  return (
    <form
      action={async () => {
        "use server";
        await signOut();
      }}
    >
      <button
        type="submit"
        className={`whitespace-nowrap rounded-full border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 sm:px-4 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900 ${FOCUS_RING}`}
      >
        {t("signOut")}
      </button>
    </form>
  );
}
