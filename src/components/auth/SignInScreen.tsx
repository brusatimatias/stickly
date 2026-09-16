import { signIn } from "@/auth";

export default function SignInScreen() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Sticly
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Sign in to see your weekly board.
      </p>
      <form
        action={async () => {
          "use server";
          await signIn("google");
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-3 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Sign in with Google
        </button>
      </form>
    </div>
  );
}
