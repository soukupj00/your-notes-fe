/**
 * Asks the browser to make this origin's storage persistent.
 *
 * Everything the user owns lives in IndexedDB, which is best-effort by default:
 * Chrome evicts under storage pressure and Safari clears it after seven days
 * without a visit to the origin, which for a note app on a phone is an ordinary
 * fortnight. The only recourse is a zip the user may never have exported.
 *
 * Asked when the user first saves a note of their own, not at app start:
 * Firefox shows a permission prompt, and a fresh user should not meet one
 * before they have written anything - during the Tour, which is where an
 * app-start call would land it. A Tour's Props never reach here, because the
 * only caller is the editor's dirty-gated save path.
 */
let asked = false;

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
