import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/profile/ProfileForm";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { ChevronLeftIcon } from "@/components/board/icons";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const [user, t] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: session.user.id },
      select: { name: true, email: true, avatarUrl: true, imageUrl: true, password: true },
    }),
    getTranslations("profile"),
  ]);

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link
          href="/"
          className="flex items-center gap-1 rounded-full py-1.5 pr-3 pl-1.5 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          {t("backToBoard")}
        </Link>
        <LocaleSwitcher />
      </header>
      <div className="flex flex-1 justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
        <ProfileForm
          name={user.name ?? ""}
          email={user.email}
          avatarSrc={user.avatarUrl ?? user.imageUrl}
          hasPassword={Boolean(user.password)}
        />
      </div>
    </div>
  );
}
