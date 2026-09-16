export default function FoldedCorner() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 border-[14px] border-t-transparent border-r-transparent border-b-black/10 border-l-black/10 [filter:drop-shadow(-1px_-1px_1px_rgba(0,0,0,0.15))]"
    />
  );
}
