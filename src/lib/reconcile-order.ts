/**
 * ADR 0011 decision 8, shared by the toolbar and quick capture. A registry id missing from the
 * stored list is new, so it appears; a stored id missing from the registry is kept, so a failed
 * lazy chunk cannot erase an arrangement the user built by hand.
 */
export function reconcileOrder<T extends { id: string }>(
  stored: T[],
  registryIds: string[],
  createDefault: (id: string) => T
): T[] {
  const result = [...stored];

  registryIds.forEach((id, registryIndex) => {
    if (result.some((entry) => entry.id === id)) return;
    // Land it before the nearest registry sibling that follows it and is already
    // present; with none, the tail is as close to "its position" as we can get.
    const following = registryIds.slice(registryIndex + 1);
    const anchor = result.findIndex((entry) => following.includes(entry.id));
    result.splice(anchor === -1 ? result.length : anchor, 0, createDefault(id));
  });

  return result;
}
