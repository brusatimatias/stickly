import type { ReactNode } from "react";

/** The bar at the top of a page. The loading skeletons use it too, so nothing shifts when the page arrives. */
export default function PageHeader({ children }: { children: ReactNode }) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      {children}
    </header>
  );
}
