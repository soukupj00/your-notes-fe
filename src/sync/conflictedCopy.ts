import type { LocalStore } from '@/data/LocalStore.ts';
import { extractAttachmentIds, repointAttachment } from '@/lib/body.ts';
import { cloneAttachment, mintId, newNote, newNoteTag, newTag } from '@/lib/rows.ts';
import type { Attachment, Note } from '@/models.ts';

/**
 * The Tag every Conflicted Copy carries, so `/tag/$id` is the place to review
 * them (04-sync.md). Found by name, created on first use, synced like any Tag.
 * English on purpose: it is data that reaches Devices in every language.
 */
export const CONFLICTS_TAG_NAME = 'Conflicts';

/** `Groceries (conflict from Pixel 8, 2026-09-28)`: whose version it was, and when it lost. */
export function conflictedHeader(header: string | undefined, deviceName: string, at: Date) {
  const title = header?.trim() || 'Untitled';
  return `${title} (conflict from ${deviceName}, ${at.toISOString().slice(0, 10)})`;
}

async function conflictsTagId(store: LocalStore, now: string): Promise<string> {
  const found = await store.tags.findByName(CONFLICTS_TAG_NAME);
  if (found) return found.id;
  const tag = newTag(CONFLICTS_TAG_NAME, undefined, now);
  await store.tags.add(tag);
  return tag.id;
}

/**
 * Keeps this Device's losing version as a Conflicted Copy (CONTEXT.md), tagged "Conflicts".
 * Attachments are cloned under new ids so each keeps one owner (ADR 0017); bytes not downloaded
 * here are fetched first, as nobody else could upload them under the new id. Returns the Tag's id.
 */
export async function keepConflictedCopy(
  store: LocalStore,
  local: Note,
  deviceName: string,
  at = new Date(),
  fetchBytes: (id: string) => Promise<Blob | undefined> = async () => undefined
): Promise<string> {
  const now = at.toISOString();
  const id = mintId();

  const clones: { from: string; clone: Attachment }[] = [];
  for (const from of extractAttachmentIds(local.body)) {
    const row = await store.attachments.get(from);
    if (!row) continue;
    // ponytail: bytes the server does not have either are lost to the copy; it keeps the metadata.
    const blob = row.blob ?? (await fetchBytes(from).catch(() => undefined));
    clones.push({ from, clone: cloneAttachment(blob ? { ...row, blob } : row, id, now) });
  }
  let body = local.body;
  for (const { from, clone } of clones) {
    if (body) body = repointAttachment(body, from, clone.id);
  }

  await store.notes.add(
    newNote({ ...local, id, header: conflictedHeader(local.header, deviceName, at), body }, now)
  );
  for (const { clone } of clones) await store.attachments.add(clone);

  const tagIds = (await store.tags.listLinks())
    .filter((l) => l.noteId === local.id)
    .map((l) => l.tagId);
  const conflicts = await conflictsTagId(store, now);
  for (const tagId of new Set([...tagIds, conflicts])) {
    await store.tags.link(newNoteTag(id, tagId, now));
  }
  return conflicts;
}
