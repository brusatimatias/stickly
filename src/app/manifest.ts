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
    icons: [
      { src: "/apple-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/apple-icon/512", sizes: "512x512", type: "image/png" },
    ],
  };
}
