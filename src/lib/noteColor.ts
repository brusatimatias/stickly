const PALETTE = [
  { bg: "bg-yellow-200", border: "border-yellow-300", text: "text-yellow-950" },
  { bg: "bg-pink-200", border: "border-pink-300", text: "text-pink-950" },
  { bg: "bg-sky-200", border: "border-sky-300", text: "text-sky-950" },
  { bg: "bg-green-200", border: "border-green-300", text: "text-green-950" },
  { bg: "bg-purple-200", border: "border-purple-300", text: "text-purple-950" },
] as const;

const ROTATIONS = ["-rotate-2", "-rotate-1", "rotate-1", "rotate-2", "rotate-3", "-rotate-3"] as const;

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getNoteStyle(id: string) {
  const hash = hashString(id);
  return {
    ...PALETTE[hash % PALETTE.length],
    rotation: ROTATIONS[hash % ROTATIONS.length],
  };
}
