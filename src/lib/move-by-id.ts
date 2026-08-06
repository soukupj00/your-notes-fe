/**
 * Move the entry with `activeId` to where `overId` currently sits.
 *
 * The one reorder primitive every sortable list uses - the toolbar's families
 * and leaves, and the quick-capture starts - and it lives beside
 * `reconcileOrder` for the same reason: both answer "the user arranged this
 * list", and getting either subtly different in two places is how a feature
 * grows two behaviours.
 *
 * Deliberately `id`-based rather than index-based: `@dnd-kit` reports a drag as
 * two ids, and translating those to indices at every call site is where an
 * off-by-one lives. An id the list does not hold is a no-op rather than a throw
 * - a drag can end over nothing at all.
 */
export function moveById<T extends { id: string }>(
  list: T[],
  activeId: string,
  overId: string
): T[] {
  const from = list.findIndex((entry) => entry.id === activeId);
  const to = list.findIndex((entry) => entry.id === overId);
  if (from === -1 || to === -1 || from === to) return list;

  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
