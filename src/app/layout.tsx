import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { InstallPromptListener } from "@/components/installPrompt";
import { getSiteUrl, getThemeColor } from "@/lib/siteMetadata";
import { THEME_COOKIE_NAME, isTheme } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  const description = t("description");
  // The Open Graph image comes from `opengraph-image.tsx`; X falls back to it.
  return {
    metadataBase: getSiteUrl(),
    title: { default: "Stickly", template: "%s · Stickly" },
    description,
    applicationName: "Stickly",
    openGraph: { type: "website", siteName: "Stickly", title: "Stickly", description, url: "/" },
    twitter: { card: "summary_large_image", title: "Stickly", description },
  };
}

// Depends on the THEME cookie, hence `generateViewport` and not a static object.
export async function generateViewport(): Promise<Viewport> {
  const themeCookie = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  return { themeColor: getThemeColor(isTheme(themeCookie) ? themeCookie : null) };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const messages = await getMessages();
  const themeCookie = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const theme = isTheme(themeCookie) ? themeCookie : "";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased ${theme}`}
    >
      <body className="min-h-full flex flex-col">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
          <InstallPromptListener />
          <Analytics />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
