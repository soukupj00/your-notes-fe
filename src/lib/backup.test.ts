// @vitest-environment node
// jsdom's structured-clone shim reads a stored Blob back as a plain object, so
// every Blob round-trip through Dexie has to run under Node's real Blob.
import { strToU8, unzipSync, zipSync } from 'fflate';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import {
  BACKUP_MANIFEST_NAME,
  BACKUP_VERSION,
  BackupError,
  buildBackupZip,
  parseBackupZip,
  restoreBackup,
} from '@/lib/backup.ts';
import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';
import { clearNotesDb } from '@/test/db.ts';

const NOW = '2026-07-28T10:00:00.000Z';

const note: Note = {
  id: 'note-1',
  header: 'Backup me',
  body: '<p>hello</p>',
  state: 'active',
  pinnedAt: NOW,
  color: 'sage',
  createdAt: NOW,
  updatedAt: NOW,
};

const tag: Tag = { id: 'tag-1', name: 'Work', color: 'sky', createdAt: NOW, updatedAt: NOW };
const noteTag: NoteTag = { noteId: note.id, tagId: tag.id, createdAt: NOW, updatedAt: NOW };

/** Bytes that are not valid UTF-8, so a text-mangling round-trip would corrupt them. */
const BINARY = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x01]);
const THUMB = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00]);

const attachment: Attachment = {
  id: 'att-1',
  noteId: note.id,
  kind: 'image',
  mime: 'image/png',
  blob: new Blob([BINARY], { type: 'image/png' }),
  thumbnail: new Blob([THUMB], { type: 'image/webp' }),
  name: 'shot.png',
  size: BINARY.length,
  createdAt: NOW,
  updatedAt: NOW,
};

async function seed() {
  await db.notes.put(note);
  await db.tags.put(tag);
  await db.noteTags.put(noteTag);
  await db.attachments.put(attachment);
  await db.settings.put({ key: 'preferences', value: { version: 1, density: 'compact' } });
}

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** Round-trips a hand-built manifest through the real zip layout. */
function zipWith(manifest: unknown, extra: Record<string, Uint8Array> = {}): Uint8Array {
  return zipSync({ [BACKUP_MANIFEST_NAME]: strToU8(JSON.stringify(manifest)), ...extra });
}

describe('backup', () => {
  beforeEach(async () => {
    await clearNotesDb();
  });

  it('round-trips notes, tags, relations, settings and binary attachments', async () => {
    await seed();

    const zipped = await bytesOf(await buildBackupZip());

    // Wipe everything, so a passing assertion can only come from the restore.
    await clearNotesDb();
    expect(await db.notes.count()).toBe(0);

    const parsed = await parseBackupZip(zipped);
    await restoreBackup(parsed);

    expect(await db.notes.toArray()).toEqual([note]);
    expect(await db.tags.toArray()).toEqual([tag]);
    expect(await db.noteTags.toArray()).toEqual([noteTag]);
    expect(await db.settings.get('preferences')).toEqual({
      key: 'preferences',
      value: { version: 1, density: 'compact' },
    });

    const restored = await db.attachments.get(attachment.id);
    expect(restored).toBeDefined();
    expect(restored?.mime).toBe('image/png');
    expect(restored?.name).toBe('shot.png');
    expect(await bytesOf(restored?.blob as Blob)).toEqual(BINARY);
    expect(restored?.blob.type).toBe('image/png');
    expect(await bytesOf(restored?.thumbnail as Blob)).toEqual(THUMB);
  });

  it('writes the attachment bytes as their own zip entries, not inside the manifest', async () => {
    await seed();

    const entries = unzipSync(await bytesOf(await buildBackupZip()));

    expect(Object.keys(entries).sort()).toEqual([
      'attachments/att-1',
      'attachments/att-1.thumb',
      BACKUP_MANIFEST_NAME,
    ]);
    expect(entries['attachments/att-1']).toEqual(BINARY);
  });

  it('restores an empty database from an empty backup', async () => {
    const zipped = await bytesOf(await buildBackupZip());
    const parsed = await parseBackupZip(zipped);
    await restoreBackup(parsed);

    expect(await db.notes.count()).toBe(0);
    expect(await db.attachments.count()).toBe(0);
  });

  it('replaces existing rows rather than merging into them', async () => {
    await seed();
    const zipped = await bytesOf(await buildBackupZip());

    await clearNotesDb();
    await db.notes.put({ ...note, id: 'stale-note', header: 'Should not survive' });

    await restoreBackup(await parseBackupZip(zipped));

    expect(await db.notes.get('stale-note')).toBeUndefined();
    expect(await db.notes.count()).toBe(1);
  });

  describe('validation', () => {
    /** Every rejection has to happen before the destructive part of the restore. */
    async function expectRejectedWithDbIntact(bytes: Uint8Array, code: string) {
      await seed();
      await expect(parseBackupZip(bytes)).rejects.toMatchObject({ code });
      expect(await db.notes.count()).toBe(1);
      expect(await db.attachments.count()).toBe(1);
    }

    it('rejects bytes that are not a zip', async () => {
      await expectRejectedWithDbIntact(strToU8('definitely not a zip'), 'invalid-zip');
    });

    it('rejects a zip without a manifest', async () => {
      await expectRejectedWithDbIntact(
        zipSync({ 'notes.json': strToU8('[]') }),
        'missing-manifest'
      );
    });

    it('rejects a manifest that is not valid JSON', async () => {
      await expectRejectedWithDbIntact(
        zipSync({ [BACKUP_MANIFEST_NAME]: strToU8('{ not json') }),
        'invalid-manifest'
      );
    });

    it('rejects a manifest whose rows fail the schema', async () => {
      await expectRejectedWithDbIntact(
        zipWith({
          version: BACKUP_VERSION,
          exportedAt: NOW,
          // `state` is required and 'nonsense' is not a lifecycle stage.
          notes: [{ id: 'x', state: 'nonsense', createdAt: NOW, updatedAt: NOW }],
          tags: [],
          noteTags: [],
          attachments: [],
          settings: [],
        }),
        'invalid-manifest'
      );
    });

    it('rejects a backup written by a newer format version', async () => {
      await expectRejectedWithDbIntact(
        zipWith({
          version: BACKUP_VERSION + 1,
          exportedAt: NOW,
          notes: [],
          tags: [],
          noteTags: [],
          attachments: [],
          settings: [],
        }),
        'unsupported-version'
      );
    });

    it('rejects a manifest referencing attachment bytes the zip does not contain', async () => {
      await expectRejectedWithDbIntact(
        zipWith({
          version: BACKUP_VERSION,
          exportedAt: NOW,
          notes: [],
          tags: [],
          noteTags: [],
          attachments: [
            {
              id: 'att-1',
              noteId: 'note-1',
              kind: 'image',
              mime: 'image/png',
              createdAt: NOW,
              updatedAt: NOW,
            },
          ],
          settings: [],
        }),
        'missing-attachment'
      );
    });

    it('reports a missing thumbnail entry the manifest promised', async () => {
      await expectRejectedWithDbIntact(
        zipWith(
          {
            version: BACKUP_VERSION,
            exportedAt: NOW,
            notes: [],
            tags: [],
            noteTags: [],
            attachments: [
              {
                id: 'att-1',
                noteId: 'note-1',
                kind: 'image',
                mime: 'image/png',
                hasThumbnail: true,
                createdAt: NOW,
                updatedAt: NOW,
              },
            ],
            settings: [],
          },
          { 'attachments/att-1': BINARY }
        ),
        'missing-attachment'
      );
    });

    it('carries a code on BackupError so callers can translate it', () => {
      expect(new BackupError('invalid-zip')).toBeInstanceOf(Error);
      expect(new BackupError('invalid-zip').code).toBe('invalid-zip');
    });
  });
});
