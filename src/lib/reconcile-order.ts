/**
 * Bring a stored, user-ordered list up to date with the registry that defines
 * what may be in it, without losing either side's information.
 *
 * This is ADR 0011's decision 8, and it is shared by the toolbar and by quick
 * capture because both are "a list the user arranged, against a list the app
 * ships" - and because getting it subtly different in two places is how a
 * feature grows two behaviours.
 *
 * It cuts both ways:
 *
 * - A registry id missing from the stored list is **new**, not hidden, so a
 *   button shipped next release appears for a user who arranged their bar last
 *   year. Anything else would make new work invisible to exactly the users who
 *   care most.
 * - A stored id missing from the registry is **kept**, so a temporarily
 *   unregistered extension (a lazy chunk that failed, a build that dropped one)
 *   cannot quietly erase an arrangement the user built by hand.
 *
 * Missing entries are processed in registry order, so a run of several new ones
 * lands in the right order relative to each other too.
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
