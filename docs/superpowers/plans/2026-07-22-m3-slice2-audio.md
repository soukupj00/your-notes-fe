# M3 Slice 2 — Audio (record + attach) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add audio as the second attachment media type - record voice memos (editor mic button + inline widget) or attach audio files (picker/paste/drop), play them in a custom in-editor player, and show a play-chip on home cards - by first extracting the Slice 1 image mechanics into shared, media-agnostic helpers (no duplication) and building audio on that core.

**Architecture:** Reuse the Slice 1 attachment foundation unchanged (generic `attachments` Dexie table with `kind`, `useAttachmentActions`, delete/undo cascade, GC sweeps, `bodyHasAttachment`/`extractAttachmentIds`). Refactor the image-specific node/NodeView/insert/validation into shared helpers (`createAttachmentNode`, `useAttachmentObjectUrl`, `insertAttachmentFiles`, `validateAttachmentFile`, `AttachmentDeps`) under the existing image tests as a safety net, then add a `kind: 'audio'` node, a custom `<audio>`-backed player, a `MediaRecorder` recording flow, and a read-only card chip with best-effort autoplay-on-open.

**Tech Stack:** React 19, TypeScript, TipTap v3 (`@tiptap/core` + `@tiptap/react`), Dexie (IndexedDB), Web `MediaRecorder` + `getUserMedia`, native `<audio>`, Vitest + React Testing Library + `fake-indexeddb`, i18next, sonner.

## Global Constraints

- Package manager is **pnpm**. `pnpm test`, `pnpm build`, `pnpm check:ci` - never npm/yarn.
- **IDs** `uuid` v4; **timestamps** ISO strings on `createdAt`/`updatedAt`.
- **Payload is a native `Blob`**, never base64/`data:` (ADR 0007). Body persists `<... data-attachment-id>` with **NO `src`**.
- **tsconfig `erasableSyntaxOnly: true`**: no TS constructor parameter-property shorthand (declare field + assign in body). No `enum`/`namespace`.
- **jsdom + fake-indexeddb Blob gotcha**: a Blob read back from the DB under jsdom is a plain object (`instanceof Blob === false`). Blob-identity round-trip tests use `// @vitest-environment node` as the file's FIRST line; hook/component tests stay jsdom and assert only scalar fields or in-memory blobs, never a DB-read blob's identity. jsdom lacks `URL.createObjectURL`/`revokeObjectURL`, `getUserMedia`, and `MediaRecorder` - mock them in tests.
- **Icons** are string keys in `src/components/icons/icons.ts` - never import a Lucide component into a button config.
- **No em dashes** in code/comments/docs - plain `-`. `@/` import alias. Keep files under 500 lines.
- **Audio MIME whitelist:** `audio/webm`, `audio/ogg`, `audio/mpeg`, `audio/mp4`, `audio/wav`. **Audio size cap: 25 MB** (`25 * 1024 * 1024`). **Recording max duration: 5 minutes** (auto-stop).
- **No duplicated media logic:** image and audio share `createAttachmentNode`, `useAttachmentObjectUrl`, `insertAttachmentFiles`, `validateAttachmentFile`, `AttachmentDeps`. All pre-existing image tests must stay green after the refactor (refactor under test).
- Each task lands with its tests + a commit; `pnpm test` + `pnpm build` stay green at every task boundary.

---

## File Structure

**Create (shared):**
- `src/components/editor/extensions/attachments/deps.ts` - `AttachmentDeps` type (moved+generalized from `ImageDeps`).
- `src/components/editor/extensions/attachments/useAttachmentObjectUrl.ts` - shared object-URL resolution hook.
- `src/components/editor/extensions/attachments/insert.ts` - generalized `insertAttachmentFiles` + `dedupeForeignAttachments`.
- `src/components/editor/extensions/attachments/createAttachmentNode.ts` - node factory.
- Tests alongside each.

**Create (audio):**
- `src/components/editor/extensions/Audio/Audio.ts` - `audioAttachment` node via the factory.
- `src/components/editor/extensions/Audio/AudioNodeView.tsx` - custom player.
- `src/components/editor/extensions/Audio/useAudioRecorder.ts` - recording state machine.
- `src/components/editor/extensions/Audio/AudioRecordButton.tsx` - mic button + inline record widget + file picker.
- `src/components/editor/extensions/Audio/index.ts` + tests.

**Modify:**
- `src/lib/attachments.ts` - add audio constants + `validateAttachmentFile(file, kind)`.
- `src/hooks/data/useAttachmentActions.ts` - `createAttachment` validates via `validateAttachmentFile(file, kind)`.
- `src/components/editor/extensions/Image/{Image,ImageButton,ImageNodeView}.tsx` + `insert.ts` (delete) - refactor onto shared core.
- `src/components/NoteBody.tsx` - branch `img` vs `audio` (chip).
- `src/components/cards/NoteCard.tsx`, `src/components/notes/NotesHome.tsx`, `src/components/notes/NoteEditorDialog.tsx` - autoplay-on-open intent.
- `src/components/editor/editor.tsx` - register audio node, mic button, audio paste/drop, rename `imageDeps`→`attachmentDeps`.
- `src/components/editor/menus/toolbars/BlocksSection.tsx` - add the mic button.
- `src/components/icons/icons.ts` - `Mic`, `Play`, `Pause`, `Square`.
- `public/locales/{en,cs}/translation.json` - audio strings.

---

## Task 1: Generalize file validation to any attachment kind

**Files:**
- Modify: `src/lib/attachments.ts`
- Modify: `src/hooks/data/useAttachmentActions.ts:createAttachment`
- Test: `src/lib/attachments.test.ts`

**Interfaces:**
- Consumes: `AttachmentKind` from `@/models.ts`; existing `AttachmentErrorCode`, `AttachmentError`, `ALLOWED_IMAGE_MIME`, `MAX_IMAGE_BYTES`, `validateImageFile`.
- Produces: `ALLOWED_AUDIO_MIME: readonly string[]`, `MAX_AUDIO_BYTES: number`, `validateAttachmentFile(file: File, kind: AttachmentKind): AttachmentErrorCode | null`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/attachments.test.ts`:

```ts
import { MAX_AUDIO_BYTES, validateAttachmentFile } from './attachments';

function fileOf(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'x', { type });
}

describe('validateAttachmentFile', () => {
  it('image kind keeps the existing image rules', () => {
    expect(validateAttachmentFile(fileOf('image/png'), 'image')).toBeNull();
    expect(validateAttachmentFile(fileOf('image/svg+xml'), 'image')).toBe('unsupported-type');
  });

  it('audio kind accepts whitelisted audio under the cap', () => {
    expect(validateAttachmentFile(fileOf('audio/webm'), 'audio')).toBeNull();
    expect(validateAttachmentFile(fileOf('audio/mpeg'), 'audio')).toBeNull();
  });

  it('audio kind rejects a non-audio type', () => {
    expect(validateAttachmentFile(fileOf('image/png'), 'audio')).toBe('unsupported-type');
  });

  it('audio kind rejects oversized and accepts exactly the cap', () => {
    expect(validateAttachmentFile(fileOf('audio/webm', MAX_AUDIO_BYTES + 1), 'audio')).toBe('too-large');
    expect(validateAttachmentFile(fileOf('audio/webm', MAX_AUDIO_BYTES), 'audio')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/attachments.test.ts`
Expected: FAIL - `validateAttachmentFile`/`MAX_AUDIO_BYTES` not exported.

- [ ] **Step 3: Implement in `src/lib/attachments.ts`**

Add the import `import type { AttachmentKind } from '@/models.ts';` at the top. Add after the image constants:

```ts
/** Audio MIME types accepted for attachment (recorder output is always allowed). */
export const ALLOWED_AUDIO_MIME = [
  'audio/webm',
  'audio/ogg',
  'audio/mpeg',
  'audio/mp4',
  'audio/wav',
] as const;

/** Per-audio size cap: 25 MB. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Kind-dispatched file validation. Returns the failure code or null. Pure. */
export function validateAttachmentFile(file: File, kind: AttachmentKind): AttachmentErrorCode | null {
  if (kind === 'image') {
    return validateImageFile(file);
  }
  if (kind === 'audio') {
    if (!ALLOWED_AUDIO_MIME.includes(file.type as (typeof ALLOWED_AUDIO_MIME)[number])) {
      return 'unsupported-type';
    }
    if (file.size > MAX_AUDIO_BYTES) return 'too-large';
    return null;
  }
  // video/file kinds land in later slices; reject until then.
  return 'unsupported-type';
}
```

Keep `validateImageFile` as-is (used internally + still exported for `ImageButton`'s accept list constant is separate).

- [ ] **Step 4: Route `createAttachment` through the kind-dispatched validator**

In `src/hooks/data/useAttachmentActions.ts`, change the validation call inside `createAttachment` from `validateImageFile(file)` to `validateAttachmentFile(file, kind)` and update the import (`import { AttachmentError, validateAttachmentFile } from '@/lib/attachments.ts';`). The `createAttachment(noteId, file, kind = 'image')` signature is unchanged.

- [ ] **Step 5: Run tests to verify green + no regression**

Run: `pnpm test src/lib/attachments.test.ts src/hooks/data/useAttachmentActions.test.ts`
Expected: PASS (new audio cases + existing image/hook cases).

- [ ] **Step 6: Full suite**

Run: `pnpm test && pnpm build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/attachments.ts src/lib/attachments.test.ts src/hooks/data/useAttachmentActions.ts
git commit -m "[EDIT] Kind-dispatched validateAttachmentFile (audio rules)"
```

---

## Task 2: Extract `AttachmentDeps` + `useAttachmentObjectUrl`; refactor ImageNodeView

**Files:**
- Create: `src/components/editor/extensions/attachments/deps.ts`
- Create: `src/components/editor/extensions/attachments/useAttachmentObjectUrl.ts`
- Create: `src/components/editor/extensions/attachments/useAttachmentObjectUrl.test.tsx`
- Modify: `src/components/editor/extensions/Image/Image.ts`, `Image/ImageNodeView.tsx`, `Image/ImageButton.tsx`

**Interfaces:**
- Consumes: `Attachment`, `AttachmentKind` (`@/models.ts`); `AttachmentErrorCode` (`@/lib/attachments.ts`); `TFunction` (`../../button-types`).
- Produces:
  - `interface AttachmentDeps { getNoteId: () => Promise<string>; createAttachment: (noteId: string, file: File, kind: AttachmentKind) => Promise<Attachment>; getAttachment: (id: string) => Promise<Attachment | undefined>; cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>; onError: (code: AttachmentErrorCode) => void; t: TFunction; }`
  - `type AttachmentUrlState = { status: 'loading' } | { status: 'ready'; url: string; name?: string; attachment: Attachment } | { status: 'missing' }`
  - `useAttachmentObjectUrl(attachmentId: string | null, getAttachment: AttachmentDeps['getAttachment']): AttachmentUrlState`

- [ ] **Step 1: Create the shared `AttachmentDeps` type**

Create `src/components/editor/extensions/attachments/deps.ts`:

```ts
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';
import type { TFunction } from '../button-types';

/** Data-layer + i18n dependencies threaded into every media extension (image,
 *  audio, ...). Generalizes Slice 1's ImageDeps: createAttachment now takes the
 *  kind so one insert pipeline serves all media types. */
export interface AttachmentDeps {
  getNoteId: () => Promise<string>;
  createAttachment: (noteId: string, file: File, kind: AttachmentKind) => Promise<Attachment>;
  getAttachment: (id: string) => Promise<Attachment | undefined>;
  cloneAttachment: (source: Attachment, noteId: string) => Promise<Attachment>;
  onError: (code: AttachmentErrorCode) => void;
  t: TFunction;
}
```

- [ ] **Step 2: Write the failing hook test**

Create `src/components/editor/extensions/attachments/useAttachmentObjectUrl.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { useAttachmentObjectUrl } from './useAttachmentObjectUrl';

const revoke = vi.fn();
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = revoke;
});
afterEach(() => revoke.mockReset());

function att(): Attachment {
  const now = new Date().toISOString();
  return { id: 'a1', noteId: 'n1', kind: 'image', mime: 'image/png', blob: new Blob(['x']), name: 'p.png', createdAt: now, updatedAt: now };
}

function Probe({ id, get }: { id: string | null; get: (i: string) => Promise<Attachment | undefined> }) {
  const s = useAttachmentObjectUrl(id, get);
  return <div data-testid="s">{s.status === 'ready' ? `${s.url}|${s.name}` : s.status}</div>;
}

describe('useAttachmentObjectUrl', () => {
  it('resolves to a ready url + name', async () => {
    render(<Probe id="a1" get={async () => att()} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toContain('blob:mock/'));
    expect(screen.getByTestId('s').textContent).toContain('p.png');
  });

  it('reports missing when the row is absent', async () => {
    render(<Probe id="a1" get={async () => undefined} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('missing'));
  });

  it('revokes the url on unmount', async () => {
    const { unmount } = render(<Probe id="a1" get={async () => att()} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toContain('blob:mock/'));
    unmount();
    await waitFor(() => expect(revoke).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/attachments/useAttachmentObjectUrl.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 4: Implement the hook**

Create `src/components/editor/extensions/attachments/useAttachmentObjectUrl.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from './deps';

export type AttachmentUrlState =
  | { status: 'loading' }
  | { status: 'ready'; url: string; name?: string; attachment: Attachment }
  | { status: 'missing' };

/**
 * Resolves attachmentId -> Blob -> object URL for a React NodeView, revoking the
 * URL on unmount / id change (ADR 0007 lifecycle). Extracted from Slice 1's
 * ImageNodeView so image + audio (+ future media) share one implementation.
 * Pass a STABLE getAttachment (the useAttachmentActions one is a stable
 * useCallback) so the effect does not re-run every render.
 */
export function useAttachmentObjectUrl(
  attachmentId: string | null,
  getAttachment: AttachmentDeps['getAttachment']
): AttachmentUrlState {
  const [state, setState] = useState<AttachmentUrlState>({ status: 'loading' });
  useEffect(() => {
    let url: string | null = null;
    let active = true;
    if (!attachmentId) {
      setState({ status: 'missing' });
      return;
    }
    getAttachment(attachmentId).then((att) => {
      if (!active) return;
      if (!att) {
        setState({ status: 'missing' });
        return;
      }
      url = URL.createObjectURL(att.blob);
      setState({ status: 'ready', url, name: att.name, attachment: att });
    });
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachmentId, getAttachment]);
  return state;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm test src/components/editor/extensions/attachments/useAttachmentObjectUrl.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Refactor `ImageNodeView` onto the hook**

Replace `src/components/editor/extensions/Image/ImageNodeView.tsx` body so it uses the hook and the shared deps type (behavior identical):

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for imageAttachment. Object-URL lifecycle lives in the
 *  shared useAttachmentObjectUrl hook (shared with audio). */
export function ImageNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      {state.status === 'ready' && (
        <img
          src={state.url}
          alt={state.name ?? deps.t('editor.image.fallbackAlt')}
          className="h-auto max-w-full rounded-md"
        />
      )}
      {state.status === 'loading' && (
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      )}
      {state.status === 'missing' && (
        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
          {deps.t('editor.image.unavailable')}
        </div>
      )}
    </NodeViewWrapper>
  );
}

export default ImageNodeView;
```

- [ ] **Step 7: Point `Image.ts` + `ImageButton.tsx` at the shared `AttachmentDeps`**

In `src/components/editor/extensions/Image/Image.ts`: delete the local `ImageDeps` interface and its `Attachment`/`AttachmentErrorCode`/`TFunction` imports that only served it; add `import type { AttachmentDeps } from '../attachments/deps';` and change `createImage(getDeps: () => ImageDeps)` to `createImage(getDeps: () => AttachmentDeps)`. Keep the rest (the `declare module` block, `createImage` body) unchanged for now - it is replaced in Task 4.
In `src/components/editor/extensions/Image/ImageButton.tsx`: change `import type { ImageDeps } from './Image';` to `import type { AttachmentDeps } from '../attachments/deps';` and the prop type `getDeps: () => ImageDeps` to `getDeps: () => AttachmentDeps`.

- [ ] **Step 8: Run image tests + full suite + build**

Run: `pnpm test src/components/editor/extensions/Image/ && pnpm test && pnpm build`
Expected: green - `ImageNodeView.test.tsx` and `Image.test.ts` still pass (behavior preserved).

- [ ] **Step 9: Commit**

```bash
git add src/components/editor/extensions/attachments/deps.ts src/components/editor/extensions/attachments/useAttachmentObjectUrl.ts src/components/editor/extensions/attachments/useAttachmentObjectUrl.test.tsx src/components/editor/extensions/Image/
git commit -m "[EDIT] Extract AttachmentDeps + useAttachmentObjectUrl; refactor ImageNodeView"
```

---

## Task 3: Generalize the insert pipeline; move Image onto it

**Files:**
- Create: `src/components/editor/extensions/attachments/insert.ts`
- Modify: `src/components/editor/extensions/Image/ImageButton.tsx`, `Image.test.ts`, `src/components/editor/editor.tsx` (paste/drop imports)
- Delete: `src/components/editor/extensions/Image/insert.ts`

**Interfaces:**
- Consumes: `AttachmentDeps` (Task 2); `AttachmentError` (`@/lib/attachments.ts`); `extractAttachmentIds` (`@/lib/attachment-html.ts`); `AttachmentKind` (`@/models.ts`).
- Produces:
  - `insertAttachmentFiles(editor: Editor, files: FileList | File[], kind: AttachmentKind, deps: AttachmentDeps, insertNode: (attachmentId: string) => void): Promise<void>`
  - `dedupeForeignAttachments(editor: Editor, deps: AttachmentDeps): Promise<void>`

- [ ] **Step 1: Create the generalized pipeline**

Create `src/components/editor/extensions/attachments/insert.ts`:

```ts
import type { Editor } from '@tiptap/core';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError } from '@/lib/attachments.ts';
import type { AttachmentKind } from '@/models.ts';
import type { AttachmentDeps } from './deps';

const MIME_PREFIX: Partial<Record<AttachmentKind, string>> = {
  image: 'image/',
  audio: 'audio/',
};

/** Validate -> createAttachment -> insert node, for each file matching the
 *  kind's MIME prefix. One getNoteId() per batch (a draft persists once).
 *  insertNode inserts the kind's TipTap node for a new attachment id. */
export async function insertAttachmentFiles(
  editor: Editor,
  files: FileList | File[],
  kind: AttachmentKind,
  deps: AttachmentDeps,
  insertNode: (attachmentId: string) => void
): Promise<void> {
  const prefix = MIME_PREFIX[kind];
  if (!prefix) return;
  const matched = Array.from(files).filter((f) => f.type.startsWith(prefix));
  if (matched.length === 0) return;
  const noteId = await deps.getNoteId();
  for (const file of matched) {
    try {
      const att = await deps.createAttachment(noteId, file, kind);
      insertNode(att.id);
    } catch (err) {
      if (err instanceof AttachmentError) {
        deps.onError(err.code);
      } else {
        console.error('insertAttachmentFiles: failed to add attachment', err);
        deps.onError('insert-failed');
      }
    }
  }
}

/** Clone-on-insert for foreign attachments (cross-note copy/paste). Any
 *  attachment node (image or audio) whose row is owned by another note is
 *  re-pointed at a fresh owned clone; every node sharing an old id is rewritten. */
export async function dedupeForeignAttachments(editor: Editor, deps: AttachmentDeps): Promise<void> {
  const noteId = await deps.getNoteId();
  const ids = extractAttachmentIds(editor.getHTML());
  for (const id of ids) {
    const att = await deps.getAttachment(id);
    if (!att || att.noteId === noteId) continue;
    const clone = await deps.cloneAttachment(att, noteId);
    const positions: number[] = [];
    editor.state.doc.descendants((node, p) => {
      if (node.attrs.attachmentId === id) positions.push(p);
      return true;
    });
    if (positions.length > 0) {
      editor
        .chain()
        .command(({ tr }) => {
          for (const p of positions) tr.setNodeAttribute(p, 'attachmentId', clone.id);
          return true;
        })
        .run();
    }
  }
}
```

- [ ] **Step 2: Move `Image.test.ts`'s pipeline tests to the new API**

In `src/components/editor/extensions/Image/Image.test.ts`, change the `insertImageFiles` import to `import { insertAttachmentFiles } from '../attachments/insert';` and update the three pipeline tests to call `insertAttachmentFiles(editor, files, 'image', deps, (id) => editor.chain().focus().insertImageAttachment({ attachmentId: id }).run())`. Update `stubDeps()` so `createAttachment` is typed `(noteId, file, _kind) => ...`. Keep the assertions (a node with the id is inserted; `onError('too-large')` / generic path; non-image files ignored). Add one test for the generic-error path if not already present: `createAttachment` rejects with `new Error('boom')` -> `onError('insert-failed')`, no throw.

- [ ] **Step 3: Run to verify the moved tests fail (old module gone)**

Run: `pnpm test src/components/editor/extensions/Image/Image.test.ts`
Expected: FAIL until `ImageButton` + deletion below compile - proceed to wire.

- [ ] **Step 4: Refactor `ImageButton` to the generalized pipeline**

In `src/components/editor/extensions/Image/ImageButton.tsx`, change the import to `import { insertAttachmentFiles } from '../attachments/insert';` and the onChange call to:

```tsx
if (e.target.files)
  void insertAttachmentFiles(editor, e.target.files, 'image', getDeps(), (id) =>
    editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
  );
```

- [ ] **Step 5: Update `editor.tsx` paste/drop imports + delete the old module**

In `src/components/editor/editor.tsx`, change `import { insertImageFiles, dedupeForeignImages } from '@/components/editor/extensions/Image/insert';` to `import { insertAttachmentFiles, dedupeForeignAttachments } from '@/components/editor/extensions/attachments/insert';`. In `handlePaste`/`handleDrop`, replace the image-file calls with:

```ts
void insertAttachmentFiles(ed, files, 'image', imageDepsRef.current, (id) =>
  ed.chain().focus().insertImageAttachment({ attachmentId: id }).run()
);
```

and the HTML-paste dedupe call with `queueMicrotask(() => void dedupeForeignAttachments(ed, imageDepsRef.current));`. Then delete `src/components/editor/extensions/Image/insert.ts`.

- [ ] **Step 6: Run image tests + full suite + build**

Run: `pnpm test src/components/editor/extensions/Image/ && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/extensions/attachments/insert.ts src/components/editor/extensions/Image/ src/components/editor/editor.tsx
git rm src/components/editor/extensions/Image/insert.ts 2>/dev/null; git add -A src/components/editor/extensions/Image/
git commit -m "[EDIT] Generalize attachment insert pipeline; move Image onto it"
```

---

## Task 4: Extract `createAttachmentNode` factory; build Image from it

**Files:**
- Create: `src/components/editor/extensions/attachments/createAttachmentNode.ts`
- Modify: `src/components/editor/extensions/Image/Image.ts`
- Test: `src/components/editor/extensions/Image/Image.test.ts` (unchanged assertions must still pass)

**Interfaces:**
- Consumes: `AttachmentDeps` (Task 2).
- Produces: `createAttachmentNode(getDeps: () => AttachmentDeps, config: AttachmentNodeConfig)` where
  `interface AttachmentNodeConfig { name: string; parseTag: string; renderTag: string; insertCommandName: string; nodeView: ComponentType<ReactNodeViewProps>; button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => unknown; }`

- [ ] **Step 1: Implement the factory**

Create `src/components/editor/extensions/attachments/createAttachmentNode.ts`:

```ts
import { type Editor, mergeAttributes, Node } from '@tiptap/core';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import type { ComponentType } from 'react';
import type { TFunction } from '../button-types';
import type { AttachmentDeps } from './deps';

export interface AttachmentNodeConfig {
  /** TipTap node name, e.g. 'imageAttachment'. */
  name: string;
  /** parseHTML tag selector, e.g. 'img[data-attachment-id]'. */
  parseTag: string;
  /** renderHTML tag, e.g. 'img'. No src is ever emitted (ADR 0007). */
  renderTag: string;
  /** Command name that inserts this node, e.g. 'insertImageAttachment'. */
  insertCommandName: string;
  nodeView: ComponentType<ReactNodeViewProps>;
  /** Pattern A button factory (custom component). */
  button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => unknown;
}

/**
 * Shared TipTap node mechanics for every media attachment (image, audio, ...):
 * one `attachmentId` attribute, id-only parse/render (no src), the getDeps
 * stable-getter option wiring (so the toolbar button/NodeView read live deps -
 * Slice 1's frozen-deps fix), a React NodeView, and an insert command. Per-type
 * concerns (tag, NodeView, button, command name) come from config.
 */
export function createAttachmentNode(getDeps: () => AttachmentDeps, config: AttachmentNodeConfig) {
  return Node.create({
    name: config.name,
    group: 'block',
    atom: true,
    draggable: true,

    addOptions() {
      return {
        getDeps,
        button: ({ editor, t }: { editor: Editor; t: TFunction }) =>
          config.button({ editor, getDeps, t }),
      };
    },

    addAttributes() {
      return {
        attachmentId: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute('data-attachment-id'),
          renderHTML: (attrs: { attachmentId?: string | null }) =>
            attrs.attachmentId ? { 'data-attachment-id': attrs.attachmentId } : {},
        },
      };
    },

    parseHTML() {
      return [{ tag: config.parseTag }];
    },

    renderHTML({ HTMLAttributes }) {
      return [config.renderTag, mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(config.nodeView);
    },

    addCommands() {
      const name = this.name;
      const command =
        (attrs: { attachmentId: string }) =>
        ({ commands }: { commands: { insertContent: (c: unknown) => boolean } }) =>
          commands.insertContent({ type: name, attrs });
      return { [config.insertCommandName]: command };
    },
  });
}
```

- [ ] **Step 2: Rebuild `createImage` on the factory**

Replace the body of `src/components/editor/extensions/Image/Image.ts` (keep the `declare module` command augmentation):

```ts
import type { AttachmentDeps } from '../attachments/deps';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import { ImageButton } from './ImageButton';
import { ImageNodeView } from './ImageNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageAttachment: {
      insertImageAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/** Custom inline-image node built on the shared attachment-node factory. */
export function createImage(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    name: 'imageAttachment',
    parseTag: 'img[data-attachment-id]',
    renderTag: 'img',
    insertCommandName: 'insertImageAttachment',
    nodeView: ImageNodeView,
    button: ({ editor, getDeps, t }) => ({
      component: ImageButton,
      componentProps: { editor, getDeps, tooltip: t('editor.image.tooltip') },
    }),
  });
}
```

- [ ] **Step 3: Run image tests to verify identical behavior**

Run: `pnpm test src/components/editor/extensions/Image/Image.test.ts src/components/editor/extensions/Image/ImageNodeView.test.tsx`
Expected: PASS - parse/render round-trip (no `src`), `insertImageAttachment`, button tooltip all unchanged.

- [ ] **Step 4: Full suite + build**

Run: `pnpm test && pnpm build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/attachments/createAttachmentNode.ts src/components/editor/extensions/Image/Image.ts
git commit -m "[EDIT] Extract createAttachmentNode factory; build Image from it"
```

---

## Task 5: `AudioNodeView` - custom player on a hidden `<audio>`

**Files:**
- Create: `src/components/editor/extensions/Audio/AudioNodeView.tsx`
- Create: `src/components/editor/extensions/Audio/AudioNodeView.test.tsx`
- Modify: `src/components/icons/icons.ts` (add `Play`, `Pause`)

**Interfaces:**
- Consumes: `useAttachmentObjectUrl` (Task 2), `AttachmentDeps` (Task 2).
- Produces: `AudioNodeView` (default export) rendered by `ReactNodeViewRenderer` in Task 6. A `formatTime(seconds: number): string` helper (`m:ss`).

- [ ] **Step 1: Write the failing RTL test**

Create `src/components/editor/extensions/Audio/AudioNodeView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { AudioNodeView, formatTime } from './AudioNodeView';

beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
  // jsdom's HTMLMediaElement.play/pause are not implemented.
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async () => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

function att(): Attachment {
  const now = new Date().toISOString();
  return { id: 'a1', noteId: 'n1', kind: 'audio', mime: 'audio/webm', blob: new Blob(['x']), name: 'memo.webm', duration: 14, createdAt: now, updatedAt: now };
}
function props(get: (i: string) => Promise<Attachment | undefined>) {
  return { node: { attrs: { attachmentId: 'a1' } }, extension: { options: { getDeps: () => ({ getAttachment: get, t: (k: string) => k }) } } } as unknown as Parameters<typeof AudioNodeView>[0];
}

describe('formatTime', () => {
  it('formats seconds as m:ss', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(14)).toBe('0:14');
    expect(formatTime(75)).toBe('1:15');
  });
});

describe('AudioNodeView', () => {
  it('resolves the blob into the audio element src and exposes a play control', async () => {
    render(<AudioNodeView {...props(async () => att())} />);
    const play = await screen.findByRole('button', { name: /play/i });
    expect(play).toBeInTheDocument();
    const audio = document.querySelector('audio');
    await waitFor(() => expect(audio).toHaveAttribute('src', expect.stringContaining('blob:mock/')));
  });

  it('toggles play/pause on click', async () => {
    render(<AudioNodeView {...props(async () => att())} />);
    const btn = await screen.findByRole('button', { name: /play/i });
    await userEvent.click(btn);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('shows an unavailable state when the row is missing', async () => {
    render(<AudioNodeView {...props(async () => undefined)} />);
    expect(await screen.findByText('editor.audio.unavailable')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Audio/AudioNodeView.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the player**

Create `src/components/editor/extensions/Audio/AudioNodeView.tsx`:

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useEffect, useRef, useState } from 'react';
import { icons } from '@/components/icons';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Seconds -> "m:ss". */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Editor render path for audioAttachment: a hidden native <audio> (decode/seek
 *  engine) skinned with a themed play/pause + time + scrubber. Object-URL
 *  lifecycle handled by the shared hook. */
export function AudioNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const Play = icons.Play;
  const Pause = icons.Pause;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(Number.isFinite(el.duration) ? el.duration : 0);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  const seek = (v: number) => {
    const el = audioRef.current;
    if (el) el.currentTime = v;
    setCurrent(v);
  };

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
          {deps.t('editor.audio.unavailable')}
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
        <button
          type="button"
          onClick={toggle}
          disabled={state.status !== 'ready'}
          aria-label={deps.t(playing ? 'editor.audio.pause' : 'editor.audio.play')}
          className="flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
        >
          {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <input
          type="range"
          min={0}
          max={duration || (state.status === 'ready' ? (state.attachment.duration ?? 0) : 0)}
          value={current}
          step={0.1}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label={deps.t('editor.audio.seek')}
          className="h-1 flex-1 accent-primary"
        />
        <span className="tabular-nums text-muted-foreground text-xs">
          {formatTime(current)} / {formatTime(duration || (state.status === 'ready' ? (state.attachment.duration ?? 0) : 0))}
        </span>
        {state.status === 'ready' && (
          <audio ref={audioRef} src={state.url} preload="metadata" className="hidden">
            <track kind="captions" />
          </audio>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export default AudioNodeView;
```

- [ ] **Step 4: Add the icons**

In `src/components/icons/icons.ts`, add `Play`, `Pause` to the `lucide-react` import and the `icons` object.

- [ ] **Step 5: Add the i18n keys (used by the player + tests)**

Add to `public/locales/en/translation.json` under `editor`, a new `audio` object: `{ "play": "Play", "pause": "Pause", "seek": "Seek", "unavailable": "Audio unavailable" }`. Add the Czech equivalents to `public/locales/cs/translation.json`: `{ "play": "Přehrát", "pause": "Pozastavit", "seek": "Přetáčet", "unavailable": "Zvuk není k dispozici" }`.

- [ ] **Step 6: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/Audio/AudioNodeView.test.tsx && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/extensions/Audio/AudioNodeView.tsx src/components/editor/extensions/Audio/AudioNodeView.test.tsx src/components/icons/icons.ts public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] AudioNodeView custom player"
```

---

## Task 6: `audioAttachment` node via the factory (headless)

**Files:**
- Create: `src/components/editor/extensions/Audio/Audio.ts`, `Audio/index.ts`, `Audio/Audio.test.ts`

**Interfaces:**
- Consumes: `createAttachmentNode` (Task 4), `AttachmentDeps` (Task 2), `AudioNodeView` (Task 5).
- Produces: `createAudio(getDeps: () => AttachmentDeps)` -> node `audioAttachment` with command `insertAudioAttachment({ attachmentId })`; body tag `audio[data-attachment-id]`. The Pattern A button is added in Task 8 (temporary `null` placeholder here).

- [ ] **Step 1: Write the failing headless test**

Create `src/components/editor/extensions/Audio/Audio.test.ts`:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { createAudio } from './Audio';

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

function createEditor() {
  return new Editor({ extensions: [Document, Paragraph, Text, createAudio(() => deps)], content: '<p></p>' });
}

describe('audioAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses audio[data-attachment-id] and re-renders with no src', () => {
    editor.commands.setContent('<audio data-attachment-id="abc"></audio>');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('src=');
  });

  it('insertAudioAttachment inserts a node with the id', () => {
    editor.commands.insertAudioAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Audio/Audio.test.ts`
Expected: FAIL - `createAudio` not found.

- [ ] **Step 3: Implement `Audio.ts`**

Create `src/components/editor/extensions/Audio/Audio.ts`:

```ts
import type { Editor } from '@tiptap/core';
import type { AttachmentDeps } from '../attachments/deps';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import { AudioNodeView } from './AudioNodeView';
import { AudioRecordButton } from './AudioRecordButton';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audioAttachment: {
      insertAudioAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/** Custom audio-attachment node built on the shared factory. Body serializes as
 *  <audio data-attachment-id> (no src); the NodeView is a custom player. */
export function createAudio(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    name: 'audioAttachment',
    parseTag: 'audio[data-attachment-id]',
    renderTag: 'audio',
    insertCommandName: 'insertAudioAttachment',
    nodeView: AudioNodeView,
    button: ({ editor, getDeps, t }: { editor: Editor; getDeps: () => AttachmentDeps; t: (k: string) => string }) => ({
      component: AudioRecordButton,
      componentProps: { editor, getDeps, tooltip: t('editor.audio.tooltip') },
    }),
  });
}
```

Create `src/components/editor/extensions/Audio/index.ts`:

```ts
export * from './Audio';
export * from './AudioRecordButton';
```

- [ ] **Step 4: Add a placeholder `AudioRecordButton`** so the import resolves (real impl in Task 8)

Create `src/components/editor/extensions/Audio/AudioRecordButton.tsx`:

```tsx
import type { Editor } from '@tiptap/core';
import type { AttachmentDeps } from '../attachments/deps';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

// Placeholder - real record widget + file picker land in Task 8.
export function AudioRecordButton(_props: AudioRecordButtonProps) {
  return null;
}
```

- [ ] **Step 5: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/Audio/Audio.test.ts && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/extensions/Audio/
git commit -m "[ADD] audioAttachment node via shared factory (headless)"
```

---

## Task 7: `useAudioRecorder` recording state machine

**Files:**
- Create: `src/components/editor/extensions/Audio/useAudioRecorder.ts`, `Audio/useAudioRecorder.test.tsx`

**Interfaces:**
- Produces:
  - `type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'error'`
  - `interface AudioRecorder { status: RecorderStatus; elapsedMs: number; error: string | null; supported: boolean; start: () => Promise<void>; stop: () => Promise<{ blob: Blob; mime: string; durationMs: number } | null>; cancel: () => void; }`
  - `useAudioRecorder(): AudioRecorder`
  - `MAX_RECORDING_MS = 5 * 60 * 1000`
  - `pickAudioMimeType(): string | null` (feature-detects supported MediaRecorder mime)

- [ ] **Step 1: Write the failing test**

Create `src/components/editor/extensions/Audio/useAudioRecorder.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAudioRecorder } from './useAudioRecorder';

class FakeRecorder {
  static isTypeSupported = vi.fn(() => true);
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  state = 'inactive';
  constructor(public stream: unknown, public opts: { mimeType?: string }) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['abc'], { type: this.opts.mimeType }) });
    this.onstop?.();
  }
}

const track = { stop: vi.fn() };
const stream = { getTracks: () => [track] };

beforeEach(() => {
  track.stop.mockReset();
  (globalThis as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeRecorder;
  Object.defineProperty(globalThis.navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: vi.fn(async () => stream) },
  });
});
afterEach(() => vi.restoreAllMocks());

describe('useAudioRecorder', () => {
  it('start -> recording, stop -> blob + tracks released', async () => {
    const { result } = renderHook(() => useAudioRecorder());
    expect(result.current.supported).toBe(true);
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('recording'));
    let out: { blob: Blob } | null = null;
    await act(async () => {
      out = await result.current.stop();
    });
    expect(out?.blob).toBeInstanceOf(Blob);
    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('sets error state when getUserMedia is denied', async () => {
    (navigator.mediaDevices.getUserMedia as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('denied'));
    const { result } = renderHook(() => useAudioRecorder());
    await act(async () => {
      await result.current.start();
    });
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Audio/useAudioRecorder.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the hook**

Create `src/components/editor/extensions/Audio/useAudioRecorder.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export const MAX_RECORDING_MS = 5 * 60 * 1000;

const CANDIDATE_MIME = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'];

/** First MediaRecorder mime the browser supports, or null if unsupported. */
export function pickAudioMimeType(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const m of CANDIDATE_MIME) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

export type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'error';

export interface AudioRecorder {
  status: RecorderStatus;
  elapsedMs: number;
  error: string | null;
  supported: boolean;
  start: () => Promise<void>;
  stop: () => Promise<{ blob: Blob; mime: string; durationMs: number } | null>;
  cancel: () => void;
}

/** Wraps getUserMedia + MediaRecorder as a small state machine. Releases the
 *  mic (stops all tracks) on stop/cancel/unmount. Auto-stops at MAX_RECORDING_MS. */
export function useAudioRecorder(): AudioRecorder {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (autoStopRef.current) clearTimeout(autoStopRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const start = useCallback(async () => {
    if (!supported) {
      setStatus('error');
      setError('unsupported');
      return;
    }
    setStatus('requesting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickAudioMimeType() ?? '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsedMs(0);
      setStatus('recording');
      tickRef.current = setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 200);
      autoStopRef.current = setTimeout(() => {
        void stopInternalRef.current?.();
      }, MAX_RECORDING_MS);
    } catch {
      cleanup();
      setStatus('error');
      setError('denied');
    }
  }, [supported, cleanup]);

  const stopInternalRef = useRef<(() => Promise<{ blob: Blob; mime: string; durationMs: number } | null>) | null>(null);

  const stop = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || status !== 'recording') return null;
    const durationMs = Date.now() - startedAtRef.current;
    const result = await new Promise<{ blob: Blob; mime: string }>((resolve) => {
      recorder.onstop = () => {
        const mime = recorder.mimeType || 'audio/webm';
        resolve({ blob: new Blob(chunksRef.current, { type: mime }), mime });
      };
      recorder.stop();
    });
    cleanup();
    setStatus('idle');
    setElapsedMs(0);
    return { ...result, durationMs };
  }, [status, cleanup]);

  stopInternalRef.current = stop;

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      recorder.stop();
    }
    cleanup();
    setStatus('idle');
    setElapsedMs(0);
  }, [cleanup]);

  return { status, elapsedMs, error, supported, start, stop, cancel };
}
```

- [ ] **Step 4: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/Audio/useAudioRecorder.test.tsx && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Audio/useAudioRecorder.ts src/components/editor/extensions/Audio/useAudioRecorder.test.tsx
git commit -m "[ADD] useAudioRecorder state machine"
```

---

## Task 8: `AudioRecordButton` - mic button, record widget, file picker

**Files:**
- Modify: `src/components/editor/extensions/Audio/AudioRecordButton.tsx`
- Create: `src/components/editor/extensions/Audio/AudioRecordButton.test.tsx`
- Modify: `src/components/icons/icons.ts` (add `Mic`, `Square`)

**Interfaces:**
- Consumes: `useAudioRecorder` (Task 7), `AttachmentDeps` (Task 2), `insertAttachmentFiles` (Task 3), `ALLOWED_AUDIO_MIME` (Task 1), `formatTime` (Task 5).
- Produces: the real `AudioRecordButton` (Pattern A). On stop: `getNoteId()` -> `createAttachment(noteId, new File([blob], name, { type }), 'audio')` -> `insertAudioAttachment`. On file pick: `insertAttachmentFiles(..., 'audio', ...)`.

- [ ] **Step 1: Write the failing test**

Create `src/components/editor/extensions/Audio/AudioRecordButton.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';
import type { AttachmentDeps } from '../attachments/deps';
import { AudioRecordButton } from './AudioRecordButton';

const recorder = {
  status: 'idle' as string,
  elapsedMs: 0,
  error: null as string | null,
  supported: true,
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => ({ blob: new Blob(['x'], { type: 'audio/webm' }), mime: 'audio/webm', durationMs: 3200 })),
  cancel: vi.fn(),
};
vi.mock('./useAudioRecorder', () => ({ useAudioRecorder: () => recorder, MAX_RECORDING_MS: 300000 }));

function makeEditor() {
  return { chain: () => ({ focus: () => ({ insertAudioAttachment: () => ({ run: vi.fn() }) }) }) } as unknown as Editor;
}

const createAttachment = vi.fn(async () => ({ id: 'att1' }));
const deps = { getNoteId: vi.fn(async () => 'note1'), createAttachment, onError: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

beforeEach(() => {
  recorder.status = 'idle';
  createAttachment.mockClear();
});
afterEach(() => vi.clearAllMocks());

describe('AudioRecordButton', () => {
  it('renders a mic button', () => {
    render(<AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />);
    expect(screen.getByRole('button', { name: 'rec' })).toBeInTheDocument();
  });

  it('stop creates an audio attachment and inserts it', async () => {
    recorder.status = 'recording';
    render(<AudioRecordButton editor={makeEditor()} getDeps={() => deps} tooltip="rec" />);
    await userEvent.click(screen.getByRole('button', { name: /stop/i }));
    await waitFor(() => expect(deps.getNoteId).toHaveBeenCalled());
    expect(createAttachment).toHaveBeenCalledWith('note1', expect.any(File), 'audio');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Audio/AudioRecordButton.test.tsx`
Expected: FAIL - the placeholder renders null.

- [ ] **Step 3: Add icons + i18n first (so the component's imports resolve)**

In `src/components/icons/icons.ts` add `Mic`, `Square`, `Paperclip` to the `lucide-react` import and the `icons` object. Add to `public/locales/en/translation.json` under `editor.audio` (the object created in Task 5): `"tooltip": "Record audio"`, `"attach": "Attach audio file"`, `"stop": "Stop"`, `"cancel": "Cancel"`, and an `errors` object `{ "permission": "Microphone access was denied", "unsupported": "Audio recording is not supported in this browser" }`. Add Czech equivalents (`"tooltip": "Nahrát zvuk"`, `"attach": "Připojit zvukový soubor"`, `"stop": "Zastavit"`, `"cancel": "Zrušit"`, `errors: { "permission": "Přístup k mikrofonu byl odepřen", "unsupported": "Nahrávání zvuku není v tomto prohlížeči podporováno" }`).

Audio permission/unsupported failures use a **direct sonner toast** (not `deps.onError`, which is keyed to `AttachmentErrorCode` for file validation). `deps.onError('insert-failed')` is still used for a failed save of a recording.

- [ ] **Step 4: Implement the button + widget**

Replace `src/components/editor/extensions/Audio/AudioRecordButton.tsx`:

```tsx
import type { Editor } from '@tiptap/core';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { ALLOWED_AUDIO_MIME } from '@/lib/attachments.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';
import { formatTime } from './AudioNodeView';
import { useAudioRecorder } from './useAudioRecorder';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/** Toolbar entry point for audio: a mic button that toggles an inline record
 *  widget (timer + Stop + Cancel) and offers a file picker. Recording -> Blob ->
 *  audio attachment; picked files -> shared insert pipeline. */
export function AudioRecordButton({ editor, getDeps, tooltip }: AudioRecordButtonProps) {
  const rec = useAudioRecorder();
  const inputRef = useRef<HTMLInputElement>(null);
  const Square = icons.Square;

  // Recorder errors (permission denied / unsupported) surface as a toast.
  useEffect(() => {
    if (rec.status === 'error') {
      const key = rec.error === 'unsupported' ? 'editor.audio.errors.unsupported' : 'editor.audio.errors.permission';
      toast(getDeps().t(key));
    }
  }, [rec.status, rec.error, getDeps]);

  const insert = (id: string) =>
    editor.chain().focus().insertAudioAttachment({ attachmentId: id }).run();

  const onStop = async () => {
    const out = await rec.stop();
    if (!out) return;
    const deps = getDeps();
    try {
      const noteId = await deps.getNoteId();
      const ext = EXT[out.mime.split(';')[0]] ?? 'webm';
      const file = new File([out.blob], `recording.${ext}`, { type: out.mime });
      const att = await deps.createAttachment(noteId, file, 'audio');
      insert(att.id);
    } catch {
      deps.onError('insert-failed');
    }
  };

  if (!rec.supported) {
    return <ActionButton icon="Mic" tooltip={tooltip} disabled action={() => {}} />;
  }

  if (rec.status === 'recording') {
    const t = getDeps().t;
    return (
      <span className="flex items-center gap-2 rounded-md border px-2 py-1">
        <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
        <span className="tabular-nums text-xs">{formatTime(rec.elapsedMs / 1000)}</span>
        <button type="button" onClick={() => void onStop()} aria-label={t('editor.audio.stop')} className="text-xs">
          <Square className="size-4" />
        </button>
        <button type="button" onClick={() => rec.cancel()} aria-label={t('editor.audio.cancel')} className="text-muted-foreground text-xs">
          {t('editor.audio.cancel')}
        </button>
      </span>
    );
  }

  return (
    <>
      <ActionButton icon="Mic" tooltip={tooltip} action={() => void rec.start()} />
      {/* File-attach affordance: reuses the same node insertion via the shared
          pipeline. paste/drop (Task 9) also attach audio files. */}
      <ActionButton
        icon="Paperclip"
        tooltip={getDeps().t('editor.audio.attach')}
        action={() => inputRef.current?.click()}
      />
      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED_AUDIO_MIME.join(',')}
        className="hidden"
        onChange={(e) => {
          if (e.target.files)
            void insertAttachmentFiles(editor, e.target.files, 'audio', getDeps(), insert);
          e.target.value = '';
        }}
      />
    </>
  );
}
```

The `Paperclip` icon and `editor.audio.attach` string are added in Step 3 alongside the other audio icons/strings (`Paperclip` in `icons.ts`; en `"attach": "Attach audio file"`, cs `"attach": "Připojit zvukový soubor"`).

- [ ] **Step 5: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/Audio/AudioRecordButton.test.tsx && pnpm test && pnpm build && pnpm check:ci`
Expected: green/clean.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/extensions/Audio/AudioRecordButton.tsx src/components/editor/extensions/Audio/AudioRecordButton.test.tsx src/components/icons/icons.ts public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] AudioRecordButton - mic record widget + audio file picker"
```

---

## Task 9: Register audio in the editor (node, toolbar, paste/drop)

**Files:**
- Modify: `src/components/editor/editor.tsx`
- Modify: `src/components/editor/menus/toolbars/BlocksSection.tsx`

**Interfaces:**
- Consumes: `createAudio` (Task 6), `insertAttachmentFiles` (Task 3), the renamed `attachmentDeps`/`getAttachmentDeps` (this task).

- [ ] **Step 1: Rename `imageDeps` -> `attachmentDeps` and register audio**

In `src/components/editor/editor.tsx`:
- Rename the `imageDeps` memo to `attachmentDeps`, `imageDepsRef` to `attachmentDepsRef`, `getImageDeps` to `getAttachmentDeps` (search/replace within the file).
- Add `import { createAudio } from '@/components/editor/extensions/Audio';`.
- In the `extensions` array, after `createImage(getAttachmentDeps)`, add `createAudio(getAttachmentDeps),`.

- [ ] **Step 2: Route audio files through paste/drop**

In the same file's `handlePaste`/`handleDrop`, after the image-file branch, add an audio branch:

```ts
if (ed && files && Array.from(files).some((f) => f.type.startsWith('audio/'))) {
  void insertAttachmentFiles(ed, files, 'audio', attachmentDepsRef.current, (id) =>
    ed.chain().focus().insertAudioAttachment({ attachmentId: id }).run()
  );
  return true;
}
```

(Place it alongside the existing image branch; the image branch already returns true for image files, so ordering is fine.)

- [ ] **Step 3: Add the mic button to the toolbar**

In `src/components/editor/menus/toolbars/BlocksSection.tsx`, add `'audioAttachment'` to the names array (after `'imageAttachment'`), so `ExtensionButtonBar` renders the audio button.

- [ ] **Step 4: Build + full suite (editor.tsx has no unit test; build is the gate)**

Run: `pnpm build && pnpm test && pnpm check:ci`
Expected: green/clean.

- [ ] **Step 5: Manual smoke (per repo manual-UI policy)**

`pnpm dev`: open a note, click the mic, record + stop -> player appears + plays; paste/drop an audio file -> player; reload -> persists. (Playwright deferred.)

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/editor.tsx src/components/editor/menus/toolbars/BlocksSection.tsx
git commit -m "[ADD] Register audio node + mic button + audio paste/drop"
```

---

## Task 10: Read-only audio chip in `NoteBody` + card autoplay-on-open

**Files:**
- Modify: `src/components/NoteBody.tsx`, `src/components/NoteBody.test.tsx`
- Modify: `src/components/cards/NoteCard.tsx`, `src/components/notes/NotesHome.tsx`, `src/components/notes/NoteEditorDialog.tsx`

**Interfaces:**
- Consumes: `useAttachmentActions().getAttachment`; `formatTime` (Task 5).
- Produces: `NotesHome`/`NoteEditorDialog` intent thread - `onSelect(id, opts?: { autoplayFirstAudio?: boolean })`; the dialog exposes the intent to the editor via a prop `autoplayFirstAudio?: boolean` (best-effort).

- [ ] **Step 1: Write the failing `NoteBody` test**

Add to `src/components/NoteBody.test.tsx` (it mocks `URL.createObjectURL`; add `import { db } from '@/db/db.ts';` if not present):

```tsx
it('renders a compact chip (not a player) for an audio attachment', async () => {
  const now = new Date().toISOString();
  await db.attachments.put({ id: 'au1', noteId: 'n1', kind: 'audio', mime: 'audio/webm', blob: new Blob(['x']), duration: 14, createdAt: now, updatedAt: now });
  render(<NoteBody html='<audio data-attachment-id="au1"></audio>' />);
  await waitFor(() => expect(screen.getByText(/0:14/)).toBeInTheDocument());
  // No <audio> element is mounted in the card (chip only).
  expect(document.querySelector('audio')).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/NoteBody.test.tsx`
Expected: FAIL - no chip rendered (audio ignored today).

- [ ] **Step 3: Branch `NoteBody` by element**

In `src/components/NoteBody.tsx`, after the `img[data-attachment-id]` loop, add an audio loop that replaces each `<audio data-attachment-id>` with a chip (mic icon + duration). Because the component sets `innerHTML` imperatively, build the chip as DOM (icon via a Unicode mic glyph to avoid a React island, plus the formatted duration):

```tsx
import { formatTime } from '@/components/editor/extensions/Audio/AudioNodeView';
// ...inside the effect, after the imgs loop:
const audios = root.querySelectorAll<HTMLElement>('audio[data-attachment-id]');
audios.forEach((el) => {
  const id = el.getAttribute('data-attachment-id');
  if (!id) return;
  const chip = document.createElement('span');
  chip.className =
    'inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2 py-0.5 align-middle text-muted-foreground text-xs';
  chip.setAttribute('data-attachment-chip', 'audio');
  el.replaceWith(chip);
  getAttachment(id).then((att) => {
    if (!active) return;
    chip.textContent = att?.duration != null ? `\u{1F399} ${formatTime(att.duration)}` : '\u{1F399}';
  });
});
```

(Keep the existing `img` handling and the `urls` revoke cleanup. Audio chips create no object URLs, so nothing to revoke for them.)

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/components/NoteBody.test.tsx`
Expected: PASS.

- [ ] **Step 5: Thread the autoplay-on-open intent**

- `src/components/cards/NoteCard.tsx`: the card's `open()` already calls `onSelect(note.id)`. Change `onSelect` prop type to `(id: string, opts?: { autoplayFirstAudio?: boolean }) => void`. The full-card open stays `onSelect(note.id)`. For the audio chip, `NoteBody` is read-only DOM inside the card - so instead of a separate play button, treat a click on an audio chip as "open + autoplay": add an `onClick` on the card that checks `e.target.closest('[data-attachment-chip="audio"]')` and, if matched, calls `onSelect(note.id, { autoplayFirstAudio: true })` and `e.stopPropagation()`. (Cheap, no React island in the chip.)
- `src/components/notes/NotesHome.tsx`: pass the opts through to the dialog - store `autoplayFirstAudio` alongside the selected id in the open-editor state, and pass it to `<NoteEditorDialog autoplayFirstAudio={...} />`.
- `src/components/notes/NoteEditorDialog.tsx`: accept `autoplayFirstAudio?: boolean` and pass it to `<Editor autoplayFirstAudio={...} />`.
- `src/components/editor/editor.tsx`: accept `autoplayFirstAudio?: boolean`; on editor ready, if set, find the first `audioAttachment` node and dispatch a one-shot play by setting an editor storage flag the `AudioNodeView` reads on mount to call `el.play()` best-effort. Minimal mechanism: pass `autoplayFirstAudio` into `attachmentDeps` is wrong (deps are data-layer); instead store `editor.storage.autoplayFirstAudioId = <first audio id>` when the flag is set, and in `AudioNodeView` after the audio element is ready, `if (props.editor.storage.autoplayFirstAudioId === attachmentId) { void audioRef.current?.play(); delete props.editor.storage.autoplayFirstAudioId; }`. Guard for the mobile-autoplay caveat: wrap in try/catch and ignore rejection.

- [ ] **Step 6: Add a dialog regression test (audio-only note kept) + run**

In `src/components/notes/NoteEditorDialog.test.tsx`, add a test mirroring the image-only one but with body `<audio data-attachment-id="au1">`: it must persist (length 1) and not be discarded. Run:

Run: `pnpm test src/components/NoteBody.test.tsx src/components/notes/NoteEditorDialog.test.tsx src/components/cards/NoteCard.test.tsx && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/components/NoteBody.tsx src/components/NoteBody.test.tsx src/components/cards/NoteCard.tsx src/components/notes/NotesHome.tsx src/components/notes/NoteEditorDialog.tsx src/components/notes/NoteEditorDialog.test.tsx src/components/editor/editor.tsx
git commit -m "[ADD] Audio card chip + best-effort autoplay-on-open"
```

---

## Task 11: Docs, cross-task integration check, final gate

**Files:**
- Modify: `src/components/editor/CLAUDE.md`, `PLAN.md`

- [ ] **Step 1: Cross-task integration check (the Slice 1 lesson)**

Manually verify (or assert in an existing test) that an **audio-only note** renders a chip on the home card (not a blank card) and survives close. `NoteCard.hasBody` already ORs `bodyHasAttachment` (Slice 1 fix), and `bodyHasAttachment` matches `data-attachment-id` on `<audio>` too - confirm by reading `NoteCard.tsx` and adding a `NoteCard.test.tsx` case rendering a note whose body is only `<audio data-attachment-id="au1">` and asserting the card body region (chip) is present, not empty.

- [ ] **Step 2: Update docs**

In `src/components/editor/CLAUDE.md`, add an `Audio` paragraph next to the `Image` one: a custom `audioAttachment` node built on the shared `createAttachmentNode` factory; body `<audio data-attachment-id>` (no src); `AudioNodeView` custom player on a hidden native `<audio>` via `useAttachmentObjectUrl`; recording via `useAudioRecorder` (MediaRecorder) behind `AudioRecordButton`; file attach via picker/paste/drop through the shared `insertAttachmentFiles`. Note the shared `attachments/` helpers (`createAttachmentNode`, `useAttachmentObjectUrl`, `insert.ts`, `deps.ts`) are the media-agnostic core reused by image + audio. In root `PLAN.md`, tick M3 Slice 2 (audio) and note the remaining deferred slices (video, file, Excalidraw, unified capture bar).

- [ ] **Step 3: Final gate (acceptance criterion 9)**

Run: `pnpm check:ci && pnpm test && pnpm build`
Expected: all green (only the pre-existing `noExplicitAny` warnings).

- [ ] **Step 4: Commit**

```bash
git add src/components/editor/CLAUDE.md PLAN.md src/components/cards/NoteCard.test.tsx
git commit -m "[EDIT] Audio slice docs + integration check"
```

---

## Acceptance criteria -> task map

| # | Criterion | Task(s) |
|---|-----------|---------|
| 1 | Record via mic -> working player, persists | 5, 6, 7, 8, 9 |
| 2 | Attach audio file (picker/paste/drop) | 3, 8, 9 |
| 3 | Body has `<audio data-attachment-id>`, no src; bytes in `attachments` kind=audio + duration | 1, 6, 8 |
| 4 | Card shows audio chip (not blank/broken); play opens + best-effort autoplay | 10, 11 |
| 5 | Remove+undo restores; remove+close GC; delete note+undo restores audio | reused from Slice 1 (verify in 10/11) |
| 6 | Audio-only note saves + survives close | 10, 11 (dialog `bodyHasAttachment` already generic) |
| 7 | Oversized/disallowed rejected; permission/unsupported -> toast, no crash; mic released | 1, 7, 8 |
| 8 | No duplicated media logic; all image tests still green after refactor | 1, 2, 3, 4 |
| 9 | `pnpm check` + `pnpm test` + `pnpm build` green | 11 |

## Deferred (unchanged from spec)

- Mobile capture-bar buttons (image+audio+file together) -> dedicated unified-capture-bar slice after all media types exist.
- Waveform / level-meter (`wavesurfer.js`); recording trim/edit; playback speed.
- Video, File, Excalidraw -> own slices, reusing the shared `attachments/` core.
- Slice 1 carry-forward: startup GC sweep for crash/hard-close orphans (separate tracked follow-up).
