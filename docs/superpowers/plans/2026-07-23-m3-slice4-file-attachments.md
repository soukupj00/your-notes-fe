# M3 Slice 4 - Generic file attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Depends on:** Slice 3.5 (confirm-before-delete retrofit) having landed - Task 3's NodeView delete button consumes its shared `ConfirmDeleteButton` (`src/components/editor/extensions/attachments/ConfirmDeleteButton.tsx`) and the shared `attachments.confirmDelete.*` i18n strings it introduced.

**Goal:** Add a generic `fileAttachment` node (PDFs and any other file type) that attaches via a toolbar picker, renders in the editor as a filename + generic icon + open/download affordance, and shows a file button on home cards - built on the existing media-agnostic attachment core with no schema changes.

**Architecture:** Reuse the Slice 1-3 attachment foundation unchanged (generic `attachments` Dexie table with `kind`, `useAttachmentActions`, delete/undo cascade, GC, `createAttachmentNode`, `useAttachmentObjectUrl`, `insertAttachmentFiles`, `dedupeForeignAttachments`). Add a `kind: 'file'` validation branch (size cap only, no MIME whitelist), a match-all path in the insert pipeline for `file`, a `fileAttachment` node built from the shared factory, a non-media NodeView (filename + icon + open link + delete), a toolbar picker button, and a read-only card button. File attach is toolbar-only this slice (no paste/drop - `file` has no MIME prefix to disambiguate from media in the shared router).

**Tech Stack:** React 19, TypeScript, TipTap v3 (`@tiptap/core` + `@tiptap/react`), Dexie (IndexedDB), Vitest + React Testing Library + `fake-indexeddb`, i18next.

## Global Constraints

- Package manager is **pnpm**. `pnpm test`, `pnpm build`, `pnpm check:ci` - never npm/yarn.
- **IDs** `uuid` v4; **timestamps** ISO strings on `createdAt`/`updatedAt`.
- **Payload is a native `Blob`**, never base64/`data:` (ADR 0007). Body persists `<a ... data-attachment-id>` with **NO `href`**.
- **tsconfig `erasableSyntaxOnly: true`**: no TS constructor parameter-property shorthand (declare field + assign in body). No `enum`/`namespace`.
- **jsdom + fake-indexeddb Blob gotcha**: a Blob read back from the DB under jsdom is a plain object (`instanceof Blob === false`). Component tests stay jsdom and assert only scalar fields or in-memory blobs, never a DB-read blob's identity. jsdom lacks `URL.createObjectURL`/`revokeObjectURL` - mock them in tests.
- **Icons** are string keys in `src/components/icons/icons.ts` - never import a Lucide component into a button config.
- **No em dashes** in code/comments/docs - plain `-`. `@/` import alias. Keep files under 500 lines.
- **File validation: no MIME whitelist** (any type accepted). **File size cap: 50 MB** (`50 * 1024 * 1024`).
- **No duplicated media logic:** file reuses `createAttachmentNode`, `useAttachmentObjectUrl`, `insertAttachmentFiles`, `AttachmentDeps`. All pre-existing image/audio/video tests must stay green.
- **Delete button** consumes Slice 3.5's shared `ConfirmDeleteButton` (`../attachments/ConfirmDeleteButton`), guarded by `props.editor?.isEditable`, wired exactly as Video/Audio/Image are after Slice 3.5: `onConfirm={() => props.deleteNode()}`, `label={deps.t('editor.file.delete')}`, `t={deps.t}`. Dialog copy reuses the shared `attachments.confirmDelete.*` strings (already present from Slice 3.5); only `editor.file.delete` is new here.
- Each task lands with its tests + a commit; `pnpm test` + `pnpm build` stay green at every task boundary.

---

## File Structure

**Create (file extension):**
- `src/components/editor/extensions/File/File.ts` - `fileAttachment` node via the shared factory.
- `src/components/editor/extensions/File/FileNodeView.tsx` - filename + icon + open link + delete.
- `src/components/editor/extensions/File/FileButton.tsx` - toolbar picker (any type).
- `src/components/editor/extensions/File/index.ts` - re-export.
- Tests: `File/File.test.ts`, `File/FileNodeView.test.tsx`.

**Modify:**
- `src/lib/attachments.ts` - add `MAX_FILE_BYTES` + `file` branch in `validateAttachmentFile`.
- `src/components/editor/extensions/attachments/insert.ts` - match-all path for `file`.
- `src/components/icons/icons.ts` - add `FileText`, `Download`.
- `src/components/editor/editor.tsx` - register `createFile`.
- `src/components/editor/menus/toolbars/BlocksSection.tsx` - add `'fileAttachment'`.
- `src/lib/attachment-html.ts` - add `bodyHasFile`.
- `src/components/NoteBody.tsx` - strip `<a data-attachment-id>`.
- `src/components/cards/NoteCard.tsx` - add the file button.
- `public/locales/{en,cs}/translation.json` - file strings + `notes.openFile`.

---

## Task 1: File validation (size cap, no MIME whitelist)

**Files:**
- Modify: `src/lib/attachments.ts`
- Test: `src/lib/attachments.test.ts`

**Interfaces:**
- Consumes: `AttachmentKind` (`@/models.ts`); existing `AttachmentErrorCode`, `validateAttachmentFile`.
- Produces: `MAX_FILE_BYTES: number`; `validateAttachmentFile(file, 'file')` accepts any MIME under the cap, rejects oversize.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/attachments.test.ts`:

```ts
import { MAX_FILE_BYTES, validateAttachmentFile } from './attachments';

function fileOf(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'x', { type });
}

describe('validateAttachmentFile - file kind', () => {
  it('accepts any MIME type under the cap', () => {
    expect(validateAttachmentFile(fileOf('application/pdf'), 'file')).toBeNull();
    expect(validateAttachmentFile(fileOf('application/zip'), 'file')).toBeNull();
    expect(validateAttachmentFile(fileOf('application/octet-stream'), 'file')).toBeNull();
  });

  it('rejects oversized and accepts exactly the cap', () => {
    expect(validateAttachmentFile(fileOf('application/pdf', MAX_FILE_BYTES + 1), 'file')).toBe('too-large');
    expect(validateAttachmentFile(fileOf('application/pdf', MAX_FILE_BYTES), 'file')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/attachments.test.ts`
Expected: FAIL - `MAX_FILE_BYTES` not exported; `file` kind currently returns `'unsupported-type'`.

- [ ] **Step 3: Implement in `src/lib/attachments.ts`**

Add after the video constants:

```ts
/** Per-file size cap: 50 MB. Generous relative to media caps because a file
 *  attachment can be any document (PDFs, archives, ...). Adjustable. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
```

Replace the current `file`-kind fall-through comment/return at the end of `validateAttachmentFile` (`// file kind lands in a later slice; reject until then. return 'unsupported-type';`) with:

```ts
if (kind === 'file') {
  // No MIME whitelist: a file attachment accepts any type. Only the size cap
  // gates it (unlike image/audio/video, which whitelist their MIME).
  if (file.size > MAX_FILE_BYTES) return 'too-large';
  return null;
}
// Unknown kind: reject.
return 'unsupported-type';
```

- [ ] **Step 4: Run tests to verify green + no regression**

Run: `pnpm test src/lib/attachments.test.ts`
Expected: PASS (new file cases + existing image/audio/video cases).

- [ ] **Step 5: Full suite + build**

Run: `pnpm test && pnpm build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/attachments.ts src/lib/attachments.test.ts
git commit -m "[EDIT] Add file-kind validation (size cap, no MIME whitelist)"
```

---

## Task 2: Match-all insert path for the file kind

**Files:**
- Modify: `src/components/editor/extensions/attachments/insert.ts`
- Test: `src/components/editor/extensions/attachments/insert.test.ts` (add a file case; create the file if the pipeline has no dedicated test yet - otherwise add to the existing spec)

**Interfaces:**
- Consumes: `insertAttachmentFiles(editor, files, kind, deps, insertNode)` (existing), `AttachmentDeps`.
- Produces: `insertAttachmentFiles(..., 'file', ...)` takes **all** files regardless of MIME and inserts a node per successfully created attachment.

- [ ] **Step 1: Write the failing test**

Add (or create `insert.test.ts` with) this case. It stubs deps and asserts an arbitrary-MIME file is inserted for `kind: 'file'`:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from './deps';
import { insertAttachmentFiles } from './insert';

function stubDeps(over: Partial<AttachmentDeps> = {}): AttachmentDeps {
  const now = new Date().toISOString();
  return {
    getNoteId: vi.fn(async () => 'n1'),
    createAttachment: vi.fn(async (noteId: string, file: File, kind) => ({
      id: 'att-1',
      noteId,
      kind,
      mime: file.type,
      blob: file,
      name: file.name,
      createdAt: now,
      updatedAt: now,
    }) as Attachment),
    getAttachment: vi.fn(),
    cloneAttachment: vi.fn(),
    onError: vi.fn(),
    t: (k: string) => k,
    ...over,
  } as unknown as AttachmentDeps;
}

function createEditor() {
  return new Editor({ extensions: [Document, Paragraph, Text], content: '<p></p>' });
}

describe('insertAttachmentFiles - file kind', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('takes any-MIME files for kind "file" and inserts one node each', async () => {
    const deps = stubDeps();
    const insertNode = vi.fn();
    const files = [new File([new Uint8Array(10)], 'doc.pdf', { type: 'application/pdf' })];
    await insertAttachmentFiles(editor, files, 'file', deps, insertNode);
    expect(deps.createAttachment).toHaveBeenCalledWith('n1', files[0], 'file');
    expect(insertNode).toHaveBeenCalledWith('att-1');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/attachments/insert.test.ts`
Expected: FAIL - `file` has no `MIME_PREFIX` entry, so `matched` is empty and `insertNode` is never called.

- [ ] **Step 3: Implement the match-all path**

In `src/components/editor/extensions/attachments/insert.ts`, inside `insertAttachmentFiles`, replace the current prefix-filter block:

```ts
const prefix = MIME_PREFIX[kind];
if (!prefix) return;
const matched = Array.from(files).filter((f) => f.type.startsWith(prefix));
if (matched.length === 0) return;
```

with:

```ts
const prefix = MIME_PREFIX[kind];
// `file` has no single MIME prefix: accept any picked file (the size cap in
// validateAttachmentFile gates it). Media kinds still filter by their prefix.
const matched =
  kind === 'file'
    ? Array.from(files)
    : prefix
      ? Array.from(files).filter((f) => f.type.startsWith(prefix))
      : [];
if (matched.length === 0) return;
```

`MIME_PREFIX` is unchanged (no `file` entry).

- [ ] **Step 4: Run to verify it passes + no regression**

Run: `pnpm test src/components/editor/extensions/attachments/ && pnpm test && pnpm build`
Expected: green (new file case + existing image/audio/video pipeline behavior intact).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/attachments/insert.ts src/components/editor/extensions/attachments/insert.test.ts
git commit -m "[EDIT] Match-all insert path for the file attachment kind"
```

---

## Task 3: `FileNodeView` - filename, icon, open link, delete

**Files:**
- Create: `src/components/editor/extensions/File/FileNodeView.tsx`
- Create: `src/components/editor/extensions/File/FileNodeView.test.tsx`
- Modify: `src/components/icons/icons.ts` (add `FileText`, `Download`)
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json`

**Interfaces:**
- Consumes: `useAttachmentObjectUrl` + `AttachmentDeps` + `ConfirmDeleteButton` (`../attachments/`, from Slice 3.5), `icons` (`@/components/icons`).
- Produces: `FileNodeView` (default export) rendered by `ReactNodeViewRenderer` in Task 4.

- [ ] **Step 1: Write the failing RTL test**

Create `src/components/editor/extensions/File/FileNodeView.test.tsx` (mirrors `VideoNodeView.test.tsx`):

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';
import { FileNodeView } from './FileNodeView';

beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

function att(): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'f1',
    noteId: 'n1',
    kind: 'file',
    mime: 'application/pdf',
    blob: new Blob(['x']),
    name: 'report.pdf',
    createdAt: now,
    updatedAt: now,
  };
}
function props(
  get: (i: string) => Promise<Attachment | undefined>,
  opts: { isEditable?: boolean; deleteNode?: () => void } = {}
) {
  return {
    node: { attrs: { attachmentId: 'f1' } },
    editor: { isEditable: opts.isEditable ?? true },
    deleteNode: opts.deleteNode ?? vi.fn(),
    extension: { options: { getDeps: () => ({ getAttachment: get, t: (k: string) => k }) } },
  } as unknown as Parameters<typeof FileNodeView>[0];
}

describe('FileNodeView', () => {
  it('shows the filename and an open link at the resolved object URL', async () => {
    render(<FileNodeView {...props(async () => att())} />);
    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'editor.file.open' });
    await waitFor(() => expect(link).toHaveAttribute('href', expect.stringContaining('blob:mock/')));
  });

  it('shows an unavailable state when the row is missing', async () => {
    render(<FileNodeView {...props(async () => undefined)} />);
    expect(await screen.findByText('editor.file.unavailable')).toBeInTheDocument();
  });

  it('confirms before deleting: clicking trash then Remove calls deleteNode once', async () => {
    const deleteNode = vi.fn();
    render(<FileNodeView {...props(async () => att(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: 'editor.file.delete' }));
    await userEvent.click(await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' }));
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('hides the delete button when the editor is read-only', async () => {
    render(<FileNodeView {...props(async () => att(), { isEditable: false })} />);
    await screen.findByText('report.pdf');
    expect(screen.queryByRole('button', { name: 'editor.file.delete' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/File/FileNodeView.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 3: Add the icons**

In `src/components/icons/icons.ts`, add `Download` and `FileText` to the `lucide-react` import and to the `icons` object (keep alphabetical-ish grouping consistent with the file).

- [ ] **Step 4: Add the i18n keys**

Add to `public/locales/en/translation.json` under `editor`, a new `file` object:

```json
"file": {
  "tooltip": "Attach file",
  "open": "Open file",
  "delete": "Delete file",
  "unavailable": "File unavailable",
  "fallbackName": "File"
}
```

Add the Czech equivalents to `public/locales/cs/translation.json`:

```json
"file": {
  "tooltip": "Připojit soubor",
  "open": "Otevřít soubor",
  "delete": "Smazat soubor",
  "unavailable": "Soubor není k dispozici",
  "fallbackName": "Soubor"
}
```

- [ ] **Step 5: Implement the NodeView**

Create `src/components/editor/extensions/File/FileNodeView.tsx`:

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { icons } from '@/components/icons';
import { ConfirmDeleteButton } from '../attachments/ConfirmDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { useAttachmentObjectUrl } from '../attachments/useAttachmentObjectUrl';

/** Editor render path for fileAttachment. Files are not inline-renderable, so
 *  this shows a generic file icon, the original filename, and an open/download
 *  link (opens the Blob object URL in a new tab; non-viewable types download).
 *  Object-URL lifecycle handled by the shared hook. Delete is guarded by the
 *  shared ConfirmDeleteButton (editor-only, same as audio/video/image). */
export function FileNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.getAttachment);
  const FileIcon = icons.FileText;
  const DownloadIcon = icons.Download;
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <ConfirmDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.file.delete')}
      t={deps.t}
    />
  ) : null;

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.file.unavailable')}</span>
          {deleteButton}
        </div>
      </NodeViewWrapper>
    );
  }

  const name = (state.status === 'ready' && state.name) || deps.t('editor.file.fallbackName');

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-center gap-3 rounded-md border bg-muted/40 px-3 py-2">
        <FileIcon className="size-5 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-sm">{name}</span>
        {state.status === 'ready' && (
          <a
            href={state.url}
            download={state.name ?? ''}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={deps.t('editor.file.open')}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          >
            <DownloadIcon className="size-4" />
          </a>
        )}
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default FileNodeView;
```

- [ ] **Step 6: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/File/FileNodeView.test.tsx && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/extensions/File/FileNodeView.tsx src/components/editor/extensions/File/FileNodeView.test.tsx src/components/icons/icons.ts public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] FileNodeView (filename + icon + open link + delete)"
```

---

## Task 4: `fileAttachment` node + toolbar button

**Files:**
- Create: `src/components/editor/extensions/File/File.ts`, `File/FileButton.tsx`, `File/index.ts`, `File/File.test.ts`

**Interfaces:**
- Consumes: `createAttachmentNode` (`../attachments/createAttachmentNode`), `AttachmentDeps`, `FileNodeView` (Task 3), `insertAttachmentFiles` (Task 2), `ActionButton` (`@/components/ui/ActionButton.tsx`).
- Produces: `createFile(getDeps: () => AttachmentDeps)` -> node `fileAttachment` with command `insertFileAttachment({ attachmentId })`; body tag `a[data-attachment-id]`. `FileButton` toolbar component.

- [ ] **Step 1: Write the failing headless test**

Create `src/components/editor/extensions/File/File.test.ts` (mirrors `Video.test.ts`):

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { createFile } from './File';

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createFile(() => deps)],
    content: '<p></p>',
  });
}

describe('fileAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses a[data-attachment-id] and re-renders with no href', () => {
    editor.commands.setContent('<a data-attachment-id="abc">x</a>');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).not.toContain('href=');
  });

  it('insertFileAttachment inserts a node with the id', () => {
    editor.commands.insertFileAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  it('button factory returns the FileButton component with its props', () => {
    const extension = editor.extensionManager.extensions.find((e) => e.name === 'fileAttachment');
    const button = extension?.options.button({ editor, t: (k: string) => k }) as {
      component: unknown;
      componentProps: { editor: Editor; tooltip: string };
    };
    expect(button.component).toBeDefined();
    expect(button.componentProps.editor).toBe(editor);
    expect(button.componentProps.tooltip).toBe('editor.file.tooltip');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/File/File.test.ts`
Expected: FAIL - `createFile` not found.

- [ ] **Step 3: Implement `FileButton.tsx`**

Create `src/components/editor/extensions/File/FileButton.tsx` (mirrors `VideoButton`, but no `accept`):

```tsx
import type { Editor } from '@tiptap/core';
import { useRef } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { AttachmentDeps } from '../attachments/deps';
import { insertAttachmentFiles } from '../attachments/insert';

export interface FileButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point: opens a hidden multi-file picker with no `accept`
 *  restriction (a file attachment accepts any type; an unrestricted picker also
 *  sidesteps the Chrome-on-Linux greying-out that specific MIME types trigger),
 *  then runs the shared insert pipeline. The 50 MB size cap is enforced in
 *  `validateAttachmentFile` after selection. */
export function FileButton({ editor, getDeps, tooltip }: FileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <ActionButton icon="Paperclip" tooltip={tooltip} action={() => inputRef.current?.click()} />
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          // Resolve deps at click time so the button reads the freshest getNoteId.
          if (e.target.files)
            void insertAttachmentFiles(editor, e.target.files, 'file', getDeps(), (id) =>
              editor.chain().focus().insertFileAttachment({ attachmentId: id }).run()
            );
          e.target.value = ''; // allow re-picking the same file
        }}
      />
    </>
  );
}
```

- [ ] **Step 4: Implement `File.ts` + `index.ts`**

Create `src/components/editor/extensions/File/File.ts` (mirrors `Video.ts`):

```ts
import type { Editor } from '@tiptap/core';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { FileButton } from './FileButton';
import { FileNodeView } from './FileNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fileAttachment: {
      insertFileAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/** Custom generic-file-attachment node built on the shared factory. Body
 *  serializes as <a data-attachment-id> (no href); the NodeView shows the
 *  filename + a generic icon + an open/download link. */
export function createFile(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    name: 'fileAttachment',
    parseTag: 'a[data-attachment-id]',
    renderTag: 'a',
    insertCommandName: 'insertFileAttachment',
    nodeView: FileNodeView,
    button: ({
      editor,
      getDeps,
      t,
    }: {
      editor: Editor;
      getDeps: () => AttachmentDeps;
      t: (k: string) => string;
    }) => ({
      component: FileButton,
      componentProps: { editor, getDeps, tooltip: t('editor.file.tooltip') },
    }),
  });
}
```

Create `src/components/editor/extensions/File/index.ts`:

```ts
export * from './File';
export * from './FileButton';
```

- [ ] **Step 5: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/File/File.test.ts && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/extensions/File/
git commit -m "[ADD] fileAttachment node + toolbar picker button"
```

---

## Task 5: Editor wiring - register the node + toolbar button

**Files:**
- Modify: `src/components/editor/editor.tsx`
- Modify: `src/components/editor/menus/toolbars/BlocksSection.tsx`
- Test: `src/components/editor/menus/toolbars/BlocksSection.test.tsx`

**Interfaces:**
- Consumes: `createFile` (Task 4), `getAttachmentDeps` (existing stable getter in `editor.tsx`).
- Produces: the `fileAttachment` node registered in the editor; `'fileAttachment'` present in `BLOCK_EXTENSION_NAMES` so its button renders.

- [ ] **Step 1: Write the failing test**

In `src/components/editor/menus/toolbars/BlocksSection.test.tsx`, add `'fileAttachment'` to the expected block-extension names (mirror the existing `videoAttachment` regression assertion). For example, extend the assertion that `BLOCK_EXTENSION_NAMES` includes each custom attachment node:

```ts
it('includes the file attachment node so its toolbar button renders', () => {
  expect(BLOCK_EXTENSION_NAMES).toContain('fileAttachment');
});
```

(Import `BLOCK_EXTENSION_NAMES` the same way the existing `videoAttachment` test does; if the constant is not exported yet, export it alongside the component in `BlocksSection.tsx`.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/menus/toolbars/BlocksSection.test.tsx`
Expected: FAIL - `'fileAttachment'` not in `BLOCK_EXTENSION_NAMES`.

- [ ] **Step 3: Add the node name to the section**

In `src/components/editor/menus/toolbars/BlocksSection.tsx`, add `'fileAttachment'` to `BLOCK_EXTENSION_NAMES` (after `'videoAttachment'`) and extend the doc comment to mention `fileAttachment` is the generic file node (M3 Slice 4).

- [ ] **Step 4: Register the node in the editor**

In `src/components/editor/editor.tsx`:
- add `import { createFile } from '@/components/editor/extensions/File';`
- add `createFile(getAttachmentDeps),` to the extensions array, right after `createVideo(getAttachmentDeps),`.

Do **not** add a `handlePaste`/`handleDrop` branch for files this slice (out of scope - see the design spec).

- [ ] **Step 5: Run to verify it passes + full suite + build**

Run: `pnpm test src/components/editor/menus/toolbars/BlocksSection.test.tsx && pnpm test && pnpm build`
Expected: green - the file button now appears in the Blocks toolbar section.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/editor.tsx src/components/editor/menus/toolbars/BlocksSection.tsx src/components/editor/menus/toolbars/BlocksSection.test.tsx
git commit -m "[ADD] Register fileAttachment node + toolbar button"
```

---

## Task 6: Home card - `bodyHasFile`, body strip, card file button

**Files:**
- Modify: `src/lib/attachment-html.ts`
- Test: `src/lib/attachment-html.test.ts`
- Modify: `src/components/NoteBody.tsx`
- Modify: `src/components/cards/NoteCard.tsx`
- Test: `src/components/cards/NoteCard.test.tsx`
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json`

**Interfaces:**
- Consumes: existing `bodyHasAudio`/`bodyHasVideo` patterns, `icons` (`FileText`), `onSelect` from `NoteCardProps`.
- Produces: `bodyHasFile(html)`; a pinned card button gated on `bodyHasFile` that opens the note.

- [ ] **Step 1: Write the failing `bodyHasFile` test**

Add to `src/lib/attachment-html.test.ts`:

```ts
import { bodyHasFile } from './attachment-html';

describe('bodyHasFile', () => {
  it('is true for an <a> carrying a data-attachment-id', () => {
    expect(bodyHasFile('<a data-attachment-id="f1">report.pdf</a>')).toBe(true);
  });
  it('is false for a plain link without the marker', () => {
    expect(bodyHasFile('<a href="https://example.com">link</a>')).toBe(false);
  });
  it('is false for empty/nullish', () => {
    expect(bodyHasFile('')).toBe(false);
    expect(bodyHasFile(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/attachment-html.test.ts`
Expected: FAIL - `bodyHasFile` not exported.

- [ ] **Step 3: Implement `bodyHasFile`**

Add to `src/lib/attachment-html.ts` (after the video block):

```ts
// Matches an <a> tag that carries a data-attachment-id (our file node's
// serialized form), regardless of attribute order. Non-global on purpose: only
// used with `.test()`, so no stateful lastIndex to leak (see note above).
const FILE_ATTACHMENT_RE = /<a\b[^>]*\bdata-attachment-id="[^"]+"/i;

/** True when the Body HTML embeds at least one file attachment node.
 *  Narrower than bodyHasAttachment, which also matches images/audio/video. */
export function bodyHasFile(html: string | null | undefined): boolean {
  if (!html) return false;
  return FILE_ATTACHMENT_RE.test(html);
}
```

- [ ] **Step 4: Strip the file node from the read-only body**

In `src/components/NoteBody.tsx`, in the effect after the `video[data-attachment-id]` removal, add:

```ts
root.querySelectorAll('a[data-attachment-id]').forEach((el) => {
  el.remove();
});
```

Update the nearby comment to include file alongside audio/video (the card renders a dedicated button, so the raw node is removed).

- [ ] **Step 5: Write the failing card test**

Add to `src/components/cards/NoteCard.test.tsx` (mirror the existing audio/video button tests):

```ts
it('shows a file button for a file-only body', () => {
  const note = makeNote({ body: '<a data-attachment-id="f1">report.pdf</a>' });
  render(<NoteCard note={note} onSelect={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument();
});

it('shows audio, video, and file buttons together', () => {
  const note = makeNote({
    body: '<audio data-attachment-id="a1"></audio><video data-attachment-id="v1"></video><a data-attachment-id="f1">x</a>',
  });
  render(<NoteCard note={note} onSelect={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Play audio' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Play video' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument();
});
```

(Use whatever `makeNote`/render helpers the existing `NoteCard.test.tsx` already defines; match the existing tests' i18n setup so `t('notes.openFile')` resolves to `'Open file'`.)

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm test src/components/cards/NoteCard.test.tsx`
Expected: FAIL - no file button; `notes.openFile` missing.

- [ ] **Step 7: Add `notes.openFile` i18n**

Add `"openFile": "Open file"` to the `notes` object in `public/locales/en/translation.json` and `"openFile": "Otevřít soubor"` to `public/locales/cs/translation.json`.

- [ ] **Step 8: Add the file button to the card**

In `src/components/cards/NoteCard.tsx`:
- import `FileText` from `lucide-react` (alongside `Play`, `Video`), and `bodyHasFile` from `@/lib/attachment-html.ts`.
- add `const hasFile = bodyHasFile(note.body);`.
- change the row gate from `{(hasAudio || hasVideo) && (` to `{(hasAudio || hasVideo || hasFile) && (`.
- after the video button block, add a third button in the same `flex gap-2` row:

```tsx
{hasFile && (
  <button
    type="button"
    aria-label={t('notes.openFile')}
    onClick={(e) => {
      e.stopPropagation();
      onSelect(note.id);
    }}
    className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <FileText className="size-5" />
  </button>
)}
```

- [ ] **Step 9: Run to verify it passes + full suite + build**

Run: `pnpm test src/lib/attachment-html.test.ts src/components/cards/NoteCard.test.tsx && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 10: Commit**

```bash
git add src/lib/attachment-html.ts src/lib/attachment-html.test.ts src/components/NoteBody.tsx src/components/cards/NoteCard.tsx src/components/cards/NoteCard.test.tsx public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] Home-card file button + bodyHasFile detection"
```

---

## Self-Review

**Spec coverage:**
- Model (no change) - covered by Global Constraints (kind already exists).
- Validation (size cap, no whitelist) - Task 1.
- Insert pipeline match-all for `file` - Task 2.
- Node (`a[data-attachment-id]`, no href) - Task 4.
- NodeView (filename + icon + open + delete, missing state, editable-guard) - Task 3.
- Toolbar button (no `accept`, Paperclip) - Task 4.
- Icons (`FileText`, `Download`; `Paperclip` reused) - Task 3.
- Editor + BlocksSection wiring - Task 5.
- Home card (`bodyHasFile`, NoteBody strip, card button) - Task 6.
- i18n (`editor.file.*`, `notes.openFile`) - Tasks 3 + 6.

**Type consistency:** `createFile(getDeps)`, `insertFileAttachment({ attachmentId })`, `fileAttachment` node name, `editor.file.*` / `notes.openFile` keys, and `bodyHasFile` are used consistently across tasks.

**Deferred (flagged in the design spec's Assumptions):** document paste/drop; PDF/preview thumbnails; the 50 MB cap value. (Slice 3.5's shared confirm-delete has landed and is consumed directly in Task 3 - no longer deferred.)
