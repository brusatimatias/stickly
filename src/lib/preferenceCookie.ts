import { cookies } from "next/headers";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

/** Stores a UI preference (locale, theme) in a year-long cookie. */
export async function setPreferenceCookie(name: string, value: string) {
  const cookieStore = await cookies();
  cookieStore.set(name, value, { path: "/", maxAge: ONE_YEAR_SECONDS });
}
