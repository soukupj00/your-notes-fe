/**
 * Held rank, live membership (ADR 0012): a note on screen keeps its place after an edit. A
 * newcomer goes after the last incumbent that outranks it in `fresh`, which holds under any sort
 * (newcomers-first breaks `title asc`) however far the held order has drifted from fresh order.
 */
export function mergeHeldOrder<T extends { id: string }>(fresh: T[], held: readonly string[]): T[] {
  if (fresh.length === 0) return fresh;

  const freshById = new Map(fresh.map((item) => [item.id, item]));

  // This filter is what makes membership live: a trashed or filtered-out note leaves at once.
  const incumbents = held.flatMap((id) => {
    const item = freshById.get(id);
    return item ? [item] : [];
  });
  if (incumbents.length === 0) return fresh;

  const heldIndex = new Map(incumbents.map((item, index) => [item.id, index]));

  // Newcomers grouped by the incumbent they follow; -1 means "before them all". As `fresh` is
  // sorted, the highest held index seen so far is the last incumbent outranking the newcomer.
  const byAnchor = new Map<number, T[]>();
  let anchor = -1;
  for (const item of fresh) {
    const index = heldIndex.get(item.id);
    if (index !== undefined) {
      anchor = Math.max(anchor, index);
      continue;
    }
    const group = byAnchor.get(anchor);
    if (group) group.push(item);
    else byAnchor.set(anchor, [item]);
  }

  // Pushed in fresh order above, so newcomers sharing an anchor stay in it.
  const merged: T[] = [...(byAnchor.get(-1) ?? [])];
  incumbents.forEach((item, index) => {
    merged.push(item);
    const group = byAnchor.get(index);
    if (group) merged.push(...group);
  });

  return merged;
}
