/**
 * Held feed rank (ADR 0012).
 *
 * A feed's *membership* is live, but its *rank* is held: a note already on
 * screen must not change place because of something the user just did to it.
 * Without this, ticking a checkbox or recolouring a card writes the note, bumps
 * `updatedAt`, and sends the card to the top of a wall sorted by recency - so
 * the second tick lands on whatever slid underneath the thumb.
 */

/**
 * The freshly sorted feed, re-ordered to respect the order that was last shown.
 *
 * Incumbents (ids present in `held`) keep the held order. A note absent from
 * `held` is a newcomer and is placed **after the last incumbent that outranks
 * it in the fresh order**.
 *
 * That anchoring rule is the whole of the difficulty. Simply putting newcomers
 * at the front is right under `updated desc` and wrong under `title asc`, where
 * a new note called "Zebra" belongs last. Walking the two sequences in step
 * doesn't work either, because the held order is *deliberately* not in fresh
 * order - that disagreement is the feature. Anchoring to a running maximum is
 * what survives both: it asks only "which incumbents does this newcomer beat?",
 * a question that stays meaningful however scrambled the held order has become.
 *
 * An empty `held` returns `fresh` unchanged, so "no held order yet" needs no
 * special case at the call site.
 */
export function mergeHeldOrder<T extends { id: string }>(fresh: T[], held: readonly string[]): T[] {
  if (fresh.length === 0) return fresh;

  const freshById = new Map(fresh.map((item) => [item.id, item]));

  // Held ids that are still in the feed. Filtering here is what makes membership
  // live: a trashed or filtered-out note leaves at once, however high it ranked.
  const incumbents = held.flatMap((id) => {
    const item = freshById.get(id);
    return item ? [item] : [];
  });
  if (incumbents.length === 0) return fresh;

  const heldIndex = new Map(incumbents.map((item, index) => [item.id, index]));

  // Newcomers grouped by the incumbent they follow; -1 means "before them all".
  // One pass over `fresh` suffices: because it is already sorted, the highest
  // held index seen so far *is* the last incumbent outranking the newcomer we
  // are looking at.
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
