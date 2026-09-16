/** Inserts `item` at `index` in `items`, clamping to a valid position. */
export function insertAtIndex<T>(items: T[], item: T, index: number): T[] {
  const insertAt = Math.min(Math.max(index, 0), items.length);
  const result = [...items];
  result.splice(insertAt, 0, item);
  return result;
}
