/**
 * The one reorder primitive for every sortable list, so "the user arranged this" behaves one way.
 * By id because `@dnd-kit` reports a drag as two ids. An unknown id is a no-op, as a drag can end
 * over nothing.
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
