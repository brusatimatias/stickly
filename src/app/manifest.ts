import type { MetadataRoute } from "next";
import { THEME_BACKGROUNDS } from "@/lib/siteMetadata";

/**
 * Makes Stickly installable, which iOS requires for push notifications (only
 * apps added to the home screen get them). Static and in English, like the
 * rest of the metadata images.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stickly",
    short_name: "Stickly",
    description: "Notes and reminders on a weekly whiteboard.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: THEME_BACKGROUNDS.light,
    theme_color: THEME_BACKGROUNDS.light,
    // Opaque and full bleed, so they work as is and cropped to the launcher's
    // shape (maskable); without a maskable one Android puts the icon on a
    // white circle.
    icons: [192, 512].flatMap((size) =>
      (["any", "maskable"] as const).map((purpose) => ({
        src: `/apple-icon/${size}`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      }))
    ),
  };
}
