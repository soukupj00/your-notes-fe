# M3 Slice 1 — Attachment storage + inline Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the whole attachment pipeline end to end - editor node → Dexie `Blob` storage → render (in editor + read-only cards) → lifecycle/GC - driven through inline images, on a storage foundation every later media slice reuses.

**Architecture:** One generic `attachments` Dexie table (`kind` discriminator, `Blob` payload per [ADR 0007](../../adr/0007-blob-over-base64-for-attachment-payloads.md)). The Body HTML owns presence + position via `<img data-attachment-id="{uuid}">` (no `src` persisted); the table owns bytes + metadata. A custom TipTap `imageAttachment` node resolves `attachmentId → Blob → object URL` in a React NodeView; a shared `<NoteBody>` does the same for read-only previews. Lifecycle is eager-create / never-eager-delete / GC-sweep-on-close, with note-level delete/undo cascading in the same transaction. A brand-new draft is persisted on first image insert via the dialog's `ensureNoteId()` so the attachment FK is always valid.

**Tech Stack:** React 19, TypeScript, Dexie (IndexedDB), TipTap v3 (`@tiptap/core` + `@tiptap/react`), Vitest + React Testing Library + `fake-indexeddb`, i18next, sonner (toasts).

## Global Constraints

- Package manager is **pnpm**. Run `pnpm test`, `pnpm build`, `pnpm check` - never npm/yarn.
- **IDs**: `uuid` v4 (`import { v4 as uuid } from 'uuid'`).
- **Timestamps**: ISO strings via `new Date().toISOString()` on `createdAt` + `updatedAt`.
- **Payload is a native `Blob`**, never base64 / `data:` URI (ADR 0007).
- **Body persists `<img data-attachment-id>` with NO `src`** - the id-reference scheme is the whole point; a persisted `src` is a defect.
- **Icons** are string keys in `src/components/icons/icons.ts` - never import a Lucide component into an extension button config.
- **New TipTap extensions** follow Pattern A ([ADR 0004](../../adr/0004-canonical-editor-toolbar-pattern.md)): `ExtensionName.ts` + `index.ts`, button factory returning `{ component, componentProps }`.
- **No em dashes** in code, comments, or docs - use a plain `-`.
- **DB schema changes** bump the Dexie `version()` and update the `NotesDB` class fields.
- Keep files under 500 lines. Never save working files/tests to repo root.
- `@/` resolves to `src/`. Use it for all internal imports.
- Each task lands **with its tests in the same change** and a commit. `pnpm test` + `pnpm build` stay green at every task boundary.

---

## File Structure

**Create:**
- `src/lib/attachments.ts` - pure validation: MIME whitelist, size cap, `AttachmentError`, `validateImageFile`.
- `src/lib/attachment-html.ts` - pure HTML helpers: `bodyHasAttachment`, `extractAttachmentIds`.
- `src/lib/attachments.test.ts`, `src/lib/attachment-html.test.ts`
- `src/hooks/data/useAttachmentActions.ts` - `createAttachment` / `getAttachment` / `deleteAttachment` / `cloneAttachment` / `collectOrphans` / `collectMissingNoteOrphans`.
- `src/hooks/data/useAttachmentActions.test.ts`
- `src/components/editor/extensions/Image/ImageNodeView.tsx` - React NodeView (blob → object URL, revoke on unmount, loading + broken states).
- `src/components/editor/extensions/Image/ImageButton.tsx` - custom toolbar button (hidden file input).
- `src/components/editor/extensions/Image/insert.ts` - `insertImageFiles` pipeline + `dedupeForeignImages` (clone-on-insert).
- `src/components/editor/extensions/Image/Image.test.ts` - headless node test.
- `src/components/editor/extensions/Image/ImageNodeView.test.tsx` - RTL NodeView test.
- `src/components/NoteBody.tsx` - shared read-only hydrating renderer.
- `src/components/NoteBody.test.tsx`

**Modify:**
- `src/models.ts` - drop `NoteImage`/`NoteAudio`/`NoteFile` + embedded arrays; add `Attachment` + `AttachmentKind`.
- `src/db/db.ts` - `version(2)`: add `attachments`, drop `images`/`audios`/`files`.
- `src/hooks/data/useNoteActions.ts` - `deleteNote` returns `{ removedTags, removedAttachments }` + cascade; `restoreNote` re-puts both.
- `src/components/editor/extensions/Image/Image.ts` - `createImage(deps)` node factory + Pattern A button (currently empty).
- `src/components/editor/editor.tsx` - register `createImage`; `getNoteId` prop; paste/drop handlers.
- `src/components/icons/icons.ts` - add `ImagePlus`.
- `src/components/cards/NoteCard.tsx` - use `<NoteBody>`; update `handleDelete` for new `deleteNote` return.
- `src/components/notes/NoteEditorDialog.tsx` - `isEmpty` via `bodyHasAttachment`; `ensureNoteId`; pass `getNoteId` to `Editor`; `collectOrphans` on close.
- `src/components/cards/NoteCard.test.tsx` - update the `deleteNote`/`restoreNote` mock shape.
- `public/locales/en/translation.json`, `public/locales/cs/translation.json` - image button tooltip + validation toast strings.

---

## Task 1: Data model + schema migration

**Files:**
- Modify: `src/models.ts:1-61`
- Modify: `src/db/db.ts:1-25`
- Test: `src/hooks/data/useAttachmentActions.test.ts` (created here, minimal round-trip; grows in Task 3)

**Interfaces:**
- Produces: `Attachment` interface + `AttachmentKind` type (see below); `db.attachments: Table<Attachment, string>` keyed by `id`, indexed `noteId, kind`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/data/useAttachmentActions.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import type { Attachment } from '@/models.ts';

function makeAttachment(overrides: Partial<Attachment> = {}): Attachment {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    noteId: crypto.randomUUID(),
    kind: 'image',
    mime: 'image/png',
    blob: new Blob(['x'], { type: 'image/png' }),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('attachments table', () => {
  it('round-trips an Attachment row with its Blob', async () => {
    const att = makeAttachment();
    await db.attachments.put(att);
    const read = await db.attachments.get(att.id);
    expect(read?.id).toBe(att.id);
    expect(read?.kind).toBe('image');
    expect(read?.blob).toBeInstanceOf(Blob);
  });

  it('indexes attachments by noteId', async () => {
    const noteId = crypto.randomUUID();
    await db.attachments.bulkPut([makeAttachment({ noteId }), makeAttachment({ noteId })]);
    const rows = await db.attachments.where('noteId').equals(noteId).toArray();
    expect(rows).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/hooks/data/useAttachmentActions.test.ts`
Expected: FAIL - `db.attachments` is undefined / `Attachment` not exported from `@/models.ts`.

- [ ] **Step 3: Add the `Attachment` model**

In `src/models.ts`, remove the embedded media arrays from `Note` (delete the `audio?`, `images?`, `files?` lines - keep `tags?`) and delete the `NoteImage`, `NoteAudio`, `NoteFile` interfaces. Add at the end:

```ts
export type AttachmentKind = 'image' | 'audio' | 'video' | 'file'; // grows per slice

/**
 * A binary attachment (starting with inline images in M3 Slice 1). Bytes live
 * here as a native Blob (ADR 0007); the Note body references it by id via
 * <img data-attachment-id>. One row is owned by exactly one Note (noteId).
 */
export interface Attachment {
  id: string; // uuid v4
  noteId: string; // FK to Note.id
  kind: AttachmentKind;
  mime: string; // e.g. 'image/png'
  blob: Blob; // the bytes
  name?: string; // original filename
  size?: number; // bytes
  width?: number; // image/video (computed in a later processing slice)
  height?: number; // image/video
  duration?: number; // audio/video (later slices)
  createdAt: string; // ISO
  updatedAt: string; // ISO
}
```

The `Note` interface's `audio`/`images`/`files` lines (`src/models.ts:7-9`) are removed.

- [ ] **Step 4: Migrate the Dexie schema**

Replace `src/db/db.ts` with:

```ts
import Dexie, { type Table } from 'dexie';
import type { Attachment, Note, NoteTag, Tag } from '@/models.ts';

export class NotesDB extends Dexie {
  notes!: Table<Note, string>;
  attachments!: Table<Attachment, string>;
  tags!: Table<Tag, string>;
  noteTags!: Table<NoteTag, [string, string]>; // composite key

  constructor() {
    super('NotesDB');
    this.version(1).stores({
      notes: 'id, header, createdAt, updatedAt',
      images: 'id, noteId',
      audios: 'id, noteId',
      files: 'id, noteId',
      tags: 'id, name',
      noteTags: '[noteId+tagId], noteId, tagId',
    });
    // v2: fold the (never-populated) per-type media tables into one generic
    // `attachments` table with a `kind` discriminator. Dropping a store needs
    // it declared `null` in the new version. No data migration - the images/
    // audios/files stores were never written by shipped UI.
    this.version(2).stores({
      attachments: 'id, noteId, kind',
      images: null,
      audios: null,
      files: null,
    });
  }
}

export const db = new NotesDB();
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test src/hooks/data/useAttachmentActions.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Verify the whole project still typechecks + builds**

Run: `pnpm build`
Expected: no TS errors. (Only `src/db/db.ts` referenced the removed types - confirmed by grep - so nothing else should break.)

- [ ] **Step 7: Update the data-layer docs**

In `src/db/CLAUDE.md`, replace the `images`/`audios`/`files` rows in the schema table with a single `attachments | id | noteId, kind | Attachment` row and update the surrounding "Attachments" prose to describe the one generic table. In `src/db/PLAN.md`, strike the resolved "Attachment storage (M3)" bullets (Blob-vs-base64 and the video-table question are now decided).

- [ ] **Step 8: Commit**

```bash
git add src/models.ts src/db/db.ts src/hooks/data/useAttachmentActions.test.ts src/db/CLAUDE.md src/db/PLAN.md
git commit -m "[ADD] Generic attachments table + Attachment model (M3 slice1)"
```

---

## Task 2: Pure validation + HTML helpers

**Files:**
- Create: `src/lib/attachments.ts`, `src/lib/attachments.test.ts`
- Create: `src/lib/attachment-html.ts`, `src/lib/attachment-html.test.ts`

**Interfaces:**
- Produces:
  - `ALLOWED_IMAGE_MIME: readonly string[]`, `MAX_IMAGE_BYTES: number`
  - `type AttachmentErrorCode = 'unsupported-type' | 'too-large'`
  - `class AttachmentError extends Error { code: AttachmentErrorCode }`
  - `validateImageFile(file: File): AttachmentErrorCode | null`
  - `bodyHasAttachment(html: string | null | undefined): boolean`
  - `extractAttachmentIds(html: string | null | undefined): string[]`

- [ ] **Step 1: Write the failing validation test**

Create `src/lib/attachments.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, validateImageFile } from './attachments';

function fileOfType(type: string, size = 10): File {
  const f = new File([new Uint8Array(size)], 'x', { type });
  return f;
}

describe('validateImageFile', () => {
  it('accepts a whitelisted image type under the size cap', () => {
    expect(validateImageFile(fileOfType('image/png'))).toBeNull();
    expect(validateImageFile(fileOfType('image/webp'))).toBeNull();
  });

  it('rejects a non-whitelisted type (e.g. SVG)', () => {
    expect(validateImageFile(fileOfType('image/svg+xml'))).toBe('unsupported-type');
    expect(validateImageFile(fileOfType('application/pdf'))).toBe('unsupported-type');
  });

  it('rejects an oversized file', () => {
    const big = fileOfType('image/png', MAX_IMAGE_BYTES + 1);
    expect(validateImageFile(big)).toBe('too-large');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test src/lib/attachments.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/lib/attachments.ts`**

```ts
/** Image MIME types we accept in Slice 1. SVG excluded (script surface). */
export const ALLOWED_IMAGE_MIME = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
] as const;

/** Per-image size cap: 10 MB. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export type AttachmentErrorCode = 'unsupported-type' | 'too-large';

/** Thrown by createAttachment when a file fails validation; carries a code so
 *  the caller can map it to a translated toast. */
export class AttachmentError extends Error {
  constructor(readonly code: AttachmentErrorCode) {
    super(code);
    this.name = 'AttachmentError';
  }
}

/** Returns the failure code, or null when the file is a valid image. Pure. */
export function validateImageFile(file: File): AttachmentErrorCode | null {
  if (!ALLOWED_IMAGE_MIME.includes(file.type as (typeof ALLOWED_IMAGE_MIME)[number])) {
    return 'unsupported-type';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return 'too-large';
  }
  return null;
}
```

- [ ] **Step 4: Run the validation test to verify it passes**

Run: `pnpm test src/lib/attachments.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing HTML-helper test**

Create `src/lib/attachment-html.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { bodyHasAttachment, extractAttachmentIds } from './attachment-html';

describe('bodyHasAttachment', () => {
  it('is true when the HTML contains an img with data-attachment-id', () => {
    expect(bodyHasAttachment('<p>hi</p><img data-attachment-id="abc">')).toBe(true);
  });

  it('is false for plain text or an img without the marker', () => {
    expect(bodyHasAttachment('<p>hi</p>')).toBe(false);
    expect(bodyHasAttachment('<img src="x.png">')).toBe(false);
    expect(bodyHasAttachment('')).toBe(false);
    expect(bodyHasAttachment(undefined)).toBe(false);
  });
});

describe('extractAttachmentIds', () => {
  it('collects every data-attachment-id, de-duplicated', () => {
    const html = '<img data-attachment-id="a"><p>x</p><img data-attachment-id="b"><img data-attachment-id="a">';
    expect(extractAttachmentIds(html).sort()).toEqual(['a', 'b']);
  });

  it('returns [] for empty / nullish input', () => {
    expect(extractAttachmentIds('')).toEqual([]);
    expect(extractAttachmentIds(null)).toEqual([]);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm test src/lib/attachment-html.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 7: Implement `src/lib/attachment-html.ts`**

```ts
// Matches `data-attachment-id="{value}"` inside any tag. A regex is enough:
// the Body is our own serialized editor HTML, and we only read attribute values,
// never trust the markup. Generalizes to any attachment node (audio/video/file)
// because they all carry the same data-attachment-id marker.
const ATTACHMENT_ID_RE = /data-attachment-id="([^"]+)"/g;

/** True when the Body HTML embeds at least one attachment node. */
export function bodyHasAttachment(html: string | null | undefined): boolean {
  if (!html) return false;
  ATTACHMENT_ID_RE.lastIndex = 0;
  return ATTACHMENT_ID_RE.test(html);
}

/** Every distinct attachment id referenced by the Body HTML. */
export function extractAttachmentIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const match of html.matchAll(ATTACHMENT_ID_RE)) {
    ids.add(match[1]);
  }
  return [...ids];
}
```

- [ ] **Step 8: Run it to verify it passes**

Run: `pnpm test src/lib/attachment-html.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 9: Commit**

```bash
git add src/lib/attachments.ts src/lib/attachments.test.ts src/lib/attachment-html.ts src/lib/attachment-html.test.ts
git commit -m "[ADD] Pure attachment validation + body-HTML helpers"
```

---

## Task 3: `useAttachmentActions` data hook

**Files:**
- Create: `src/hooks/data/useAttachmentActions.ts`
- Modify: `src/hooks/data/useAttachmentActions.test.ts` (extend the Task 1 file)

**Interfaces:**
- Consumes: `db.attachments` (Task 1); `AttachmentError` + `validateImageFile` (Task 2); `Attachment` (Task 1).
- Produces `useAttachmentActions()` returning:
  - `createAttachment(noteId: string, file: File, kind?: AttachmentKind): Promise<Attachment>` - validates (throws `AttachmentError`), writes the row, returns it.
  - `getAttachment(id: string): Promise<Attachment | undefined>`
  - `deleteAttachment(id: string): Promise<void>`
  - `cloneAttachment(source: Attachment, noteId: string): Promise<Attachment>` - new id + copied Blob + given noteId.
  - `collectOrphans(noteId: string, referencedIds: string[]): Promise<number>` - deletes this note's rows whose id is not referenced; returns count.
  - `collectMissingNoteOrphans(): Promise<number>` - deletes rows whose noteId has no Note.

- [ ] **Step 1: Write the failing tests**

Append to `src/hooks/data/useAttachmentActions.test.ts` (add imports at the top: `import { renderHook } from '@testing-library/react';` and `import { useAttachmentActions } from './useAttachmentActions.ts';`). Add a helper to get the actions and a `beforeEach(() => db.attachments.clear())` plus:

```ts
function actions() {
  return renderHook(() => useAttachmentActions()).result.current;
}

const pngFile = () => new File([new Uint8Array(4)], 'p.png', { type: 'image/png' });

describe('useAttachmentActions', () => {
  it('createAttachment validates then writes a row', async () => {
    const a = actions();
    const noteId = crypto.randomUUID();
    const att = await a.createAttachment(noteId, pngFile());
    expect(att.noteId).toBe(noteId);
    expect(att.kind).toBe('image');
    expect(att.mime).toBe('image/png');
    expect(await db.attachments.get(att.id)).toBeTruthy();
  });

  it('createAttachment rejects a bad type without writing', async () => {
    const a = actions();
    const bad = new File(['x'], 'x.svg', { type: 'image/svg+xml' });
    await expect(a.createAttachment(crypto.randomUUID(), bad)).rejects.toMatchObject({
      code: 'unsupported-type',
    });
    expect(await db.attachments.count()).toBe(0);
  });

  it('getAttachment + deleteAttachment round-trip', async () => {
    const a = actions();
    const att = await a.createAttachment(crypto.randomUUID(), pngFile());
    expect((await a.getAttachment(att.id))?.id).toBe(att.id);
    await a.deleteAttachment(att.id);
    expect(await a.getAttachment(att.id)).toBeUndefined();
  });

  it('cloneAttachment mints a distinct owned row with copied bytes', async () => {
    const a = actions();
    const src = await a.createAttachment(crypto.randomUUID(), pngFile());
    const targetNote = crypto.randomUUID();
    const clone = await a.cloneAttachment(src, targetNote);
    expect(clone.id).not.toBe(src.id);
    expect(clone.noteId).toBe(targetNote);
    expect(clone.blob).toBeInstanceOf(Blob);
    expect(await db.attachments.count()).toBe(2);
  });

  it('collectOrphans removes unreferenced rows for the note, keeps referenced', async () => {
    const a = actions();
    const noteId = crypto.randomUUID();
    const keep = await a.createAttachment(noteId, pngFile());
    const drop = await a.createAttachment(noteId, pngFile());
    const removed = await a.collectOrphans(noteId, [keep.id]);
    expect(removed).toBe(1);
    expect(await a.getAttachment(keep.id)).toBeTruthy();
    expect(await a.getAttachment(drop.id)).toBeUndefined();
  });

  it('collectMissingNoteOrphans removes rows whose note is gone', async () => {
    const a = actions();
    const orphanNote = crypto.randomUUID();
    await a.createAttachment(orphanNote, pngFile());
    const liveNote = crypto.randomUUID();
    await db.notes.put({
      id: liveNote, header: '', description: '', body: '', checklist: [],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
    await a.createAttachment(liveNote, pngFile());
    const removed = await a.collectMissingNoteOrphans();
    expect(removed).toBe(1);
  });
});
```

Add `import { beforeEach } from 'vitest';` and `beforeEach(async () => { await db.attachments.clear(); await db.notes.clear(); });`.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/hooks/data/useAttachmentActions.test.ts`
Expected: FAIL - `useAttachmentActions` not found.

- [ ] **Step 3: Implement `src/hooks/data/useAttachmentActions.ts`**

```ts
import { useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { db } from '@/db/db.ts';
import { AttachmentError, validateImageFile } from '@/lib/attachments.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';

// Mutations close over the stable `db` import only, so they are memoized with
// empty deps - the editor's insert handlers and the dialog's autosave depend on
// stable identities (see useNoteActions for the same rationale).
export function useAttachmentActions() {
  const createAttachment = useCallback(
    async (noteId: string, file: File, kind: AttachmentKind = 'image'): Promise<Attachment> => {
      const bad = validateImageFile(file);
      if (bad) throw new AttachmentError(bad);
      const now = new Date().toISOString();
      const att: Attachment = {
        id: uuid(),
        noteId,
        kind,
        mime: file.type,
        blob: file, // a File is a Blob; persist directly (ADR 0007)
        name: file.name,
        size: file.size,
        createdAt: now,
        updatedAt: now,
      };
      await db.attachments.add(att);
      return att;
    },
    []
  );

  const getAttachment = useCallback((id: string) => db.attachments.get(id), []);

  const deleteAttachment = useCallback(async (id: string) => {
    await db.attachments.delete(id);
  }, []);

  const cloneAttachment = useCallback(
    async (source: Attachment, noteId: string): Promise<Attachment> => {
      const now = new Date().toISOString();
      const clone: Attachment = {
        ...source,
        id: uuid(),
        noteId,
        blob: source.blob.slice(0, source.blob.size, source.blob.type),
        createdAt: now,
        updatedAt: now,
      };
      await db.attachments.add(clone);
      return clone;
    },
    []
  );

  // Note-scoped GC: drop this note's rows no longer referenced by the saved Body.
  const collectOrphans = useCallback(async (noteId: string, referencedIds: string[]) => {
    const referenced = new Set(referencedIds);
    return db.transaction('rw', db.attachments, async () => {
      const rows = await db.attachments.where('noteId').equals(noteId).toArray();
      const orphans = rows.filter((r) => !referenced.has(r.id));
      await db.attachments.bulkDelete(orphans.map((r) => r.id));
      return orphans.length;
    });
  }, []);

  // Global safety net: drop rows whose owning Note no longer exists (covers a
  // draft that was discarded before it was ever persisted, or a crash).
  const collectMissingNoteOrphans = useCallback(async () => {
    return db.transaction('rw', db.notes, db.attachments, async () => {
      const noteIds = new Set(await db.notes.toCollection().primaryKeys());
      const all = await db.attachments.toArray();
      const orphans = all.filter((r) => !noteIds.has(r.noteId));
      await db.attachments.bulkDelete(orphans.map((r) => r.id));
      return orphans.length;
    });
  }, []);

  return {
    createAttachment,
    getAttachment,
    deleteAttachment,
    cloneAttachment,
    collectOrphans,
    collectMissingNoteOrphans,
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/hooks/data/useAttachmentActions.test.ts`
Expected: PASS (all tests, incl. the Task 1 round-trip ones).

- [ ] **Step 5: Document the hook**

In `src/hooks/data/CLAUDE.md`, add a `useAttachmentActions()` row to the mutations table listing `createAttachment`, `getAttachment`, `deleteAttachment`, `cloneAttachment`, `collectOrphans`, `collectMissingNoteOrphans`.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/data/useAttachmentActions.ts src/hooks/data/useAttachmentActions.test.ts src/hooks/data/CLAUDE.md
git commit -m "[ADD] useAttachmentActions - CRUD + GC for attachments"
```

---

## Task 4: Note delete/undo cascades attachments

**Files:**
- Modify: `src/hooks/data/useNoteActions.ts:33-62`
- Modify: `src/components/cards/NoteCard.tsx:33-41`
- Test: `src/hooks/data/useNoteActions.test.ts` (create if absent)
- Modify: `src/components/cards/NoteCard.test.tsx` (mock shape)

**Interfaces:**
- Consumes: `db.attachments` (Task 1); `Attachment` (Task 1).
- Produces:
  - `deleteNote(id): Promise<{ removedTags: NoteTag[]; removedAttachments: Attachment[] }>`
  - `restoreNote(note: Note, removed?: { removedTags?: NoteTag[]; removedAttachments?: Attachment[] }): Promise<Note>`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/data/useNoteActions.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db.ts';
import type { Attachment, Note } from '@/models.ts';
import { useNoteActions } from './useNoteActions.ts';

function actions() {
  return renderHook(() => useNoteActions()).result.current;
}

function makeNote(overrides: Partial<Note> = {}): Note {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), header: 'h', description: '', body: '', checklist: [], createdAt: now, updatedAt: now, ...overrides };
}

function makeAtt(noteId: string): Attachment {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), noteId, kind: 'image', mime: 'image/png', blob: new Blob(['x']), createdAt: now, updatedAt: now };
}

beforeEach(async () => {
  await db.notes.clear();
  await db.attachments.clear();
  await db.noteTags.clear();
});

describe('deleteNote / restoreNote cascade attachments', () => {
  it('deleteNote removes + returns the note attachments', async () => {
    const a = actions();
    const note = makeNote();
    await db.notes.put(note);
    const att = makeAtt(note.id);
    await db.attachments.put(att);

    const removed = await a.deleteNote(note.id);
    expect(removed.removedAttachments.map((r) => r.id)).toEqual([att.id]);
    expect(await db.attachments.get(att.id)).toBeUndefined();
  });

  it('restoreNote re-puts the note and its attachments', async () => {
    const a = actions();
    const note = makeNote();
    await db.notes.put(note);
    const att = makeAtt(note.id);
    await db.attachments.put(att);

    const removed = await a.deleteNote(note.id);
    await a.restoreNote(note, removed);
    expect(await db.notes.get(note.id)).toBeTruthy();
    expect(await db.attachments.get(att.id)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/hooks/data/useNoteActions.test.ts`
Expected: FAIL - `removedAttachments` undefined / `restoreNote` signature mismatch.

- [ ] **Step 3: Update `useNoteActions`**

In `src/hooks/data/useNoteActions.ts`: add `Attachment` to the model import (`import type { Attachment, Note, NoteTag } from '@/models.ts';`). Replace `restoreNote` and `deleteNote`:

```ts
  // RESTORE a previously captured note verbatim (for delete-undo): keeps the
  // original id/timestamps and re-links its noteTags + attachments, so undoing
  // a delete reproduces the exact prior state.
  const restoreNote = useCallback(
    async (
      note: Note,
      removed: { removedTags?: NoteTag[]; removedAttachments?: Attachment[] } = {}
    ) => {
      const { removedTags = [], removedAttachments = [] } = removed;
      await db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
        await db.notes.put(note);
        if (removedTags.length > 0) await db.noteTags.bulkPut(removedTags);
        if (removedAttachments.length > 0) await db.attachments.bulkPut(removedAttachments);
      });
      return note;
    },
    []
  );
```

```ts
  // DELETE a note and its relationships. Returns the removed noteTags +
  // attachments so the caller can pass them (with the captured note) to
  // restoreNote for a lossless undo.
  const deleteNote = useCallback(async (id: string) => {
    return db.transaction('rw', db.notes, db.noteTags, db.attachments, async () => {
      const removedTags = await db.noteTags.where('noteId').equals(id).toArray();
      const removedAttachments = await db.attachments.where('noteId').equals(id).toArray();
      await db.notes.delete(id);
      await db.noteTags.where('noteId').equals(id).delete();
      await db.attachments.where('noteId').equals(id).delete();
      return { removedTags, removedAttachments };
    });
  }, []);
```

- [ ] **Step 4: Update the `NoteCard` caller**

In `src/components/cards/NoteCard.tsx`, change `handleDelete` (currently line 33-41):

```tsx
  const handleDelete = async () => {
    const removed = await deleteNote(note.id);
    toast(t('notes.deleted'), {
      action: {
        label: t('notes.undo'),
        onClick: () => restoreNote(note, removed),
      },
    });
  };
```

- [ ] **Step 5: Fix the `NoteCard` test mock**

In `src/components/cards/NoteCard.test.tsx`, find where `deleteNote`/`restoreNote` are mocked. Make `deleteNote` resolve to `{ removedTags: [], removedAttachments: [] }` (instead of `[]`) so the `restoreNote` action still fires with the new shape. If the test asserts the `restoreNote` argument, update it to expect `(note, { removedTags: [], removedAttachments: [] })`.

- [ ] **Step 6: Run the affected tests**

Run: `pnpm test src/hooks/data/useNoteActions.test.ts src/components/cards/NoteCard.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full suite + build**

Run: `pnpm test && pnpm build`
Expected: green.

- [ ] **Step 8: Commit**

```bash
git add src/hooks/data/useNoteActions.ts src/hooks/data/useNoteActions.test.ts src/components/cards/NoteCard.tsx src/components/cards/NoteCard.test.tsx
git commit -m "[EDIT] Cascade attachments through note delete/undo"
```

---

## Task 5: `imageAttachment` TipTap node - parse/render/insert (headless)

**Files:**
- Modify: `src/components/editor/extensions/Image/Image.ts`
- Modify: `src/components/editor/extensions/Image/index.ts`
- Test: `src/components/editor/extensions/Image/Image.test.ts`

This task builds the node with a **temporary no-op NodeView** so it is headless-testable; Task 6 swaps in the React NodeView.

**Interfaces:**
- Consumes: `Attachment` (Task 1); `AttachmentError` code path via deps (Task 3).
- Produces:
  - `interface ImageDeps { getNoteId: () => Promise<string>; createAttachment: (noteId: string, file: File) => Promise<Attachment>; getAttachment: (id: string) => Promise<Attachment | undefined>; cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>; onError: (code: AttachmentErrorCode) => void; t: TFunction; }`
  - `createImage(deps: ImageDeps)` → a TipTap `Node` named `imageAttachment` (group `block`, `atom`, `draggable`), attribute `attachmentId`, command `insertImageAttachment({ attachmentId })`, and a Pattern A `button` factory.

- [ ] **Step 1: Write the failing headless test**

Create `src/components/editor/extensions/Image/Image.test.ts`:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createImage, type ImageDeps } from './Image';

const t = ((key: string) => key) as ImageDeps['t'];

function stubDeps(): ImageDeps {
  return {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment: vi.fn(),
    getAttachment: vi.fn(async () => undefined),
    cloneAttachment: vi.fn(),
    onError: vi.fn(),
    t,
  };
}

function createEditor(deps = stubDeps()) {
  return new Editor({ extensions: [Document, Paragraph, Text, createImage(deps)], content: '<p></p>' });
}

describe('imageAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses img[data-attachment-id] and re-renders it with no src', () => {
    editor.commands.setContent('<img data-attachment-id="abc">');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('src=');
  });

  it('insertImageAttachment inserts a node carrying the id', () => {
    editor.commands.insertImageAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  it('exposes a Pattern A button with the image icon + tooltip', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'imageAttachment');
    const options = ext?.options as {
      button: (c: { editor: Editor; t: ImageDeps['t'] }) => { componentProps: { tooltip: string } };
    };
    const view = options.button({ editor, t });
    expect(view.componentProps.tooltip).toBe('editor.image.tooltip');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Image/Image.test.ts`
Expected: FAIL - `createImage` not exported.

- [ ] **Step 3: Implement `src/components/editor/extensions/Image/Image.ts`** (temporary no-op NodeView)

```ts
import { Node, mergeAttributes } from '@tiptap/core';
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import type { Attachment } from '@/models.ts';
import type { TFunction } from '../button-types';
import { ImageButton } from './ImageButton';

export interface ImageDeps {
  getNoteId: () => Promise<string>;
  createAttachment: (noteId: string, file: File) => Promise<Attachment>;
  getAttachment: (id: string) => Promise<Attachment | undefined>;
  cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>;
  onError: (code: AttachmentErrorCode) => void;
  t: TFunction;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageAttachment: {
      insertImageAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/**
 * Custom inline-image node (M3 Slice 1). Unlike @tiptap/extension-image it
 * persists NO src - only `data-attachment-id`, resolved to a Blob object URL by
 * the NodeView (editor) and <NoteBody> (read-only). Built via a factory so the
 * data-layer deps (from the dialog + useAttachmentActions) reach the button,
 * paste/drop pipeline, and NodeView - mirrors createMathematics in editor.tsx.
 */
export function createImage(deps: ImageDeps) {
  return Node.create({
    name: 'imageAttachment',
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
      return {
        // Deps are read by the NodeView (Task 6) and the button below.
        deps,
        button: ({ editor, t }: { editor: import('@tiptap/core').Editor; t: TFunction }) => ({
          component: ImageButton,
          componentProps: { editor, deps, tooltip: t('editor.image.tooltip') },
        }),
      };
    },

    addAttributes() {
      return {
        attachmentId: {
          default: null,
          parseHTML: (el) => el.getAttribute('data-attachment-id'),
          renderHTML: (attrs) =>
            attrs.attachmentId ? { 'data-attachment-id': attrs.attachmentId } : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: 'img[data-attachment-id]' }];
    },

    renderHTML({ HTMLAttributes }) {
      // No src ever - the id is the only persisted reference (ADR 0007).
      return ['img', mergeAttributes(HTMLAttributes)];
    },

    addCommands() {
      const name = this.name;
      return {
        insertImageAttachment:
          (attrs) =>
          ({ commands }) =>
            commands.insertContent({ type: name, attrs }),
      };
    },
  });
}
```

- [ ] **Step 4: Create a placeholder `ImageButton`** so the import resolves (fleshed out in Task 7)

Create `src/components/editor/extensions/Image/ImageButton.tsx`:

```tsx
import type { Editor } from '@tiptap/core';
import type { ImageDeps } from './Image';

export interface ImageButtonProps {
  editor: Editor;
  deps: ImageDeps;
  tooltip: string;
}

// Placeholder - real hidden-file-input button lands in Task 7.
export function ImageButton(_props: ImageButtonProps) {
  return null;
}
```

- [ ] **Step 5: Update `index.ts`**

`src/components/editor/extensions/Image/index.ts`:

```ts
export * from './Image';
export * from './ImageButton';
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test src/components/editor/extensions/Image/Image.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/extensions/Image/
git commit -m "[ADD] imageAttachment TipTap node (parse/render/insert, headless)"
```

---

## Task 6: `ImageNodeView` - resolve Blob to object URL in the editor

**Files:**
- Create: `src/components/editor/extensions/Image/ImageNodeView.tsx`
- Modify: `src/components/editor/extensions/Image/Image.ts` (wire `addNodeView`)
- Test: `src/components/editor/extensions/Image/ImageNodeView.test.tsx`

**Interfaces:**
- Consumes: `ImageDeps.getAttachment` via `props.extension.options.deps` (Task 5).
- Produces: `ImageNodeView` React component (default export) rendered by `ReactNodeViewRenderer`.

- [ ] **Step 1: Write the failing RTL test**

Create `src/components/editor/extensions/Image/ImageNodeView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { ImageNodeView } from './ImageNodeView';

// jsdom lacks object-URL APIs.
const revoke = vi.fn();
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = revoke;
});
afterEach(() => {
  revoke.mockReset();
});

function makeAtt(): Attachment {
  const now = new Date().toISOString();
  return { id: 'a1', noteId: 'n1', kind: 'image', mime: 'image/png', blob: new Blob(['x'], { type: 'image/png' }), name: 'p.png', createdAt: now, updatedAt: now };
}

// Minimal fake of the ReactNodeView props surface the component reads.
function fakeProps(getAttachment: (id: string) => Promise<Attachment | undefined>) {
  return {
    node: { attrs: { attachmentId: 'a1' } },
    extension: { options: { deps: { getAttachment } } },
  } as never;
}

describe('ImageNodeView', () => {
  it('resolves the attachment Blob to an <img> src', async () => {
    render(<ImageNodeView {...fakeProps(async () => makeAtt())} />);
    const img = await screen.findByRole('img');
    await waitFor(() => expect(img).toHaveAttribute('src', expect.stringContaining('blob:mock/')));
  });

  it('shows a broken state when the row is missing', async () => {
    render(<ImageNodeView {...fakeProps(async () => undefined)} />);
    expect(await screen.findByText(/unavailable/i)).toBeInTheDocument();
  });

  it('revokes the object URL on unmount', async () => {
    const { unmount } = render(<ImageNodeView {...fakeProps(async () => makeAtt())} />);
    await screen.findByRole('img');
    unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalled());
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Image/ImageNodeView.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/components/editor/extensions/Image/ImageNodeView.tsx`**

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useState } from 'react';
import type { ImageDeps } from './Image';

type State = { status: 'loading' } | { status: 'ready'; url: string } | { status: 'missing' };

/**
 * Editor render path for imageAttachment. Resolves attachmentId → Blob → object
 * URL, revokes on unmount (ADR 0007 lifecycle). Shows a placeholder while
 * loading and a broken state if the row is gone (e.g. GC'd elsewhere).
 */
export function ImageNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = props.extension.options.deps as ImageDeps;
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let url: string | null = null;
    let active = true;
    if (!attachmentId) {
      setState({ status: 'missing' });
      return;
    }
    deps.getAttachment(attachmentId).then((att) => {
      if (!active) return;
      if (!att) {
        setState({ status: 'missing' });
        return;
      }
      url = URL.createObjectURL(att.blob);
      setState({ status: 'ready', url });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId, deps]);

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      {state.status === 'ready' && (
        // biome-ignore lint/a11y/useAltText: user-supplied image with no caption yet (alt UI is a later slice)
        <img src={state.url} alt="" className="h-auto max-w-full rounded-md" />
      )}
      {state.status === 'loading' && (
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      )}
      {state.status === 'missing' && (
        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
          Image unavailable
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default ImageNodeView;
```

> Note: the "Image unavailable" broken-state copy should be i18n'd. To keep this component free of a `t` dependency (it is rendered by TipTap, not inside the React tree with i18n context), pass the string through `deps` if desired in a follow-up; Slice 1 ships the literal and the toast strings are translated. If the reviewer prefers, thread `t` via `deps.t` (already present) and use `deps.t('editor.image.unavailable')` - add that key to both locales.

- [ ] **Step 4: Wire the NodeView into the node**

In `src/components/editor/extensions/Image/Image.ts`, add the import and `addNodeView`:

```ts
import { ReactNodeViewRenderer } from '@tiptap/react';
import { ImageNodeView } from './ImageNodeView';
```

Inside `Node.create({ ... })`, add:

```ts
    addNodeView() {
      return ReactNodeViewRenderer(ImageNodeView);
    },
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test src/components/editor/extensions/Image/ImageNodeView.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Confirm the headless node test still passes**

Run: `pnpm test src/components/editor/extensions/Image/`
Expected: PASS (both files). The headless `Image.test.ts` builds an editor from `@tiptap/core`; `ReactNodeViewRenderer` only activates on a real view, so `getHTML()` still uses `renderHTML`.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/extensions/Image/ImageNodeView.tsx src/components/editor/extensions/Image/ImageNodeView.test.tsx src/components/editor/extensions/Image/Image.ts
git commit -m "[ADD] ImageNodeView - resolve attachment Blob to object URL"
```

---

## Task 7: Insertion pipeline - button, paste, drop, editor wiring, i18n, icon

**Files:**
- Create: `src/components/editor/extensions/Image/insert.ts`
- Modify: `src/components/editor/extensions/Image/ImageButton.tsx`
- Modify: `src/components/editor/editor.tsx`
- Modify: `src/components/icons/icons.ts`
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json`
- Test: extend `src/components/editor/extensions/Image/Image.test.ts` with an `insertImageFiles` test.

**Interfaces:**
- Consumes: `createImage`/`ImageDeps` (Task 5); `AttachmentError` (Task 2); `Editor`/`EditorHandle` (`editor.tsx`); `useAttachmentActions` (Task 3).
- Produces:
  - `insertImageFiles(editor: import('@tiptap/core').Editor, files: FileList | File[], deps: ImageDeps): Promise<void>`
  - `dedupeForeignImages(editor: import('@tiptap/core').Editor, deps: ImageDeps): Promise<void>`
  - `Editor` gains prop `getNoteId?: () => Promise<string>`.

- [ ] **Step 1: Write the failing pipeline test**

Append to `src/components/editor/extensions/Image/Image.test.ts`:

```ts
import { insertImageFiles } from './insert';

describe('insertImageFiles', () => {
  it('creates an attachment then inserts a node per valid image', async () => {
    const deps = stubDeps();
    deps.createAttachment = vi.fn(async (_n, file) => ({
      id: `att-${file.name}`, noteId: 'note-1', kind: 'image' as const, mime: file.type,
      blob: file, createdAt: '', updatedAt: '',
    }));
    const editor = createEditor(deps);
    const png = new File([new Uint8Array(4)], 'a.png', { type: 'image/png' });

    await insertImageFiles(editor, [png], deps);

    expect(deps.getNoteId).toHaveBeenCalledOnce();
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', png);
    expect(editor.getHTML()).toContain('data-attachment-id="att-a.png"');
    editor.destroy();
  });

  it('reports validation failures via onError and inserts nothing', async () => {
    const deps = stubDeps();
    const { AttachmentError } = await import('@/lib/attachments.ts');
    deps.createAttachment = vi.fn(async () => {
      throw new AttachmentError('too-large');
    });
    const editor = createEditor(deps);
    const big = new File([new Uint8Array(4)], 'b.png', { type: 'image/png' });

    await insertImageFiles(editor, [big], deps);

    expect(deps.onError).toHaveBeenCalledWith('too-large');
    expect(editor.getHTML()).not.toContain('data-attachment-id');
    editor.destroy();
  });

  it('ignores non-image files', async () => {
    const deps = stubDeps();
    const editor = createEditor(deps);
    const txt = new File(['hi'], 'n.txt', { type: 'text/plain' });
    await insertImageFiles(editor, [txt], deps);
    expect(deps.getNoteId).not.toHaveBeenCalled();
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Image/Image.test.ts`
Expected: FAIL - `insert` module not found.

- [ ] **Step 3: Implement `src/components/editor/extensions/Image/insert.ts`**

```ts
import type { Editor } from '@tiptap/core';
import { AttachmentError } from '@/lib/attachments.ts';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import type { ImageDeps } from './Image';

/** Validate → createAttachment → insert node, for each image file. One
 *  getNoteId() call covers the whole batch (a draft persists once). */
export async function insertImageFiles(
  editor: Editor,
  files: FileList | File[],
  deps: ImageDeps
): Promise<void> {
  const images = Array.from(files).filter((f) => f.type.startsWith('image/'));
  if (images.length === 0) return;
  const noteId = await deps.getNoteId();
  for (const file of images) {
    try {
      const att = await deps.createAttachment(noteId, file);
      editor.chain().focus().insertImageAttachment({ attachmentId: att.id }).run();
    } catch (err) {
      if (err instanceof AttachmentError) deps.onError(err.code);
      else throw err;
    }
  }
}

/** Clone-on-insert for foreign images (cross-note copy/paste). After a paste,
 *  any imageAttachment node whose row is owned by another Note is re-pointed at
 *  a fresh owned clone, so every row belongs to exactly one Note and the GC
 *  sweep stays trivial. Lowest-frequency path; runs async after paste applies. */
export async function dedupeForeignImages(editor: Editor, deps: ImageDeps): Promise<void> {
  const noteId = await deps.getNoteId();
  const ids = extractAttachmentIds(editor.getHTML());
  for (const id of ids) {
    const att = await deps.getAttachment(id);
    if (!att || att.noteId === noteId) continue; // missing → NodeView shows broken; owned → keep
    const clone = await deps.cloneAttachment(att, noteId);
    // Re-point the first node still carrying the old id. Re-scan each pass since
    // positions shift; we only rewrite one occurrence per clone.
    let pos: number | null = null;
    editor.state.doc.descendants((node, p) => {
      if (pos === null && node.type.name === 'imageAttachment' && node.attrs.attachmentId === id) {
        pos = p;
        return false;
      }
      return true;
    });
    if (pos !== null) {
      editor.chain().command(({ tr }) => {
        tr.setNodeAttribute(pos as number, 'attachmentId', clone.id);
        return true;
      }).run();
    }
  }
}
```

- [ ] **Step 4: Run to verify the pipeline test passes**

Run: `pnpm test src/components/editor/extensions/Image/Image.test.ts`
Expected: PASS (all, incl. the new 3).

- [ ] **Step 5: Add the icon**

In `src/components/icons/icons.ts`, add `ImagePlus` to the `lucide-react` import and to the `icons` object (`ImagePlus,`).

- [ ] **Step 6: Add i18n strings**

In `public/locales/en/translation.json`, under `editor`, add:

```json
"image": {
  "tooltip": "Insert image",
  "errors": {
    "unsupported-type": "That image type is not supported",
    "too-large": "Image is too large (max 10 MB)"
  }
}
```

In `public/locales/cs/translation.json`, under `editor`, add:

```json
"image": {
  "tooltip": "Vložit obrázek",
  "errors": {
    "unsupported-type": "Tento typ obrázku není podporován",
    "too-large": "Obrázek je příliš velký (max 10 MB)"
  }
}
```

- [ ] **Step 7: Implement the real `ImageButton`**

Replace `src/components/editor/extensions/Image/ImageButton.tsx`:

```tsx
import type { Editor } from '@tiptap/core';
import { useRef } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { ALLOWED_IMAGE_MIME } from '@/lib/attachments.ts';
import type { ImageDeps } from './Image';
import { insertImageFiles } from './insert';

export interface ImageButtonProps {
  editor: Editor;
  deps: ImageDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file image picker (mobile camera
 *  comes free via accept="image/*"), then runs the shared insert pipeline. */
export function ImageButton({ editor, deps, tooltip }: ImageButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <ActionButton
        icon="ImagePlus"
        tooltip={tooltip}
        action={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME.join(',')}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void insertImageFiles(editor, e.target.files, deps);
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}
```

- [ ] **Step 8: Wire the node + handlers into `editor.tsx`**

In `src/components/editor/editor.tsx`:

1. Add imports:

```ts
import { toast } from 'sonner';
import { createImage } from '@/components/editor/extensions/Image';
import { insertImageFiles, dedupeForeignImages } from '@/components/editor/extensions/Image/insert';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
```

2. Add `getNoteId?: () => Promise<string>` to `EditorProps`.

3. Inside the component, after `const { t } = useTranslation();`:

```ts
  const { createAttachment, getAttachment, cloneAttachment } = useAttachmentActions();
  const imageDeps = useMemo(
    () => ({
      getNoteId: getNoteId ?? (async () => { throw new Error('getNoteId not provided'); }),
      createAttachment,
      getAttachment,
      cloneAttachment,
      onError: (code: AttachmentErrorCode) => toast(t(`editor.image.errors.${code}`)),
      t,
    }),
    [getNoteId, createAttachment, getAttachment, cloneAttachment, t]
  );
```

Add `useMemo` to the React import and destructure `getNoteId` from props.

4. Register the node in the `extensions` array (e.g. after `Blockquote`): `createImage(imageDeps),`.

5. Add `editorProps` with paste/drop to the `useEditor({ ... })` config:

```ts
    editorProps: {
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        const ed = editorRef.current;
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
          void insertImageFiles(ed, files, imageDeps);
          return true;
        }
        // Cross-note HTML paste with existing attachment nodes: let the default
        // paste happen, then reclaim any foreign images into owned clones.
        const html = event.clipboardData?.getData('text/html');
        if (ed && html?.includes('data-attachment-id')) {
          queueMicrotask(() => void dedupeForeignImages(ed, imageDeps));
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        const ed = editorRef.current;
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
          void insertImageFiles(ed, files, imageDeps);
          return true;
        }
        return false;
      },
    },
```

6. Add the button to a toolbar section. Simplest: append `imageAttachment` to `BlocksSection`'s name list (`src/components/editor/menus/toolbars/BlocksSection.tsx`). Open it and add `'imageAttachment'` to the names array. (If a reviewer prefers a dedicated section, that is a cosmetic follow-up.)

- [ ] **Step 9: Run the editor-related tests + build**

Run: `pnpm test && pnpm build`
Expected: green. (`editor.tsx` has no direct unit test; the node/pipeline tests cover the logic. The build proves the wiring typechecks.)

- [ ] **Step 10: Manual smoke (per repo's manual-UI policy)**

Run: `pnpm dev`, open a note, insert an image via the toolbar button, paste a screenshot, and drag-drop an image file. Confirm each renders in the editor. (Playwright E2E remains deferred.)

- [ ] **Step 11: Commit**

```bash
git add src/components/editor/ src/components/icons/icons.ts public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] Image insertion pipeline - button, paste, drop, clone-on-insert"
```

---

## Task 8: `<NoteBody>` - hydrate attachments in read-only previews

**Files:**
- Create: `src/components/NoteBody.tsx`, `src/components/NoteBody.test.tsx`
- Modify: `src/components/cards/NoteCard.tsx:91-100`

**Interfaces:**
- Consumes: `useAttachmentActions().getAttachment` (Task 3).
- Produces: `NoteBody({ html, className }: { html: string | null | undefined; className?: string })`.

- [ ] **Step 1: Write the failing RTL test**

Create `src/components/NoteBody.test.tsx`:

```tsx
import 'fake-indexeddb/auto';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db/db.ts';
import type { Attachment } from '@/models.ts';
import { NoteBody } from './NoteBody.tsx';

const revoke = vi.fn();
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = revoke;
});
afterEach(async () => {
  revoke.mockReset();
  await db.attachments.clear();
});

function putAtt(id: string): Promise<string> {
  const now = new Date().toISOString();
  const att: Attachment = { id, noteId: 'n1', kind: 'image', mime: 'image/png', blob: new Blob(['x'], { type: 'image/png' }), createdAt: now, updatedAt: now };
  return db.attachments.put(att);
}

describe('NoteBody', () => {
  it('hydrates data-attachment-id images to object URLs', async () => {
    await putAtt('a1');
    render(<NoteBody html='<p>hi</p><img data-attachment-id="a1">' />);
    const img = await screen.findByRole('img');
    await waitFor(() => expect(img).toHaveAttribute('src', expect.stringContaining('blob:mock/')));
    expect(img).toHaveAttribute('loading', 'lazy');
  });

  it('renders plain HTML with no attachments unchanged', () => {
    render(<NoteBody html="<p>just text</p>" />);
    expect(screen.getByText('just text')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/NoteBody.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `src/components/NoteBody.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Read-only renderer for a Note's Body HTML. Sets innerHTML, then resolves every
 * <img data-attachment-id> to a Blob object URL (lazy-loaded) and revokes the
 * URLs on unmount. The one place that turns attachmentId → object URL for the
 * non-editor path; reusable by any future read-only Note view.
 */
export function NoteBody({ html, className }: { html: string | null | undefined; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const { getAttachment } = useAttachmentActions();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.innerHTML = html ?? '';
    const urls: string[] = [];
    let active = true;
    const imgs = root.querySelectorAll<HTMLImageElement>('img[data-attachment-id]');
    imgs.forEach((img) => {
      const id = img.getAttribute('data-attachment-id');
      if (!id) return;
      img.loading = 'lazy';
      getAttachment(id).then((att) => {
        if (!active || !att) return;
        const url = URL.createObjectURL(att.blob);
        urls.push(url);
        img.src = url;
      });
    });
    return () => {
      active = false;
      for (const u of urls) URL.revokeObjectURL(u);
    };
  }, [html, getAttachment]);

  return <div ref={ref} className={cn('prose prose-sm max-w-none text-foreground', className)} />;
}

export default NoteBody;
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/components/NoteBody.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Switch `NoteCard` to `<NoteBody>`**

In `src/components/cards/NoteCard.tsx`: import `NoteBody` (`import { NoteBody } from '@/components/NoteBody.tsx';`) and replace the `dangerouslySetInnerHTML` block (lines 92-100) with:

```tsx
        {hasBody && <NoteBody html={note.body} className="line-clamp-6" />}
```

- [ ] **Step 6: Run the NoteCard test + build**

Run: `pnpm test src/components/cards/NoteCard.test.tsx && pnpm build`
Expected: PASS. If the card test asserted on the old `dangerouslySetInnerHTML` div, update it to query the rendered text via `NoteBody` output (it still renders the body HTML into the DOM).

- [ ] **Step 7: Commit**

```bash
git add src/components/NoteBody.tsx src/components/NoteBody.test.tsx src/components/cards/NoteCard.tsx src/components/cards/NoteCard.test.tsx
git commit -m "[ADD] NoteBody - hydrate attachment images in read-only cards"
```

---

## Task 9: Dialog - empty-note fix, ensureNoteId, GC on close

**Files:**
- Modify: `src/components/notes/NoteEditorDialog.tsx`
- Modify: `src/components/notes/NoteEditorDialog.test.tsx`

**Interfaces:**
- Consumes: `bodyHasAttachment`/`extractAttachmentIds` (Task 2); `useAttachmentActions().collectOrphans` (Task 3); `createNote`/`updateNote`/`deleteNote` (`useNoteActions`); `Editor` `getNoteId` prop (Task 7).
- Produces: `ensureNoteId(): Promise<string>` passed to `<Editor getNoteId={...} />`; empty-note test now counts attachments; `collectOrphans` runs on close.

> The existing `NoteEditorDialog.test.tsx` uses the **real** `db` (fake-indexeddb) and only mocks `react-i18next` + the `Editor` (a `<textarea data-testid="editor">` that forwards `onUpdate`). The `Editor` mock ignores `getNoteId`, so passing that prop does not affect it. Do **not** mock `useNoteActions`/`useAttachmentActions` - assert against `db` directly, matching the file's style.

- [ ] **Step 1: Write the failing test**

Add `fireEvent` to the `@testing-library/react` import at the top of `src/components/notes/NoteEditorDialog.test.tsx`, and add `await db.attachments.clear();` to the existing `afterEach`. Then add this test inside the `describe('NoteEditorDialog', ...)` block:

```ts
it('keeps an image-only note (no text) instead of discarding it on close', async () => {
  const user = userEvent.setup();
  render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);

  // An image-only body: no header, no text, just an attachment node.
  fireEvent.change(editorTextarea(), {
    target: { value: '<img data-attachment-id="x1">' },
  });

  // Close the dialog (flushes the final save + runs the empty-note check).
  await user.click(closeButton());

  await waitFor(async () => {
    const notes = await db.notes.toArray();
    expect(notes).toHaveLength(1); // kept, not discarded
    expect(notes[0].body).toContain('data-attachment-id="x1"');
  });
});
```

- [ ] **Step 1b: (regression guard) confirm a blank note is still discarded**

The file already has coverage that an empty draft is not persisted; if it does not, add:

```ts
it('still discards a truly empty draft on close', async () => {
  const user = userEvent.setup();
  render(<NoteEditorDialog noteId={null} onClose={vi.fn()} />);
  fireEvent.change(editorTextarea(), { target: { value: '' } });
  await user.click(closeButton());
  await waitFor(async () => expect(await db.notes.count()).toBe(0));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/notes/NoteEditorDialog.test.tsx`
Expected: FAIL - image-only body is currently treated as empty (`isEmpty` strips it to '') so the draft is never created / gets discarded.

- [ ] **Step 3: Update `isEmpty` to count attachments**

In `src/components/notes/NoteEditorDialog.tsx`, import the helpers:

```ts
import { bodyHasAttachment, extractAttachmentIds } from '@/lib/attachment-html.ts';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
```

Change `isEmpty` (line 21-22) to:

```ts
const isEmpty = (header: string, body: string) =>
  header.trim() === '' && stripHtml(body).trim() === '' && !bodyHasAttachment(body);
```

- [ ] **Step 4: Add `ensureNoteId` and pass it to the Editor**

In the component, after `const { createNote, updateNote, deleteNote } = useNoteActions();` add `const { collectOrphans } = useAttachmentActions();`.

Add a stable `ensureNoteId` that persists a draft on demand so an image insert has a real FK (the resolved design). Place it after `persist`:

```ts
  // Attachments need a persisted note to reference. When an image is inserted
  // into a not-yet-saved draft, create the note now (an image is meaningful
  // content) and return its id; existing notes just return their id.
  const ensureNoteId = useCallback(async (): Promise<string> => {
    if (idRef.current != null) return idRef.current;
    const created = await createNote({ header, body });
    idRef.current = created.id;
    return created.id;
  }, [createNote, header, body]);
```

Pass it to `<Editor>`: add `getNoteId={ensureNoteId}` to the `<Editor ... />` props (around line 173).

- [ ] **Step 5: Run the GC sweep on close**

Update `handleClose` (lines 113-122) to sweep orphaned attachments after the final flush:

```ts
  const handleClose = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await enqueueSave(header, body); // flush the latest edit
    // Discard a note that ended up empty (covers a draft typed then cleared).
    if (idRef.current != null && isEmpty(header, body)) {
      await deleteNote(idRef.current); // cascade-deletes its attachments (Task 4)
      idRef.current = null;
    } else if (idRef.current != null) {
      // Reclaim attachment rows no longer referenced by the saved Body. Safe now:
      // the in-editor undo stack is gone once the dialog closes.
      await collectOrphans(idRef.current, extractAttachmentIds(body));
    }
    onClose();
  }, [enqueueSave, header, body, deleteNote, collectOrphans, onClose]);
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm test src/components/notes/NoteEditorDialog.test.tsx`
Expected: PASS.

- [ ] **Step 7: Full suite + build**

Run: `pnpm test && pnpm build`
Expected: green.

- [ ] **Step 8: Manual smoke of the lifecycle**

Run `pnpm dev`: (a) insert an image, reload → still there; (b) insert an image, delete it in-editor, undo → returns; (c) delete an image then close, reopen → gone (GC); (d) delete a note with an image, Undo → note + image return; (e) image-only note survives close.

- [ ] **Step 9: Commit**

```bash
git add src/components/notes/NoteEditorDialog.tsx src/components/notes/NoteEditorDialog.test.tsx
git commit -m "[EDIT] Dialog counts attachments as content; GC sweep on close"
```

---

## Task 10: Global orphan safety net + docs + final gate

**Files:**
- Modify: `src/components/notes/NotesHome.tsx`
- Modify: `src/components/editor/CLAUDE.md`, `PLAN.md`

**Interfaces:**
- Consumes: `useAttachmentActions().collectMissingNoteOrphans` (Task 3).

- [ ] **Step 1: Wire the global sweep at home mount**

In `src/components/notes/NotesHome.tsx`, add a one-time effect that reclaims rows whose Note vanished (crash / discarded-draft safety net beyond the dialog's own sweep):

```tsx
import { useEffect } from 'react';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
// ...
  const { collectMissingNoteOrphans } = useAttachmentActions();
  useEffect(() => {
    void collectMissingNoteOrphans();
  }, [collectMissingNoteOrphans]);
```

(Place the effect near the top of the `NotesHome` component body. `collectMissingNoteOrphans` is memoized, so this runs once.)

- [ ] **Step 2: Verify build + full suite**

Run: `pnpm test && pnpm build`
Expected: green.

- [ ] **Step 3: Update editor docs**

In `src/components/editor/CLAUDE.md`, move `Image` out of the "upstream / stubs" list into a short paragraph: a custom `imageAttachment` node (atom/block/draggable, single `attachmentId` attribute, no persisted `src`), built via `createImage(deps)` (like `createMathematics`), with a React NodeView and paste/drop insertion. In root `PLAN.md`, tick the Slice 1 items under M3 (inline images end to end; storage foundation) and note the deferred sub-slices (image processing, capture-bar photo button, audio/video/file/Excalidraw).

- [ ] **Step 4: Lint + final full gate**

Run: `pnpm check && pnpm test && pnpm build`
Expected: all green - this is acceptance criterion 9.

- [ ] **Step 5: Commit**

```bash
git add src/components/notes/NotesHome.tsx src/components/editor/CLAUDE.md PLAN.md
git commit -m "[EDIT] Global attachment GC safety net + M3 slice1 docs"
```

---

## Acceptance criteria → task map

| # | Criterion | Covered by |
|---|-----------|-----------|
| 1 | Insert via toolbar/paste/drop → renders + persists across reload | Tasks 5, 6, 7 |
| 2 | Body has `<img data-attachment-id>`, no base64/src; bytes in `attachments` | Tasks 3, 5 |
| 3 | Image renders on the home card via `<NoteBody>` | Task 8 |
| 4 | Remove + in-editor undo restores; remove + close reclaims (GC) | Tasks 3, 9 |
| 5 | Delete note with image + Undo restores note **and** image | Task 4 |
| 6 | Image-only note (no text) saves and survives close | Task 9 |
| 7 | Oversized / disallowed files rejected with a toast; nothing written | Tasks 2, 3, 7 |
| 8 | Cross-note paste → independent owned copy | Tasks 3 (`cloneAttachment`), 7 (`dedupeForeignImages`) |
| 9 | `pnpm check` + `pnpm test` + `pnpm build` green | Task 10 |

## Notes / deferred (unchanged from the design)

- Image downscaling/re-compression + thumbnails → dedicated later slice. Slice 1 stores originals; `width`/`height` left undefined.
- Mobile quick-capture-bar photo button → later slice.
- Image resize/alignment controls → later.
- Audio/Video/File/Excalidraw → their own slices, reusing this foundation (add a node + `kind`, reuse `useAttachmentActions`, `<NoteBody>`, GC).
