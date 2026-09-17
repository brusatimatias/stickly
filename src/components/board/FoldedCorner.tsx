export default function FoldedCorner() {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 bg-black/15 [clip-path:polygon(100%_0,100%_100%,0_100%)]"
    />
  );
}
