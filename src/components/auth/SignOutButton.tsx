import { getTranslations } from "next-intl/server";
import { signOut } from "@/auth";

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
        className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {t("signOut")}
      </button>
    </form>
  );
}
