import { SharedNote } from '@/contract/index.ts';
import { ProblemError } from './hal.ts';

/** Whether a path is a Share Link's page (`shareLink` in the contract), which a stranger opens. */
export const isSharePath = (pathname: string) => pathname.startsWith('/share/');

/**
 * What a Share Link shows (CONTEXT.md "Share Link"), read with no Account.
 * Not on `AccountService`: whoever opens the link is a stranger to the server.
 *
 * The one address written by hand: the HAL root does not list the public route,
 * and a stranger has no link to follow to it. Everything past it (the blobs)
 * comes from the page's own `_links`.
 */
export async function fetchSharedNote(
  token: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args)
): Promise<SharedNote | 'gone'> {
  const response = await fetchImpl(`/api/public/shares/${encodeURIComponent(token)}`, {
    // The page needs no identity, so it sends none.
    credentials: 'omit',
    headers: { accept: 'application/hal+json, application/json' },
  });
  // Revoked, unknown and trashed all read the same on the server: "Nothing is shared here".
  if (response.status === 404) return 'gone';
  if (!response.ok) {
    throw new ProblemError(response.status, response.statusText || `HTTP ${response.status}`);
  }
  return SharedNote.parse(await response.json());
}

/** An Attachment's bytes (or its `thumbnailId`'s), from the shared page's `blobs` template. */
export function sharedBlobUrl(shared: SharedNote, id: string): string {
  return shared._links.blobs.href.replace(/\{id\}/g, encodeURIComponent(id));
}
