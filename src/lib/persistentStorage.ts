let asked = false;

/**
 * IndexedDB is best-effort: Chrome evicts under pressure and Safari clears it after seven unvisited
 * days. Asked on the user's first own save, not at start, so Firefox's prompt never meets a fresh
 * user mid-Tour.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (asked) return;
  asked = true;
  // Absent in Safari <15.2 and in jsdom; a missing API is a no-op, not an error.
  if (!navigator.storage?.persist) return;
  try {
    // Already granted (Chrome grants silently on engagement) means no prompt to
    // spend, and asking again is how a denied Firefox user gets re-prompted.
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    // A refusal is not a failure the user can act on here; the Settings storage
    // row is where the answer is reported.
  }
}

/** Test seam: the once-per-session latch is module state. */
export function resetPersistentStorageRequest(): void {
  asked = false;
}
