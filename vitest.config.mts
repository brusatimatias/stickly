import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Run tests far from both UTC (Vercel) and Argentina (local dev), so code that
// silently depends on the server's time zone fails here instead of in prod.
process.env.TZ = "Pacific/Kiritimati";

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
