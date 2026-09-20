import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import ProfileForm from "@/components/profile/ProfileForm";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/");
  }

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { name: true, email: true, avatarUrl: true, imageUrl: true, password: true },
  });

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-50"
        >
          Stickly
        </Link>
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
