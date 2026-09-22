import { DescriptionIcon } from "@/components/board/icons";

/** Small hover indicator revealing a note's description, used by both NoteCard and DraftCard. */
export default function DescriptionIndicator({ description }: { description: string }) {
  return (
    <div className="group/desc relative shrink-0" onClick={(event) => event.stopPropagation()}>
      <DescriptionIcon className="h-3 w-3 opacity-60" />
      <div className="pointer-events-none absolute right-0 top-full z-10 mt-1 w-36 whitespace-normal rounded bg-zinc-900 p-1.5 text-[10px] leading-snug text-white opacity-0 shadow-lg transition-opacity group-hover/desc:opacity-90 dark:bg-zinc-100 dark:text-zinc-900">
        {description}
      </div>
    </div>
  );
}
