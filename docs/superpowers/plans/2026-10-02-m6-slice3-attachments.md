# M6 slice 3: Attachments - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every fact about an attachment kind lives in one table, every file reaches the editor through one insert path keyed by kind, the three visual node views share one shell, and the Body's HTML vocabulary has one module.

**Architecture:** `ATTACHMENT_SPECS: Record<AttachmentKind, AttachmentSpec>` in `src/lib/attachments.ts` holds the MIME prefix, the whitelist, the cap, the Body tag, the extensions and the picker `accept` per kind; validation, the node factory, the insert path and the Body readers all key on it, so a kind cannot be half-described. `insertFiles(kind, editor, files, deps)` in `attachments/insert.ts` is the one path from files to nodes, with a `DERIVE` table for what a kind computes at insert (an image's thumbnail, a video's poster) and `insertAttachmentNode(editor, kind, id)` in place of twelve restated chains; `insertTransferredFiles` routes a paste or drop file by file, and `pickerButton(kind, icon)` is the toolbar button of every kind that comes from a picker. `AttachmentNodeView` draws the delete overlay, the remote and missing placeholders and the loading pulse once; Image, Video and File supply their ready element. `src/lib/body.ts` absorbs `attachment-html.ts`, `note-attachments.ts` and `checklist.ts`, derives the tag-to-kind map from the spec table, and is the one writer of checklist markup.

**Tech Stack:**
- React 19, TypeScript 6; TipTap 3 (`Node.create`, `ReactNodeViewRenderer`, `ChainedCommands`);
- Vitest with Testing Library (headless TipTap editors; React node views under jsdom); Biome and ESLint (`pnpm lint`, run by the pre-commit hook);
- pnpm, Node 24.

**Spec:** `PLAN.md`, milestone M6, slice 3; style: `docs/adr/0022-interfaces-and-closures-not-classes.md`; evidence: `docs/superpowers/plans/2026-10-02-refactor-survey.md` (sections B and D) and the three evidence files in this slice's `.superpowers/sdd/` workspace (gitignored; a reviewer may ask for them).

## Global Constraints

- pnpm only, never npm or yarn; Node 24.
- Plain dash, never an em dash; in long Markdown one sentence per line.
- Comments are short, plain and high level: why, a decision (link the ADR) or a trap; never narrate the next line (`CLAUDE.md` hard rule). Agents get context from the `.md` files, so no comment briefs an agent.
- ADR 0022: helper functions, tables keyed by kind and closure factories, never classes; no abstraction without a second implementation or three call sites.
- ADR 0007 stands: a Body holds `data-attachment-id`, never a `src`, `href` or payload; bytes are write-once by id.
- The `excalidraw` kind id is persisted data and stays; its human name is the glossary's **Drawing**.
- Files stay under 500 lines.
- Test first: write the failing test, run it to see it fail, then the code, then run it to see it pass. Biome forbids `export` in test files.
- Near-identical tests collapse into one table-driven test rather than a copy per unit; behaviour specific to one unit keeps its own case.
- The toolbar registry (`toolbar/registry.ts`) stays the single id space and is not edited; node names (`imageAttachment` and the rest) and extension names do not change, so `registry.test.ts`, `shortcuts.test.ts` and the Tour tests stay green unchanged.
- `src/contract/index.ts` is vendored and never edited.
- Gates for every task: `pnpm check:ci`, `pnpm lint` (no new warnings; six pre-existing ones are known), `pnpm exec tsc -b --noEmit`, the named vitest runs; the last task adds `pnpm build`, `pnpm test`, `pnpm test:e2e`.
- Never commit, push or switch branches without asking.
  souki makes every commit; a "Commit" step means stop and ask souki to commit, with the suggested message, from a clean index.

## Review Focus

1. A paste or drop that mixes kinds (an image and a video in one transfer) must insert both; today the first matching kind takes the whole list and the rest is dropped (pinned in Task 3's `insertTransferredFiles` cases).
2. A video chosen from the slash menu must keep its poster, size and duration like one chosen from the toolbar; today it loses all three (pinned in Task 3's slash-menu case and the `DERIVE` row for video).
3. A recording the cap rejects must report `too-large`, not a generic failure (pinned in Task 3's recorder case).
4. A row synced from a newer Device with a kind this build does not know must be rejected, not crash validation or the card (pinned in Task 1's unknown-kind case; the Body reader's unknown-tag skip is kept in Task 5).
5. A new checklist draft must still open with one empty item TipTap keeps on round trip, now that the draft is built by the shared markup writer (pinned in Task 5's round-trip case).

---

### Task 1: One table of kind facts in `lib/attachments.ts`

**Files:**
- Modify: `src/lib/attachments.ts` (rewritten)
- Modify: `src/lib/attachments.test.ts` (rewritten as a table)
- Modify: `src/components/editor/extensions/Audio/useAudioRecorder.ts` (export `CANDIDATE_MIME`)
- Modify: `src/components/editor/extensions/Audio/AudioRecorderHost.tsx` (the `EXT` map goes)
- Modify: `src/components/editor/extensions/Excalidraw/scene.ts` (the file name's extension)
- Modify: `src/components/notes/quickCaptureActions.ts` (the two `'image/*'` literals)

**Interfaces:**
- Consumes: `AttachmentKind` and `ATTACHMENT_KINDS` from `src/models.ts`.
- Produces: `AttachmentSpec`, `ATTACHMENT_SPECS`, `baseMimeType(mime)`, `fileMatchesKind(file, kind)`, `fileExtension(kind, mime)`, and the unchanged `validateAttachmentFile(file, kind)`, `AttachmentError`, `AttachmentErrorCode`. Gone: `ALLOWED_IMAGE_MIME`, `MAX_*_BYTES`, `validateImageFile` (their only importers were this file's tests).
- Harmless change: image validation now ignores a `;parameter` on the MIME like the other kinds do (`image/png;x` was rejected, now accepted); nothing produces such a type.

- [ ] **Step 1: Write the failing table-driven test**

Replace the contents of `src/lib/attachments.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { CANDIDATE_MIME } from '@/components/editor/extensions/Audio/useAudioRecorder.ts';
import { ATTACHMENT_KINDS, type AttachmentKind } from '@/models.ts';
import {
  ATTACHMENT_SPECS,
  baseMimeType,
  fileExtension,
  fileMatchesKind,
  validateAttachmentFile,
} from './attachments.ts';

function fileOf(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'f', { type });
}

/** A type each kind accepts, for the cases every kind shares. */
const ACCEPTED: Record<AttachmentKind, string> = {
  image: 'image/png',
  audio: 'audio/webm',
  video: 'video/mp4',
  file: 'application/pdf',
  excalidraw: 'application/json',
};

describe.each(ATTACHMENT_KINDS)('%s', (kind) => {
  const { maxBytes } = ATTACHMENT_SPECS[kind];

  it('accepts a file of exactly the cap and rejects one byte over', () => {
    expect(validateAttachmentFile(fileOf(ACCEPTED[kind], maxBytes), kind)).toBeNull();
    expect(validateAttachmentFile(fileOf(ACCEPTED[kind], maxBytes + 1), kind)).toBe('too-large');
  });

  it('has a lowercase Body tag of its own, which the Body readers rely on', () => {
    const { tag } = ATTACHMENT_SPECS[kind];
    expect(tag).toBe(tag.toLowerCase());
    expect(ATTACHMENT_KINDS.filter((k) => ATTACHMENT_SPECS[k].tag === tag)).toEqual([kind]);
  });
});

describe('whitelists', () => {
  it('image: rejects SVG and documents, which can carry script', () => {
    expect(validateAttachmentFile(fileOf('image/svg+xml'), 'image')).toBe('unsupported-type');
    expect(validateAttachmentFile(fileOf('application/pdf'), 'image')).toBe('unsupported-type');
    expect(validateAttachmentFile(fileOf('image/webp'), 'image')).toBeNull();
  });

  it('audio and video: a codec parameter does not change the answer', () => {
    expect(validateAttachmentFile(fileOf('audio/webm;codecs=opus'), 'audio')).toBeNull();
    expect(validateAttachmentFile(fileOf('audio/flac;codecs=flac'), 'audio')).toBe('unsupported-type');
    expect(validateAttachmentFile(fileOf('video/mp4;codecs=avc1'), 'video')).toBeNull();
    expect(validateAttachmentFile(fileOf('image/png'), 'video')).toBe('unsupported-type');
  });

  it('file: any type under the cap', () => {
    for (const type of ['application/pdf', 'application/zip', 'application/octet-stream']) {
      expect(validateAttachmentFile(fileOf(type), 'file')).toBeNull();
    }
  });

  it('excalidraw: a JSON scene only', () => {
    expect(validateAttachmentFile(fileOf('application/json'), 'excalidraw')).toBeNull();
    expect(validateAttachmentFile(fileOf('image/png'), 'excalidraw')).toBe('unsupported-type');
  });

  it('every MIME the in-app recorder may pick is accepted as audio', () => {
    for (const mime of CANDIDATE_MIME) {
      expect(validateAttachmentFile(fileOf(mime), 'audio'), mime).toBeNull();
    }
  });

  it('rejects a kind this build does not know, such as a row from a newer Device', () => {
    expect(validateAttachmentFile(fileOf('image/png'), 'hologram' as AttachmentKind)).toBe(
      'unsupported-type'
    );
  });
});

describe('fileMatchesKind', () => {
  it('routes a file by its MIME prefix; a document is a file and nothing is a drawing', () => {
    const png = fileOf('image/png');
    expect(fileMatchesKind(png, 'image')).toBe(true);
    expect(fileMatchesKind(png, 'video')).toBe(false);
    expect(fileMatchesKind(png, 'file')).toBe(true);
    expect(fileMatchesKind(fileOf('application/pdf'), 'file')).toBe(true);
    expect(fileMatchesKind(fileOf('application/json'), 'excalidraw')).toBe(false);
  });
});

describe('fileExtension and baseMimeType', () => {
  it('names a recording by its base MIME and a drawing by its scene type', () => {
    expect(fileExtension('audio', 'audio/webm;codecs=opus')).toBe('webm');
    expect(fileExtension('audio', 'audio/mp4')).toBe('m4a');
    expect(fileExtension('audio', 'audio/flac')).toBeUndefined();
    expect(fileExtension('excalidraw', 'application/json')).toBe('excalidraw.json');
    expect(baseMimeType('video/mp4;codecs=avc1')).toBe('video/mp4');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/lib/attachments.test.ts`
Expected: FAIL, `ATTACHMENT_SPECS` and `CANDIDATE_MIME` are not exported.

- [ ] **Step 3: Write the table**

Replace the contents of `src/lib/attachments.ts` with:

```ts
import type { AttachmentKind } from '@/models.ts';

/** What a kind is, in one row: how a picked or dropped file is matched to it, what it accepts,
 *  how big it may be, the Body tag the editor writes for it, and the extensions its files get. */
export interface AttachmentSpec {
  /** `file.type` prefix a transfer or a pick must match. `''` matches every file; `null` means
   *  the kind never arrives as a file (a Drawing is made in the app). */
  prefix: string | null;
  /** Allowed base MIME types (a `;codecs=` parameter is ignored); `null` accepts any type. */
  mimes: readonly string[] | null;
  maxBytes: number;
  /** The tag the editor serialises the kind's node as, carrying `data-attachment-id`. */
  tag: string;
  /** File extension by base MIME, for the files the app names itself. */
  extensions: Readonly<Record<string, string>>;
  /** The picker's `accept`: a wildcard, not the whitelist. Android offers the camera only for
   *  the wildcard, and Chrome on Linux greys out valid files when specific types are listed;
   *  the whitelist is enforced by `validateAttachmentFile` after the pick. */
  accept?: string;
}

const MiB = 1024 * 1024;

export const ATTACHMENT_SPECS: Record<AttachmentKind, AttachmentSpec> = {
  image: {
    prefix: 'image/',
    // SVG is excluded because it can carry script.
    mimes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'],
    maxBytes: 10 * MiB,
    tag: 'img',
    extensions: {},
    accept: 'image/*',
  },
  audio: {
    prefix: 'audio/',
    // Must include every candidate the in-app recorder can pick (pinned in attachments.test.ts).
    mimes: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav'],
    maxBytes: 25 * MiB,
    tag: 'audio',
    extensions: {
      'audio/webm': 'webm',
      'audio/ogg': 'ogg',
      'audio/mp4': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
    },
  },
  video: {
    prefix: 'video/',
    mimes: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
    maxBytes: 100 * MiB,
    tag: 'video',
    extensions: {},
    accept: 'video/*',
  },
  file: {
    prefix: '',
    // Any document, so no whitelist; the cap is the only gate.
    mimes: null,
    maxBytes: 50 * MiB,
    tag: 'a',
    extensions: {},
  },
  excalidraw: {
    prefix: null,
    // The scene is a JSON Blob in the same table; the cap is enforced at creation only.
    mimes: ['application/json'],
    maxBytes: 25 * MiB,
    tag: 'excalidraw-drawing',
    extensions: { 'application/json': 'excalidraw.json' },
  },
};

export type AttachmentErrorCode = 'unsupported-type' | 'too-large' | 'insert-failed';

/** Carries a code so the caller can map a failed attachment to a translated toast. */
export class AttachmentError extends Error {
  code: AttachmentErrorCode;

  constructor(code: AttachmentErrorCode) {
    super(code);
    this.name = 'AttachmentError';
    this.code = code;
  }
}

/** The MIME without its parameters: recorder output may carry `;codecs=opus`. */
export function baseMimeType(mime: string): string {
  return mime.split(';')[0].trim();
}

/** Whether a picked or dropped file belongs to the kind. */
export function fileMatchesKind(file: File, kind: AttachmentKind): boolean {
  const prefix = ATTACHMENT_SPECS[kind].prefix;
  return prefix !== null && file.type.startsWith(prefix);
}

export function validateAttachmentFile(
  file: File,
  kind: AttachmentKind
): AttachmentErrorCode | null {
  const spec = ATTACHMENT_SPECS[kind];
  // A kind this build does not know (a row from a newer Device) has no contract yet.
  if (!spec) return 'unsupported-type';
  if (spec.mimes && !spec.mimes.includes(baseMimeType(file.type))) return 'unsupported-type';
  if (file.size > spec.maxBytes) return 'too-large';
  return null;
}

/** The extension a file of this kind gets when the app names it, such as a recording. */
export function fileExtension(kind: AttachmentKind, mime: string): string | undefined {
  return ATTACHMENT_SPECS[kind].extensions[baseMimeType(mime)];
}
```

In `src/components/editor/extensions/Audio/useAudioRecorder.ts`, change `const CANDIDATE_MIME = [...]` to `export const CANDIDATE_MIME = [...]` (same values).

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run src/lib/attachments.test.ts`
Expected: PASS (18 cases).

- [ ] **Step 5: Move the three facts that lived elsewhere**

`src/components/editor/extensions/Audio/AudioRecorderHost.tsx`: delete the `EXT` constant (the `Record<string, string>` of five audio extensions) and change the line `const ext = EXT[out.mime.split(';')[0]] ?? 'webm';` to `const ext = fileExtension('audio', out.mime) ?? 'webm';`, importing `fileExtension` from `@/lib/attachments.ts`.

`src/components/editor/extensions/Excalidraw/scene.ts`, in `sceneToFile`: replace the literal `'drawing.excalidraw.json'` with `` `drawing.${fileExtension('excalidraw', 'application/json')}` ``, importing `fileExtension` from `@/lib/attachments.ts`. The output string is unchanged (`scene.test.ts` stays green).

`src/components/notes/quickCaptureActions.ts`: in the `picture` and `camera` Starts replace `accept: 'image/*'` with `accept: ATTACHMENT_SPECS.image.accept ?? ''`, importing `ATTACHMENT_SPECS` from `@/lib/attachments.ts`. (`StartPicker.accept` is a `string`; the `?? ''` satisfies it.)

- [ ] **Step 6: Gates**

Run: `pnpm vitest run src/lib src/components/editor/extensions/Audio src/components/editor/extensions/Excalidraw src/components/notes`, then `pnpm exec tsc -b --noEmit`, `pnpm check:ci`, `pnpm lint`.
Expected: all green; tsc reports no importer of the deleted exports (there is none outside the old test).

- [ ] **Step 7: Commit**

Stop and ask souki to commit:

```
refactor(attachments): one table of kind facts in lib/attachments.ts
```

---

### Task 2: The node factory keys on the kind, and one function inserts a node

**Files:**
- Modify: `src/components/editor/extensions/attachments/createAttachmentNode.ts`
- Create: `src/components/editor/extensions/attachments/createAttachmentNode.test.ts`
- Modify: `Image/Image.ts`, `Video/Video.ts`, `File/File.ts`, `Audio/Audio.ts`, `Excalidraw/Excalidraw.ts` (all under `src/components/editor/extensions/`)
- Modify: `Image/Image.test.ts`, `Video/Video.test.ts`, `File/File.test.ts`, `Audio/Audio.test.ts`, `Excalidraw/Excalidraw.test.ts` (the parse and insert-command cases move into the table test)

**Interfaces:**
- Consumes: `ATTACHMENT_SPECS` (Task 1).
- Produces: `AttachmentNodeConfig { kind; nodeView; button }` (the `name`, `parseTag`, `renderTag` and `insertCommandName` fields are derived), `INSERT_COMMAND: Record<AttachmentKind, 'insertImageAttachment' | ...>`, and `insertAttachmentNode(editor, kind, attachmentId): boolean`. Node names stay `${kind}Attachment`; the `declare module '@tiptap/core'` command augmentations stay in each extension file, since typing needs them.

- [ ] **Step 1: Write the failing table-driven test**

Create `src/components/editor/extensions/attachments/createAttachmentNode.test.ts`:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';
import { ATTACHMENT_KINDS, type AttachmentKind } from '@/models.ts';
import { createAudio } from '../Audio/Audio';
import { createExcalidraw } from '../Excalidraw/Excalidraw';
import { createFile } from '../File/File';
import { createImage } from '../Image/Image';
import { createVideo } from '../Video/Video';
import type { AttachmentDeps } from './deps';
import { insertAttachmentNode } from './createAttachmentNode';

// The drawing node view imports the real canvas library, which jsdom cannot run.
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

const FACTORY: Record<AttachmentKind, (getDeps: () => AttachmentDeps) => unknown> = {
  image: createImage,
  audio: createAudio,
  video: createVideo,
  file: createFile,
  excalidraw: createExcalidraw,
};

const deps = { t: (k: string) => k } as unknown as AttachmentDeps;
const editors: Editor[] = [];
afterEach(() => {
  for (const e of editors.splice(0)) e.destroy();
});

function editorWith(kind: AttachmentKind, content = '<p></p>') {
  const extension = FACTORY[kind](() => deps) as never;
  const editor = new Editor({ extensions: [Document, Paragraph, Text, extension], content });
  editors.push(editor);
  return editor;
}

describe.each(ATTACHMENT_KINDS)('%s node', (kind) => {
  const { tag } = ATTACHMENT_SPECS[kind];
  const open = `<${tag} data-attachment-id="x1">`;
  const close = tag === 'img' ? '' : `</${tag}>`;

  it('parses its Body tag and re-renders it with the id and no src, href or payload', () => {
    const editor = editorWith(kind, `${open}${close}`);
    const html = editor.getHTML();
    expect(html).toContain(`<${tag}`);
    expect(html).toContain('data-attachment-id="x1"');
    expect(html).not.toMatch(/\b(src|href)=/);
  });

  it('inserts a node carrying the id, and a second insert keeps the first', () => {
    const editor = editorWith(kind);
    expect(insertAttachmentNode(editor, kind, 'a')).toBe(true);
    expect(insertAttachmentNode(editor, kind, 'b')).toBe(true);
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="a"');
    expect(html).toContain('data-attachment-id="b"');
  });

  it('is named after its kind, which the toolbar registry resolves by', () => {
    const editor = editorWith(kind);
    expect(editor.extensionManager.extensions.some((e) => e.name === `${kind}Attachment`)).toBe(
      true
    );
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/components/editor/extensions/attachments/createAttachmentNode.test.ts`
Expected: FAIL, `insertAttachmentNode` is not exported.

- [ ] **Step 3: Rewrite the factory**

Replace the contents of `src/components/editor/extensions/attachments/createAttachmentNode.ts` with:

```ts
import { type ChainedCommands, type Editor, mergeAttributes, Node } from '@tiptap/core';
import { NodeSelection, TextSelection } from '@tiptap/pm/state';
import { type ReactNodeViewProps, ReactNodeViewRenderer } from '@tiptap/react';
import type { ComponentType } from 'react';
import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';
import type { AttachmentKind } from '@/models.ts';
import type { AnyButtonView, TFunction } from '../button-types';
import type { AttachmentDeps } from './deps';

export interface AttachmentNodeConfig {
  kind: AttachmentKind;
  nodeView: ComponentType<ReactNodeViewProps>;
  button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => AnyButtonView;
}

/** The insert command of each kind, as the extension files declare them for TipTap's typing. */
export const INSERT_COMMAND = {
  image: 'insertImageAttachment',
  audio: 'insertAudioAttachment',
  video: 'insertVideoAttachment',
  file: 'insertFileAttachment',
  excalidraw: 'insertExcalidrawAttachment',
} as const satisfies Record<AttachmentKind, keyof ChainedCommands>;

/** Places a node for a stored row at the selection. */
export function insertAttachmentNode(
  editor: Editor,
  kind: AttachmentKind,
  attachmentId: string
): boolean {
  return editor.chain().focus()[INSERT_COMMAND[kind]]({ attachmentId }).run();
}

/** The node mechanics every attachment kind shares; the per-kind parts come from the kind's spec
 *  and the config. Deps are read through `getDeps`, so the button and node view see live ones. */
export function createAttachmentNode(getDeps: () => AttachmentDeps, config: AttachmentNodeConfig) {
  const { tag } = ATTACHMENT_SPECS[config.kind];
  return Node.create({
    name: `${config.kind}Attachment`,
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
      return [{ tag: `${tag}[data-attachment-id]` }];
    },

    // No src, href or payload is ever emitted (ADR 0007).
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes)];
    },

    addNodeView() {
      return ReactNodeViewRenderer(config.nodeView);
    },

    addCommands() {
      const name = this.name;
      const command =
        (attrs: { attachmentId: string }) =>
        ({ chain }: { chain: () => ChainedCommands }) =>
          chain()
            .insertContent({ type: name, attrs })
            // A block atom keeps a NodeSelection on itself, so the next insert replaced it and
            // only the last of several files survived. Move the cursor past it, adding a
            // paragraph at the document end. Mirrors TipTap's own HorizontalRule.
            .command(({ tr, dispatch }) => {
              if (dispatch) {
                const { $to } = tr.selection;
                const posAfter = $to.end();
                if ($to.nodeAfter) {
                  if ($to.nodeAfter.isTextblock) {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos + 1));
                  } else if ($to.nodeAfter.isBlock) {
                    tr.setSelection(NodeSelection.create(tr.doc, $to.pos));
                  } else {
                    tr.setSelection(TextSelection.create(tr.doc, $to.pos));
                  }
                } else {
                  const node = $to.parent.type.contentMatch.defaultType?.create();
                  if (node) {
                    tr.insert(posAfter, node);
                    tr.setSelection(TextSelection.create(tr.doc, posAfter + 1));
                  }
                }
                tr.scrollIntoView();
              }
              return true;
            })
            .run();
      return { [INSERT_COMMAND[config.kind]]: command };
    },
  });
}
```

- [ ] **Step 4: Shrink the five configs**

In each extension file keep the imports, the `declare module '@tiptap/core'` block and the exported factory; replace the config literal as follows. The redundant `{ editor: Editor; getDeps: ...; t: ... }` parameter annotations go (the contextual type supplies them), and with them the `import type { Editor }` where nothing else uses it.

`src/components/editor/extensions/Image/Image.ts`, the body of `createImage`:

```ts
  return createAttachmentNode(getDeps, {
    kind: 'image',
    nodeView: ImageNodeView,
    button: ({ editor, getDeps, t }) => ({
      component: ImageButton,
      componentProps: { editor, getDeps, tooltip: t('editor.image.tooltip') },
    }),
  });
```

`Video/Video.ts` and `File/File.ts`: the same shape with `kind: 'video'` / `'file'`, `VideoNodeView` / `FileNodeView`, `VideoButton` / `FileButton`, and `editor.video.tooltip` / `editor.file.tooltip`.

`Audio/Audio.ts`, the config passed to `createAttachmentNode` (the `.extend({ addStorage() ... })` after it stays):

```ts
  return createAttachmentNode(getDeps, {
    kind: 'audio',
    nodeView: AudioNodeView,
    button: ({ editor, getDeps, t }) => ({
      component: AudioRecordButton,
      componentProps: { editor, getDeps, tooltip: t('editor.audio.tooltip') },
    }),
  }).extend({
```

`Excalidraw/Excalidraw.ts`:

```ts
  return createAttachmentNode(getDeps, {
    kind: 'excalidraw',
    nodeView: ExcalidrawNodeView,
    button: ({ editor, getDeps, t }) => ({
      component: ExcalidrawButton,
      componentProps: { editor, getDeps, tooltip: t('editor.excalidraw.tooltip') },
    }),
  });
```

- [ ] **Step 5: Run the table test to see it pass, then trim the per-kind tests**

Run: `pnpm vitest run src/components/editor/extensions/attachments/createAttachmentNode.test.ts`
Expected: PASS (15 cases).

The table now owns the parse and insert-command cases, so delete these (titles verbatim) and nothing else:
- `Image/Image.test.ts`: `parses img[data-attachment-id] and re-renders it with no src`, `insertImageAttachment inserts a node carrying the id`, `stacks multiple attachments instead of replacing the previous one`.
- `Video/Video.test.ts`: `parses video[data-attachment-id] and re-renders with no src`, `insertVideoAttachment inserts a node with the id`.
- `File/File.test.ts`: `parses a[data-attachment-id] and re-renders with no href`, `insertFileAttachment inserts a node with the id`.
- `Audio/Audio.test.ts`: `parses audio[data-attachment-id] and re-renders with no src`, `insertAudioAttachment inserts a node with the id`.
- `Excalidraw/Excalidraw.test.ts`: `parses excalidraw-drawing[data-attachment-id] and re-renders with no payload`, and its insert-command case if it has one (name it in the report).
Each file keeps its button-factory case (Audio has none; if a file is left with no case, delete the file and say so in the report). Remove fixtures and imports the deletions orphan; `pnpm check:ci` reports them.

Run: `pnpm vitest run src/components/editor/extensions`, then `pnpm exec tsc -b --noEmit`, `pnpm check:ci`, `pnpm lint`.
Expected: all green; `registry.test.ts` and `slashItems.test.ts` unchanged and green (node names did not change).

- [ ] **Step 6: Commit**

Stop and ask souki to commit:

```
refactor(attachments): the node factory keys on the kind; insertAttachmentNode replaces twelve chains
```

---

### Task 3: One insert path keyed by kind

**Files:**
- Modify: `src/components/editor/extensions/attachments/insert.ts` (rewritten)
- Modify: `src/components/editor/extensions/attachments/insert.test.ts` (rewritten as the table; the Image insert cases move here)
- Modify: `src/components/editor/extensions/attachments/AttachmentFilePickerButton.tsx` (adds `pickerButton`; the props interface is exported)
- Modify: `src/components/editor/extensions/attachments/deps.ts` (`NewAttachmentOptions` replaces `DerivedAttachmentData`)
- Delete: `Image/insert.ts`, `Video/insert.ts`, `Image/ImageButton.tsx`, `Video/VideoButton.tsx`, `File/FileButton.tsx`
- Modify: `Image/Image.ts`, `Video/Video.ts`, `File/File.ts` (`pickerButton`), and their tests' button cases
- Modify: `SlashMenu/slashItems.ts` (a `pickerItem` helper), `SlashMenu/slashItems.test.ts` (one new case)
- Modify: `src/components/editor/editor.tsx` (paste, drop, the picker Start, the drawing Save)
- Modify: `src/components/editor/editor.test.tsx` (the module mock)
- Modify: `Audio/AudioRecorderHost.tsx` (`insertAttachmentNode`, error codes), `Audio/AudioRecorderHost.test.tsx` (one new case)

**Interfaces:**
- Consumes: `ATTACHMENT_SPECS`, `fileMatchesKind`, `validateAttachmentFile`, `AttachmentError` (Task 1); `insertAttachmentNode` (Task 2); `NewAttachmentOptions` from `src/lib/rows.ts`.
- Produces: `insertFiles(kind, editor, files, deps): Promise<void>`, `insertTransferredFiles(editor, files, deps): boolean`, `pickerButton(kind, icon)`. Gone: `insertAttachmentFiles`, `withDerivedAttachmentData`, `DerivedAttachmentData`, `insertImageAttachmentFiles`, `insertVideoAttachmentFiles`, the three button components, `editor.tsx`'s local `insertTransferredAttachments`. `dedupeForeignAttachments` is unchanged.
- Behaviour fixed by construction: a slash-menu video derives its poster, size and duration like a toolbar video; a mixed paste or drop inserts every kind it carries, not only the first; a recording the validator rejects reports its code.
- `createAttachment` is now always called with four arguments (the derived options, `{}` when a kind derives nothing); `newAttachment` reads the same row either way.

- [ ] **Step 1: Write the failing table-driven test**

Replace the contents of `src/components/editor/extensions/attachments/insert.test.ts` with:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentError } from '@/lib/attachments.ts';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import { generateVideoPoster } from '@/lib/video-poster.ts';
import type { Attachment, AttachmentKind } from '@/models.ts';
import { createAudio } from '../Audio/Audio';
import { createFile } from '../File/File';
import { createImage } from '../Image/Image';
import { createVideo } from '../Video/Video';
import type { AttachmentDeps } from './deps';
import { insertFiles, insertTransferredFiles } from './insert';

vi.mock('@/lib/image-thumbnail.ts', () => ({ generateImageThumbnail: vi.fn(async () => ({})) }));
vi.mock('@/lib/video-poster.ts', () => ({ generateVideoPoster: vi.fn(async () => ({})) }));

const t = (k: string) => k;

function stubDeps(): AttachmentDeps {
  return {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment: vi.fn(
      async (noteId: string, file: File, kind: AttachmentKind) =>
        ({
          id: `att-${file.name}`,
          noteId,
          kind,
          mime: file.type,
          blob: file,
          name: file.name,
          createdAt: '',
          updatedAt: '',
        }) as Attachment
    ),
    getAttachment: vi.fn(async () => undefined),
    watchAttachment: vi.fn(),
    downloadAttachment: vi.fn(async () => false),
    cloneAttachment: vi.fn(),
    updateAttachment: vi.fn(),
    openExcalidraw: vi.fn(),
    onError: vi.fn(),
    t,
  };
}

const fileOf = (name: string, type: string) => new File([new Uint8Array(4)], name, { type });

let editor: Editor;
let deps: AttachmentDeps;
beforeEach(() => {
  vi.mocked(generateImageThumbnail).mockResolvedValue({});
  vi.mocked(generateVideoPoster).mockResolvedValue({});
  deps = stubDeps();
  const getDeps = () => deps;
  editor = new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      createImage(getDeps),
      createAudio(getDeps),
      createVideo(getDeps),
      createFile(getDeps),
    ],
    content: '<p></p>',
  });
});
afterEach(() => editor.destroy());

const KINDS: { kind: AttachmentKind; file: File }[] = [
  { kind: 'image', file: fileOf('a.png', 'image/png') },
  { kind: 'audio', file: fileOf('m.webm', 'audio/webm') },
  { kind: 'video', file: fileOf('c.mp4', 'video/mp4') },
  { kind: 'file', file: fileOf('d.pdf', 'application/pdf') },
];

describe.each(KINDS)('insertFiles $kind', ({ kind, file }) => {
  it('stores one row per file of its kind, asks for the note id once, and places a node each', async () => {
    const second = fileOf(`2-${file.name}`, file.type);
    await insertFiles(kind, editor, [file, second], deps);
    expect(deps.getNoteId).toHaveBeenCalledOnce();
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', file, kind, {});
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', second, kind, {});
    const html = editor.getHTML();
    expect(html).toContain(`data-attachment-id="att-${file.name}"`);
    expect(html).toContain(`data-attachment-id="att-2-${file.name}"`);
  });

  it('reports a validation failure by its code and a crash as insert-failed, and carries on', async () => {
    vi.mocked(deps.createAttachment)
      .mockRejectedValueOnce(new AttachmentError('too-large'))
      .mockRejectedValueOnce(new Error('boom'));
    await expect(
      insertFiles(kind, editor, [file, fileOf(`2-${file.name}`, file.type)], deps)
    ).resolves.toBeUndefined();
    expect(deps.onError).toHaveBeenNthCalledWith(1, 'too-large');
    expect(deps.onError).toHaveBeenNthCalledWith(2, 'insert-failed');
    expect(editor.getHTML()).not.toContain('data-attachment-id');
  });
});

describe('insertFiles filtering', () => {
  it('takes only files of the kind, and asks for nothing when none match', async () => {
    await insertFiles('image', editor, [fileOf('n.txt', 'text/plain')], deps);
    expect(deps.getNoteId).not.toHaveBeenCalled();
    await insertFiles('video', editor, [fileOf('a.png', 'image/png'), fileOf('c.mp4', 'video/mp4')], deps);
    expect(deps.createAttachment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(deps.createAttachment).mock.calls[0][2]).toBe('video');
  });

  it('a file takes any type; a drawing never comes from a file', async () => {
    await insertFiles('file', editor, [fileOf('a.png', 'image/png')], deps);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', expect.anything(), 'file', {});
    await insertFiles('excalidraw', editor, [fileOf('s.json', 'application/json')], deps);
    expect(deps.createAttachment).toHaveBeenCalledTimes(1);
  });
});

describe('derived data', () => {
  it('an image stores its thumbnail and size with the row', async () => {
    const thumbnail = new Blob(['small'], { type: 'image/webp' });
    vi.mocked(generateImageThumbnail).mockResolvedValue({ thumbnail, width: 1600, height: 1000 });
    const png = fileOf('large.png', 'image/png');
    await insertFiles('image', editor, [png], deps);
    expect(generateImageThumbnail).toHaveBeenCalledWith(png);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', png, 'image', {
      thumbnail,
      width: 1600,
      height: 1000,
    });
  });

  it('a video stores its poster as the thumbnail, with duration and size, whichever path it came by', async () => {
    const poster = new Blob(['frame'], { type: 'image/webp' });
    vi.mocked(generateVideoPoster).mockResolvedValue({ poster, duration: 12, width: 1280, height: 720 });
    const clip = fileOf('c.mp4', 'video/mp4');
    await insertFiles('video', editor, [clip], deps);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', clip, 'video', {
      thumbnail: poster,
      duration: 12,
      width: 1280,
      height: 720,
    });
  });

  it('leaves out what a deriver could not produce, and validates before deriving', async () => {
    vi.mocked(generateVideoPoster).mockResolvedValue({ duration: 3 });
    await insertFiles('video', editor, [fileOf('c.mp4', 'video/mp4')], deps);
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', expect.anything(), 'video', {
      duration: 3,
    });
    vi.mocked(generateVideoPoster).mockClear();
    await insertFiles('video', editor, [fileOf('x.mkv', 'video/x-matroska')], deps);
    expect(deps.onError).toHaveBeenCalledWith('unsupported-type');
    expect(generateVideoPoster).not.toHaveBeenCalled();
  });
});

describe('insertTransferredFiles', () => {
  function fileList(...files: File[]): FileList {
    return files as unknown as FileList;
  }

  it('routes every file of a mixed transfer to its own kind', async () => {
    const png = fileOf('a.png', 'image/png');
    const clip = fileOf('c.mp4', 'video/mp4');
    expect(insertTransferredFiles(editor, fileList(png, clip), deps)).toBe(true);
    await vi.waitFor(() => expect(deps.createAttachment).toHaveBeenCalledTimes(2));
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', png, 'image', {});
    expect(deps.createAttachment).toHaveBeenCalledWith('note-1', clip, 'video', {});
  });

  it('leaves a transfer with no media to the browser', () => {
    expect(insertTransferredFiles(editor, fileList(fileOf('d.pdf', 'application/pdf')), deps)).toBe(
      false
    );
    expect(deps.getNoteId).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/components/editor/extensions/attachments/insert.test.ts`
Expected: FAIL, `insertFiles` and `insertTransferredFiles` are not exported.

- [ ] **Step 3: Write the insert path**

Replace the contents of `src/components/editor/extensions/attachments/insert.ts` with:

```ts
import type { Editor } from '@tiptap/core';
import { extractAttachmentIds } from '@/lib/attachment-html.ts';
import { AttachmentError, fileMatchesKind, validateAttachmentFile } from '@/lib/attachments.ts';
import { generateImageThumbnail } from '@/lib/image-thumbnail.ts';
import type { NewAttachmentOptions } from '@/lib/rows.ts';
import { generateVideoPoster } from '@/lib/video-poster.ts';
import type { AttachmentKind } from '@/models.ts';
import { insertAttachmentNode } from './createAttachmentNode';
import type { AttachmentDeps } from './deps';

/** What a kind derives from its bytes at insert, so a row never exists without the Preview the
 *  card expects. Best-effort: what cannot be produced is omitted and the file is stored anyway. */
const DERIVE: Partial<Record<AttachmentKind, (file: File) => Promise<NewAttachmentOptions>>> = {
  image: generateImageThumbnail,
  video: async (file) => {
    const { poster, ...metadata } = await generateVideoPoster(file);
    return { thumbnail: poster, ...metadata };
  },
};

/** The kinds a paste or drop is routed to, in the order a mixed transfer is handled. */
const TRANSFER_KINDS: AttachmentKind[] = ['image', 'audio', 'video'];

async function createWithDerivedData(
  deps: AttachmentDeps,
  noteId: string,
  file: File,
  kind: AttachmentKind
) {
  // Validated before the decode, so a rejected file never pays for one it was going to throw away.
  const bad = validateAttachmentFile(file, kind);
  if (bad) throw new AttachmentError(bad);
  const derived = (await DERIVE[kind]?.(file)) ?? {};
  // The options mean "here is extra data", so empty keys are left off.
  const options = Object.fromEntries(
    Object.entries(derived).filter(([, value]) => value !== undefined)
  ) as NewAttachmentOptions;
  return deps.createAttachment(noteId, file, kind, options);
}

/** The one path from files to nodes: files of the kind are validated, derived from, stored and
 *  placed. One `getNoteId()` per batch, so a draft is persisted once for several files. */
export async function insertFiles(
  kind: AttachmentKind,
  editor: Editor,
  files: Iterable<File>,
  deps: AttachmentDeps
): Promise<void> {
  const matched = Array.from(files).filter((file) => fileMatchesKind(file, kind));
  if (matched.length === 0) return;
  const noteId = await deps.getNoteId();
  for (const file of matched) {
    try {
      const att = await createWithDerivedData(deps, noteId, file, kind);
      insertAttachmentNode(editor, kind, att.id);
    } catch (err) {
      if (err instanceof AttachmentError) {
        deps.onError(err.code);
      } else {
        console.error('insertFiles: failed to add attachment', err);
        deps.onError('insert-failed');
      }
    }
  }
}

/** Paste or drop: each file goes to its kind, so a mixed transfer loses nothing. `false` leaves
 *  a transfer no media kind claims to the browser. */
export function insertTransferredFiles(
  editor: Editor,
  files: FileList,
  deps: AttachmentDeps
): boolean {
  const list = Array.from(files);
  const kinds = TRANSFER_KINDS.filter((kind) => list.some((file) => fileMatchesKind(file, kind)));
  for (const kind of kinds) void insertFiles(kind, editor, list, deps);
  return kinds.length > 0;
}

/** Cross-note paste: every node whose row another note owns is repointed at a fresh
 *  clone this note owns. */
export async function dedupeForeignAttachments(
  editor: Editor,
  deps: AttachmentDeps
): Promise<void> {
  const noteId = await deps.getNoteId();
  const ids = extractAttachmentIds(editor.getHTML());
  for (const id of ids) {
    let att = await deps.getAttachment(id);
    if (!att || att.noteId === noteId) continue;
    // A clone takes a new id, and only this Device could ever upload bytes under it.
    if (!att.blob && (await deps.downloadAttachment(id).catch(() => false))) {
      att = (await deps.getAttachment(id)) ?? att;
    }
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

In `src/components/editor/extensions/attachments/deps.ts`: replace `import type { DerivedAttachmentData } from './insert';` with `import type { NewAttachmentOptions } from '@/lib/rows.ts';` and the `createAttachment` member's fourth parameter type `options?: DerivedAttachmentData` with `options?: NewAttachmentOptions`. (This also ends the type-only import cycle between the two files.)

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run src/components/editor/extensions/attachments/insert.test.ts`
Expected: PASS (15 cases).

- [ ] **Step 5: The picker button, once**

In `src/components/editor/extensions/attachments/AttachmentFilePickerButton.tsx`, export the props interface (`export interface AttachmentFilePickerButtonProps`) and append:

```tsx
/** The toolbar button of a kind whose files come from a picker. */
export function pickerButton(
  kind: AttachmentKind,
  icon: AttachmentFilePickerButtonProps['icon']
): AttachmentNodeConfig['button'] {
  return ({ editor, getDeps, t }): ButtonView<typeof AttachmentFilePickerButton> => ({
    component: AttachmentFilePickerButton,
    componentProps: {
      icon,
      tooltip: t(`editor.${kind}.tooltip`),
      accept: ATTACHMENT_SPECS[kind].accept,
      // Deps are read after the pick, so the button sees the freshest getNoteId.
      onFiles: (files) => void insertFiles(kind, editor, files, getDeps()),
    },
  });
}
```

with these imports added: `import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';`, `import type { AttachmentKind } from '@/models.ts';`, `import type { ButtonView } from '../button-types';`, `import type { AttachmentNodeConfig } from './createAttachmentNode';`, `import { insertFiles } from './insert';`. The concrete `ButtonView<typeof AttachmentFilePickerButton>` return is what makes a misspelt icon or a missing prop a compile error (verified before planning; a generic config widens the icon to `string`).

Then:

- `git rm -q` `src/components/editor/extensions/Image/insert.ts`, `Video/insert.ts`, `Image/ImageButton.tsx`, `Video/VideoButton.tsx`, `File/FileButton.tsx`.
- `Image/Image.ts`: the config becomes `{ kind: 'image', nodeView: ImageNodeView, button: pickerButton('image', 'ImagePlus') }`; import `pickerButton` from `'../attachments/AttachmentFilePickerButton'` and drop the `ImageButton` import. Keep the doc comment on `createImage`.
- `Video/Video.ts`: `{ kind: 'video', nodeView: VideoNodeView, button: pickerButton('video', 'FileVideo') }`.
- `File/File.ts`: `{ kind: 'file', nodeView: FileNodeView, button: pickerButton('file', 'Paperclip') }`.
- The button cases in `Image/Image.test.ts`, `Video/Video.test.ts`, `File/File.test.ts` assert the new shape. Each keeps its title and asserts, with `view` the factory's result: `expect(view.component).toBe(AttachmentFilePickerButton)`, `expect(view.componentProps.icon).toBe('ImagePlus' | 'FileVideo' | 'Paperclip')`, `expect(view.componentProps.accept).toBe('image/*' | 'video/*' | undefined)`, `expect(view.componentProps.tooltip).toBe('editor.<kind>.tooltip')`; type the options cast as `{ button: (c: { editor: Editor; t: AttachmentDeps['t'] }) => ButtonView<typeof AttachmentFilePickerButton> }`. `Image/Image.test.ts` loses its `insertImageAttachmentFiles` describe (moved to the table in Step 1), its `generateImageThumbnail` mock and the `stubDeps` members nothing uses afterwards.

- [ ] **Step 6: The slash menu, paste and drop, the picker Start, the drawing Save**

`src/components/editor/extensions/SlashMenu/slashItems.ts`: replace the imports of `insertAttachmentFiles` and `insertImageAttachmentFiles` with `import { insertFiles } from '../attachments/insert';`, `import { ATTACHMENT_SPECS } from '@/lib/attachments.ts';` and `import type { AttachmentKind } from '@/models.ts';`. Below `consume`, add:

```ts
/** A slash item that picks files for a kind: the same path as the kind's toolbar button. */
function pickerItem(kind: AttachmentKind, keywords: string[]): SlashItem {
  return {
    key: kind,
    keywords,
    run: ({ editor, range, deps }) => {
      consume(editor, range).run();
      pickFiles(ATTACHMENT_SPECS[kind].accept ?? '', (files) => {
        void insertFiles(kind, editor, files, deps);
      });
    },
  };
}
```

and in `SLASH_ITEMS` replace the three literal items whose keys are `image`, `video` and `file` with `pickerItem('image', ['picture', 'photo', 'img'])`, `pickerItem('video', ['movie', 'clip'])` and `pickerItem('file', ['attachment', 'document', 'upload'])`, each at its current position. The `audio` and `drawing` items are untouched.

Add to `slashItems.test.ts`, inside `describe('slash item commands')`, after the `drawing` case:

```ts
  // The slash video used to skip the derived data the toolbar video stored (no poster, no
  // size, no duration). One path now, pinned here through the picker it opens.
  it('sends picked video files down the one insert path, with the kind spec accept', () => {
    const inputs: HTMLInputElement[] = [];
    const create = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = create(tag);
      if (tag === 'input') inputs.push(el as HTMLInputElement);
      return el;
    });
    runWithTypedQuery('video', '/vid');
    const input = inputs[0];
    expect(input.accept).toBe('video/*');
    const clip = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
    Object.defineProperty(input, 'files', { value: [clip] });
    input.dispatchEvent(new Event('change'));
    expect(insertFiles).toHaveBeenCalledWith('video', editor, [clip], deps);
  });
```

with, at module top after the imports, `import { insertFiles } from '../attachments/insert';` and

```ts
vi.mock('../attachments/insert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../attachments/insert')>()),
  insertFiles: vi.fn(),
}));
```

and `afterEach(() => vi.restoreAllMocks())` beside the existing `afterEach(() => editor.destroy())` in that describe (or inside it). If `createElement`'s overloads reject the mock implementation's type, cast the implementation `as never`.

`src/components/editor/editor.tsx`:
- Imports: drop `insertAttachmentFiles`, `insertImageAttachmentFiles` (from `./extensions/Image/insert`) and `insertVideoAttachmentFiles` (from `./extensions/Video/insert`); import `insertFiles`, `insertTransferredFiles` from `./extensions/attachments/insert` beside `dedupeForeignAttachments`, and `insertAttachmentNode` from `./extensions/attachments/createAttachmentNode`.
- Delete the module-level function `insertTransferredAttachments` (the three `startsWith` branches).
- In `editorProps`, `handlePaste` and `handleDrop`: `insertTransferredAttachments(ed, files, getAttachmentDeps())` becomes `insertTransferredFiles(ed, files, getAttachmentDeps())`.
- In the intent effect: the `insertImageAttachmentFiles(editor, initialFiles, getAttachmentDeps(), (id) => ...)` call becomes `void insertFiles('image', editor, initialFiles, getAttachmentDeps());`.
- In `handleExcalidrawSave`: `editorRef.current?.chain().focus().insertExcalidrawAttachment({ attachmentId: id }).run();` becomes two lines: `const ed = editorRef.current;` and `if (ed) insertAttachmentNode(ed, 'excalidraw', id);`.

`src/components/editor/editor.test.tsx`: replace the import of `insertImageAttachmentFiles` from `./extensions/Image/insert` with `import { insertFiles } from './extensions/attachments/insert';`; replace the `vi.mock('./extensions/Image/insert', ...)` with

```ts
vi.mock('./extensions/attachments/insert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./extensions/attachments/insert')>()),
  insertFiles: vi.fn(async () => {}),
}));
```

and in the case `inserts the files a picker Start chose, once, when the editor is ready`, replace the three `insertImageAttachmentFiles` references: `expect(insertFiles).toHaveBeenCalledTimes(1)`, `expect(vi.mocked(insertFiles).mock.calls[0][0]).toBe('image')`, `expect(vi.mocked(insertFiles).mock.calls[0][2]).toBe(files)`, and the final `toHaveBeenCalledTimes(1)`.

- [ ] **Step 7: The recorder reports its code**

In `src/components/editor/extensions/Audio/AudioRecorderHost.tsx`, in `onStop`: replace `editor.chain().focus().insertAudioAttachment({ attachmentId: att.id }).run();` with `insertAttachmentNode(editor, 'audio', att.id);` (import from `'../attachments/createAttachmentNode'`), and replace the `catch {` block with:

```ts
    } catch (err) {
      d.onError(err instanceof AttachmentError ? err.code : 'insert-failed');
    }
```

importing `AttachmentError` beside `fileExtension` from `@/lib/attachments.ts`.

Add to `AudioRecorderHost.test.tsx`, as the last case:

```tsx
  it('reports a take the validator rejects by its code, not as a generic failure', async () => {
    const { editor } = makeEditor();
    recorder.status = 'recording';
    vi.mocked(recorder.stop).mockResolvedValueOnce({
      blob: new Blob(['x']),
      mime: 'audio/webm',
      durationMs: 1000,
    });
    const deps = getDeps() as { createAttachment: Mock; onError: Mock };
    deps.createAttachment.mockRejectedValueOnce(new AttachmentError('too-large'));
    render(<AudioRecorderHost editor={editor} getDeps={() => deps as never} />);

    await userEvent.click(screen.getByRole('button', { name: 'editor.audio.stop' }));

    expect(deps.onError).toHaveBeenCalledWith('too-large');
  });
```

with `import { AttachmentError } from '@/lib/attachments.ts';` and `type Mock` added to the vitest import. If `recorder.stop`'s declared return type rejects the literal, cast the value `as never`.

- [ ] **Step 8: Gates**

Run: `pnpm vitest run src/components/editor`, then `grep -rn "insertAttachmentFiles\|insertImageAttachmentFiles\|insertVideoAttachmentFiles\|insertTransferredAttachments\|DerivedAttachmentData\|ImageButton\|VideoButton\|FileButton" src e2e --include='*.ts' --include='*.tsx'` (expected: no output), then `pnpm exec tsc -b --noEmit`, `pnpm check:ci`, `pnpm lint`.
Expected: all green.

- [ ] **Step 9: Commit**

Stop and ask souki to commit:

```
refactor(attachments): one insert path keyed by kind; a slash video keeps its poster
```

---

### Task 4: One shell for the Image, Video and File node views

**Files:**
- Create: `src/components/editor/extensions/attachments/AttachmentNodeView.tsx`
- Create: `src/components/editor/extensions/attachments/AttachmentNodeView.test.tsx`
- Modify: `src/components/editor/extensions/Image/ImageNodeView.tsx`, `Video/VideoNodeView.tsx`, `File/FileNodeView.tsx` (rewritten on the shell)
- Modify: `Image/ImageNodeView.test.tsx`, `Video/VideoNodeView.test.tsx`, `File/FileNodeView.test.tsx` (the cases every kind shares move into the shell's table test; each keeps only what is its own)

**Interfaces:**
- Consumes: `useAttachmentObjectUrl` and its `AttachmentUrlState`, `AttachmentDeleteButton`, `AttachmentNotDownloaded`, `AttachmentUnavailable`, `AttachmentDeps` (all unchanged).
- Produces: `AttachmentNodeView({ props, copy, className, placeholderClassName?, children })` and the types `AttachmentNodeCopy`, `ReadyAttachment`. Audio and Excalidraw are not moved: Audio's inline (non-overlay) delete button and its own missing placeholder, and Excalidraw's preview surface, are pinned by their tests and have different semantics.
- Behaviour change, by design (the plan's "loading placeholder only Image has"): Video and File now draw a pulse while the row loads; File's loading row with the fallback name goes. Harmless change: a ready `<video>` uses `rounded-md` like its remote thumbnail and like `<img>`, instead of `rounded`, so its corners no longer change radius when the bytes land.

- [ ] **Step 1: Write the failing table-driven test**

Create `src/components/editor/extensions/attachments/AttachmentNodeView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNodeViewProps } from '@tiptap/react';
import type { ComponentType } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment, AttachmentKind } from '@/models.ts';
import { liveRow } from '@/test/liveRow.ts';
import { FileNodeView } from '../File/FileNodeView';
import { ImageNodeView } from '../Image/ImageNodeView';
import { VideoNodeView } from '../Video/VideoNodeView';

// jsdom lacks object-URL APIs.
beforeEach(() => {
  let n = 0;
  globalThis.URL.createObjectURL = vi.fn(() => `blob:mock/${n++}`);
  globalThis.URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

const KINDS: {
  kind: AttachmentKind;
  View: ComponentType<ReactNodeViewProps>;
  mime: string;
  name: string;
  ready: string;
}[] = [
  { kind: 'image', View: ImageNodeView, mime: 'image/png', name: 'p.png', ready: 'img' },
  { kind: 'video', View: VideoNodeView, mime: 'video/mp4', name: 'clip.mp4', ready: 'video' },
  { kind: 'file', View: FileNodeView, mime: 'application/pdf', name: 'report.pdf', ready: 'a[href]' },
];

function row(kind: AttachmentKind, mime: string, name: string, blob?: Blob): Attachment {
  const now = new Date().toISOString();
  return { id: 'a1', noteId: 'n1', kind, mime, blob, name, createdAt: now, updatedAt: now };
}

function props(
  get: (id: string) => Promise<Attachment | undefined>,
  opts: { isEditable?: boolean; deleteNode?: () => void } = {}
) {
  const watchAttachment = liveRow(get);
  return {
    node: { attrs: { attachmentId: 'a1' } },
    editor: { isEditable: opts.isEditable ?? true },
    deleteNode: opts.deleteNode ?? vi.fn(),
    extension: {
      options: { getDeps: () => ({ watchAttachment, t: (k: string) => k }) },
    },
  } as unknown as ReactNodeViewProps;
}

describe.each(KINDS)('$kind node view through the shell', ({ kind, View, mime, name, ready }) => {
  const bytes = () => row(kind, mime, name, new Blob(['x'], { type: mime }));

  it('pulses while the row loads, then draws the ready element inside the same wrapper', async () => {
    let land!: (a: Attachment) => void;
    const pending = new Promise<Attachment>((resolve) => {
      land = resolve;
    });
    const { container } = render(<View {...props(() => pending)} />);
    const wrapper = container.firstElementChild;
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
    expect(container.querySelector(ready)).toBeNull();

    land(bytes());
    await waitFor(() => expect(container.querySelector(ready)).not.toBeNull());
    expect(container.querySelector('.animate-pulse')).toBeNull();
    // Same element across the swap: a delete tap during loading must not be lost to a remount.
    expect(container.firstElementChild).toBe(wrapper);
  });

  it('holds the place of a missing row and still lets it be removed', async () => {
    const deleteNode = vi.fn();
    render(<View {...props(async () => undefined, { deleteNode })} />);
    expect(await screen.findByText(`editor.${kind}.unavailable`)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: `editor.${kind}.delete` }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('offers a download for a row synced without its bytes', async () => {
    render(<View {...props(async () => row(kind, mime, name))} />);
    expect(
      await screen.findByRole('button', { name: 'editor.attachment.download' })
    ).toBeInTheDocument();
    expect(screen.queryByText(`editor.${kind}.unavailable`)).not.toBeInTheDocument();
  });

  it('confirms before deleting: a cancel keeps the node, a confirm removes it once', async () => {
    const deleteNode = vi.fn();
    render(<View {...props(async () => bytes(), { deleteNode })} />);
    await userEvent.click(await screen.findByRole('button', { name: `editor.${kind}.delete` }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.cancel' })
    );
    expect(deleteNode).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: `editor.${kind}.delete` }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(deleteNode).toHaveBeenCalledTimes(1);
  });

  it('hides the delete button when the editor is read-only', async () => {
    const { container } = render(<View {...props(async () => bytes(), { isEditable: false })} />);
    await waitFor(() => expect(container.querySelector(ready)).not.toBeNull());
    expect(screen.queryByRole('button', { name: `editor.${kind}.delete` })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/components/editor/extensions/attachments/AttachmentNodeView.test.tsx`
Expected: the "pulses while the row loads" case fails for Video (no pulse, zero-height wrapper) and File (the fallback-name row, not a pulse); Image's passes. The other cases pass today, which is the point: they are the twelve lines each view repeats.

- [ ] **Step 3: Write the shell**

Create `src/components/editor/extensions/attachments/AttachmentNodeView.tsx`:

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';
import { AttachmentDeleteButton } from './AttachmentDeleteButton';
import { AttachmentNotDownloaded } from './AttachmentNotDownloaded';
import { AttachmentUnavailable } from './AttachmentUnavailable';
import type { AttachmentDeps } from './deps';
import { type AttachmentUrlState, useAttachmentObjectUrl } from './useAttachmentObjectUrl';

export type ReadyAttachment = Extract<AttachmentUrlState, { status: 'ready' }>;

/** The three i18n keys a kind supplies: its delete label, its missing label, and the name
 *  shown for a row that has none. */
export interface AttachmentNodeCopy {
  delete: string;
  unavailable: string;
  fallbackName: string;
}

interface AttachmentNodeViewProps {
  props: ReactNodeViewProps;
  copy: AttachmentNodeCopy;
  /** Wrapper classes for the ready and loading states; the remote and missing placeholders
   *  bring their own. */
  className: string;
  /** Sizes the loading pulse to the element that replaces it, so nothing jumps. */
  placeholderClassName?: string;
  children: (state: ReadyAttachment, deps: AttachmentDeps) => ReactNode;
}

/** What every media node draws besides its ready element: the delete overlay, the known-but-
 *  not-downloaded and missing placeholders, and a pulse while the row loads. The wrapper is
 *  the same element from loading to ready, so a delete tap during loading is not lost. */
export function AttachmentNodeView({
  props,
  copy,
  className,
  placeholderClassName = 'h-32',
  children,
}: AttachmentNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useAttachmentObjectUrl(attachmentId, deps.watchAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const deleteButton = canDelete ? (
    <AttachmentDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t(copy.delete)}
      t={deps.t}
      overlay
    />
  ) : null;

  if (state.status === 'remote') {
    return (
      <AttachmentNotDownloaded
        attachment={state.attachment}
        thumbnailUrl={state.thumbnailUrl}
        deps={deps}
        fallbackName={deps.t(copy.fallbackName)}
        deleteButton={deleteButton}
      />
    );
  }

  if (state.status === 'missing') {
    return <AttachmentUnavailable label={deps.t(copy.unavailable)} deleteButton={deleteButton} />;
  }

  return (
    <NodeViewWrapper as="div" className={className} data-drag-handle>
      {state.status === 'ready' ? (
        children(state, deps)
      ) : (
        <div
          className={cn('w-full animate-pulse rounded-md bg-muted', placeholderClassName)}
          aria-hidden
        />
      )}
      {deleteButton}
    </NodeViewWrapper>
  );
}
```

- [ ] **Step 4: Rewrite the three views on it**

Replace the contents of `src/components/editor/extensions/Image/ImageNodeView.tsx` with:

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { AttachmentNodeView } from '../attachments/AttachmentNodeView';

const COPY = {
  delete: 'editor.image.delete',
  unavailable: 'editor.image.unavailable',
  fallbackName: 'editor.image.fallbackAlt',
};

export function ImageNodeView(props: ReactNodeViewProps) {
  return (
    <AttachmentNodeView
      props={props}
      copy={COPY}
      className="not-prose relative my-2 inline-block max-w-full"
    >
      {(state, deps) => (
        <img
          src={state.url}
          alt={state.name ?? deps.t('editor.image.fallbackAlt')}
          width={state.attachment.width}
          height={state.attachment.height}
          className="block h-auto max-w-full rounded-md"
        />
      )}
    </AttachmentNodeView>
  );
}

export default ImageNodeView;
```

Replace the contents of `src/components/editor/extensions/Video/VideoNodeView.tsx` with:

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { AttachmentNodeView } from '../attachments/AttachmentNodeView';

const COPY = {
  delete: 'editor.video.delete',
  unavailable: 'editor.video.unavailable',
  fallbackName: 'editor.video.label',
};

/** Native controls, unlike audio: they give scrubbing, fullscreen and volume for free. */
export function VideoNodeView(props: ReactNodeViewProps) {
  return (
    <AttachmentNodeView
      props={props}
      copy={COPY}
      className="not-prose relative my-2 inline-block max-w-full"
    >
      {(state) => (
        <video
          src={state.url}
          width={state.attachment.width}
          height={state.attachment.height}
          controls
          playsInline
          preload="metadata"
          className="block h-auto max-w-full rounded-md"
        >
          <track kind="captions" />
        </video>
      )}
    </AttachmentNodeView>
  );
}

export default VideoNodeView;
```

Replace the contents of `src/components/editor/extensions/File/FileNodeView.tsx` with:

```tsx
import type { ReactNodeViewProps } from '@tiptap/react';
import { icons } from '@/components/icons';
import { AttachmentNodeView } from '../attachments/AttachmentNodeView';

const COPY = {
  delete: 'editor.file.delete',
  unavailable: 'editor.file.unavailable',
  fallbackName: 'editor.file.fallbackName',
};

/** A file is not inline-renderable, so it gets an icon, its name and an open/download link. */
export function FileNodeView(props: ReactNodeViewProps) {
  const FileIcon = icons.FileText;
  const DownloadIcon = icons.Download;
  return (
    <AttachmentNodeView props={props} copy={COPY} className="relative my-2" placeholderClassName="h-10">
      {(state, deps) => (
        <div className="flex items-center gap-3 rounded-md border bg-muted/40 py-2 pr-12 pl-3">
          <FileIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="flex-1 truncate text-sm">
            {state.name || deps.t('editor.file.fallbackName')}
          </span>
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
        </div>
      )}
    </AttachmentNodeView>
  );
}

export default FileNodeView;
```

- [ ] **Step 5: Run the shell test to see it pass, then trim the per-kind tests**

Run: `pnpm vitest run src/components/editor/extensions/attachments/AttachmentNodeView.test.tsx`
Expected: 15 passed (five cases x three kinds).

The shell test now owns the shared cases, so delete these from the kind files (titles verbatim) and nothing else:
- `Image/ImageNodeView.test.tsx`: `shows a broken state when the row is missing`, `shows a confirm-guarded delete button when editable`, `does not delete when the confirm dialog is cancelled`, `renders no delete button when the editor is not editable`. Keep the four that are Image's own (the `<img>` src, the filename as accessible name, the revoke on unmount, the thumbnail at full size). Remove `editableProps` and the `userEvent` import if nothing uses them afterwards.
- `Video/VideoNodeView.test.tsx`: `shows an unavailable state when the row is missing`, `confirms before deleting: clicking trash then Remove calls deleteNode once`, `does not delete when the confirm dialog is cancelled`, `removes the node from the unavailable state too`, `hides the delete button when the editor is read-only`. Keep `resolves the blob into the video element src`. Drop the `opts` parameter of `props` and the `userEvent` and `screen` imports if unused.
- `File/FileNodeView.test.tsx`: `shows an unavailable state when the row is missing`, `confirms before deleting: clicking trash then Remove calls deleteNode once`, `hides the delete button when the editor is read-only`. Keep the open-link case and the synced-without-bytes case.

Run: `pnpm vitest run src/components/editor/extensions`, then `pnpm exec tsc -b --noEmit`, `pnpm check:ci`, `pnpm lint`.
Expected: all green.

- [ ] **Step 6: Commit**

Stop and ask souki to commit:

```
refactor(attachments): one shell draws the three states of a media node
```

---

### Task 5: `lib/body.ts`, the one module for the Body's HTML vocabulary

**Files:**
- Create: `src/lib/body.ts`, `src/lib/body.test.ts`
- Delete: `src/lib/attachment-html.ts`, `src/lib/attachment-html.test.ts`, `src/lib/note-attachments.ts`, `src/lib/note-attachments.test.ts`, `src/lib/checklist.ts`, `src/lib/checklist.test.ts`
- Modify: `src/lib/flip-rows.ts` (imports `TASK_LIST`), `src/lib/tour/props.ts` (uses `taskListMarkup`), `src/components/notes/noteDrafts.ts` (built by `taskListMarkup`), `src/components/notes/QuickCaptureBar.test.tsx` (imports the constant instead of repeating its literal)
- Modify: importers of the deleted modules: `src/components/notes/NoteEditorDialog.tsx`, `src/sync/conflictedCopy.ts`, `src/hooks/data/useAttachmentActions.ts`, `src/components/editor/extensions/attachments/insert.ts`, `src/components/cards/CardMedia.tsx`, `src/components/cards/NoteCard.tsx`
- Modify: `src/components/editor/editor.tsx` (the clipboard substring check), `src/components/share/sharedBody.ts` and `src/components/editor/extensions/attachments/createAttachmentNode.ts` (the attribute name constant)

**Interfaces:**
- Consumes: `ATTACHMENT_SPECS` (Task 1; the tag-to-kind map is derived from it).
- Produces: `ATTACHMENT_ID_ATTR`, `TASK_LIST`, `TASK_ITEM`; `bodyHasAttachment`, `extractAttachmentIds`, `extractBodyAttachments`, `BodyAttachment`, `stripAttachmentNodes` (unchanged signatures), `repointAttachment(html, from, to)`; `taskListMarkup(items)`, `closestChecklistItem(target)`, `isChecklistItemChecked(item)`, `checklistBox(item)`, `setChecklistItemChecked`, `checklistItemIndexAt` (unchanged signatures).
- Behaviour: `EMPTY_CHECKLIST_BODY` now carries TipTap's full item shape (`label`, `input`, `span`, `div`), which TipTap parses to the same document; the clipboard check in `editor.tsx` now requires the quoted attribute form every reader requires.

- [ ] **Step 1: Write the failing test**

Create `src/lib/body.test.ts` by merging the three deleted test files' cases, unchanged apart from the import, plus the new cases below. Keep every case title from `attachment-html.test.ts` (fix the one stale title: `does not leak lastIndex state across repeated calls (shared g-flag regex)` becomes `does not leak lastIndex state across repeated calls`), `note-attachments.test.ts` and `checklist.test.ts`, grouped under `describe('attachments in the Body')`, `describe('stripAttachmentNodes')`, `describe('checklist')` as they were. Then add:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { ATTACHMENT_SPECS } from './attachments.ts';
import { ATTACHMENT_KINDS } from '@/models.ts';
// (the body.ts imports the cases need)

describe('the vocabulary follows the kind table', () => {
  it('reads every tag the editor writes back to its kind', () => {
    const html = ATTACHMENT_KINDS.map((kind) => {
      const { tag } = ATTACHMENT_SPECS[kind];
      return tag === 'img' ? `<img data-attachment-id="${kind}">` : `<${tag} data-attachment-id="${kind}"></${tag}>`;
    }).join('');
    expect(extractBodyAttachments(html)).toEqual(ATTACHMENT_KINDS.map((kind) => ({ id: kind, kind })));
    expect(stripAttachmentNodes(html)).toBe('');
  });
});

describe('repointAttachment', () => {
  it('moves every reference from one id to another and leaves the rest alone', () => {
    const html = '<p>x</p><img data-attachment-id="a"><video data-attachment-id="a"></video><img data-attachment-id="b">';
    expect(repointAttachment(html, 'a', 'c')).toBe(
      '<p>x</p><img data-attachment-id="c"><video data-attachment-id="c"></video><img data-attachment-id="b">'
    );
  });
});

describe('taskListMarkup', () => {
  it('writes what TipTap writes, so a draft round-trips unchanged and opens with its items', () => {
    const html = taskListMarkup([
      ['Milk', true],
      ['', false],
    ]);
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, TaskList, TaskItem],
      content: html,
    });
    expect(editor.getHTML()).toBe(html);
    expect(editor.state.doc.content.firstChild?.childCount).toBe(2);
    editor.destroy();
  });

  it('is what the card helpers read', () => {
    const doc = new DOMParser().parseFromString(taskListMarkup([['Eggs', false]]), 'text/html');
    const item = doc.querySelector(TASK_ITEM);
    expect(item).not.toBeNull();
    expect(closestChecklistItem(item?.querySelector('p') as Element)).toBe(item);
    expect(isChecklistItemChecked(item as Element)).toBe(false);
    expect(checklistBox(item as Element)?.checked).toBe(false);
  });
});
```

If `@tiptap/extension-list` exports `TaskItem` and `TaskList` under other names in this repo's version, use what `src/lib/tour/props.test.ts` imports.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/lib/body.test.ts`
Expected: FAIL, `./body.ts` does not exist.

- [ ] **Step 3: Write the module**

Create `src/lib/body.ts`:

```ts
import type { AttachmentKind } from '@/models.ts';
import { ATTACHMENT_SPECS } from './attachments.ts';

/** The attribute every attachment node carries: the Body holds the id, never the bytes (ADR 0007). */
export const ATTACHMENT_ID_ATTR = 'data-attachment-id';
export const TASK_LIST = 'ul[data-type="taskList"]';
export const TASK_ITEM = 'li[data-type="taskItem"]';
const TASK_BOX = 'input[type="checkbox"]';

// A regex is enough: the Body is our own editor's HTML and only attribute values are read.
// One regex per use: `.test()` mutates a `g` regex's `lastIndex`, so sharing one with
// `matchAll()` would silently drop matches depending on call order.
const ATTACHMENT_ID_TEST_RE = new RegExp(`${ATTACHMENT_ID_ATTR}="[^"]+"`);
const ATTACHMENT_ID_MATCH_ALL_RE = new RegExp(`${ATTACHMENT_ID_ATTR}="([^"]+)"`, 'g');

/** The tags the editor emits, read back to the stored kind, from the same table the editor writes by. */
const KIND_BY_TAG = new Map(
  (Object.keys(ATTACHMENT_SPECS) as AttachmentKind[]).map((kind) => [ATTACHMENT_SPECS[kind].tag, kind])
);
const TAGS = [...KIND_BY_TAG.keys()];
const ATTACHMENT_NODE_RE = new RegExp(
  `<(${TAGS.join('|')})\\b[^>]*\\b${ATTACHMENT_ID_ATTR}="([^"]+)"`,
  'gi'
);
// Void and paired forms strip differently: an <img> is the whole node, while the other tags wrap
// content that has to go with them. Our attachment nodes are always leaves, so a non-greedy match
// to the first matching close tag is safe.
const VOID_ATTACHMENT_RE = new RegExp(`<img\\b[^>]*\\b${ATTACHMENT_ID_ATTR}="[^"]+"[^>]*>`, 'gi');
const PAIRED_ATTACHMENT_RE = new RegExp(
  `<(${TAGS.filter((tag) => tag !== 'img').join('|')})\\b[^>]*\\b${ATTACHMENT_ID_ATTR}="[^"]+"[^>]*>[\\s\\S]*?<\\/\\1>`,
  'gi'
);

export function bodyHasAttachment(html: string | null | undefined): boolean {
  if (!html) return false;
  return ATTACHMENT_ID_TEST_RE.test(html);
}

export function extractAttachmentIds(html: string | null | undefined): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  for (const match of html.matchAll(ATTACHMENT_ID_MATCH_ALL_RE)) {
    ids.add(match[1]);
  }
  return [...ids];
}

/**
 * The Body is the authority on order and kind, because the card (`CardMedia`) needs both before
 * the rows resolve, even for a deleted row. The row only supplies bytes.
 */
export interface BodyAttachment {
  id: string;
  kind: AttachmentKind;
}

/** Skips an unknown tag, so a future node type shows "no preview" rather than the wrong one. */
export function extractBodyAttachments(html: string | null | undefined): BodyAttachment[] {
  if (!html) return [];
  const seen = new Set<string>();
  const found: BodyAttachment[] = [];
  for (const match of html.matchAll(ATTACHMENT_NODE_RE)) {
    const kind = KIND_BY_TAG.get(match[1].toLowerCase());
    if (!kind || seen.has(match[2])) continue;
    seen.add(match[2]);
    found.push({ id: match[2], kind });
  }
  return found;
}

/**
 * The card shows the attachment summary separately, so without this the preview repeats each
 * attachment and an image-heavy note pushes its own words out of the clamp.
 */
export function stripAttachmentNodes(html: string | null | undefined): string {
  if (!html) return '';
  return html.replace(PAIRED_ATTACHMENT_RE, '').replace(VOID_ATTACHMENT_RE, '');
}

/** Points every reference to `from` at `to`: a Conflicted Copy's clones take new ids. */
export function repointAttachment(html: string, from: string, to: string): string {
  return html.replaceAll(`${ATTACHMENT_ID_ATTR}="${from}"`, `${ATTACHMENT_ID_ATTR}="${to}"`);
}

/**
 * A checklist as TipTap serialises it, so a hand-built Body round-trips unchanged (pinned in
 * `body.test.ts`). An item carries its state twice: TipTap parses `data-checked`, the card paints
 * the input's `checked`.
 */
export function taskListMarkup(items: [label: string, checked: boolean][]): string {
  const item = ([label, checked]: [string, boolean]) =>
    `<li data-checked="${checked}" data-type="taskItem">` +
    `<label><input type="checkbox"${checked ? ' checked="checked"' : ''}><span></span></label>` +
    `<div><p>${label}</p></div></li>`;
  return `<ul data-type="taskList">${items.map(item).join('')}</ul>`;
}

export function closestChecklistItem(target: Element): Element | null {
  return target.closest(TASK_ITEM);
}

export function isChecklistItemChecked(item: Element): boolean {
  return item.getAttribute('data-checked') === 'true';
}

export function checklistBox(item: Element): HTMLInputElement | null {
  return item.querySelector<HTMLInputElement>(TASK_BOX);
}

/**
 * Ticking a Checklist on a card, which has no ProseMirror to dispatch into, so it is a string
 * transformation on the stored Body (ADR 0013). `index` is in document order, which the card
 * shares: `stripAttachmentNodes` never drops an `li`. `null` when already in that state, so a
 * double tap does not bump `updatedAt`.
 */
export function setChecklistItemChecked(
  html: string,
  index: number,
  checked: boolean
): string | null {
  if (index < 0) return null;

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const item = doc.querySelectorAll(TASK_ITEM)[index];
  if (!item) return null;

  if (isChecklistItemChecked(item) === checked) return null;

  item.setAttribute('data-checked', String(checked));

  const box = checklistBox(item);
  if (box) {
    if (checked) box.setAttribute('checked', '');
    else box.removeAttribute('checked');
  }

  return doc.body.innerHTML;
}

/**
 * Counted as `setChecklistItemChecked` counts. Read from the DOM because the card's body is
 * `innerHTML`, with no React elements to hang a handler or key on.
 */
export function checklistItemIndexAt(root: ParentNode, target: Element): number | null {
  const item = closestChecklistItem(target);
  if (!item || !root.contains(item)) return null;
  const index = Array.from(root.querySelectorAll(TASK_ITEM)).indexOf(item);
  return index < 0 ? null : index;
}
```

`git rm -q src/lib/attachment-html.ts src/lib/attachment-html.test.ts src/lib/note-attachments.ts src/lib/note-attachments.test.ts src/lib/checklist.ts src/lib/checklist.test.ts`.

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run src/lib/body.test.ts`
Expected: PASS (29 cases).

- [ ] **Step 5: Point every reader and writer at it**

Import changes (same symbols, new module `@/lib/body.ts`): `src/components/notes/NoteEditorDialog.tsx` (`bodyHasAttachment`, `extractAttachmentIds`), `src/sync/conflictedCopy.ts` (`extractAttachmentIds`, plus `repointAttachment`), `src/hooks/data/useAttachmentActions.ts` (`extractAttachmentIds`), `src/components/editor/extensions/attachments/insert.ts` (`extractAttachmentIds`), `src/components/cards/CardMedia.tsx` (`BodyAttachment`, `extractBodyAttachments`), `src/components/cards/NoteCard.tsx` (`stripAttachmentNodes`, `checklistItemIndexAt`, `setChecklistItemChecked`, plus `closestChecklistItem`, `isChecklistItemChecked`, `checklistBox`), `src/lib/flip-rows.ts` (`TASK_LIST`; delete its local `const TASK_LIST`).

`src/sync/conflictedCopy.ts`: the loop `body = body?.replaceAll(\`data-attachment-id="${from}"\`, \`data-attachment-id="${clone.id}"\`);` becomes `if (body) body = repointAttachment(body, from, clone.id);`.

`src/components/cards/NoteCard.tsx`, in `handleChecklistClick`: `target.closest('li[data-type="taskItem"]')` becomes `closestChecklistItem(target)`; `item.getAttribute('data-checked') !== 'true'` becomes `!isChecklistItemChecked(item)`; `item.querySelector<HTMLInputElement>('input[type="checkbox"]')` becomes `checklistBox(item)`. In the long-press effect: `target.closest('li[data-type="taskItem"]') !== null` becomes `closestChecklistItem(target) !== null`.

`src/lib/tour/props.ts`: delete the local `taskItem` and `checklist` functions and their comment; import `taskListMarkup` from `@/lib/body.ts` and call it where `checklist(...)` was called (same argument shape). `bulletList` and `paragraph` stay. `props.test.ts` must stay green unchanged: it round-trips the result through TipTap.

`src/components/notes/noteDrafts.ts`: `export const EMPTY_CHECKLIST_BODY = taskListMarkup([['', false]]);` with the import; keep the doc comment.

`src/components/notes/QuickCaptureBar.test.tsx`: the checklist row of the `it.each` table repeats the old literal; replace the literal with `EMPTY_CHECKLIST_BODY` imported from `./noteDrafts.ts`.

`src/components/editor/editor.tsx`: `html?.includes('data-attachment-id')` becomes `bodyHasAttachment(html)` (import from `@/lib/body.ts`).

`src/components/share/sharedBody.ts`: `querySelectorAll('[data-attachment-id]')` becomes `` querySelectorAll(`[${ATTACHMENT_ID_ATTR}]`) `` and `getAttribute('data-attachment-id')` becomes `getAttribute(ATTACHMENT_ID_ATTR)`.

`src/components/editor/extensions/attachments/createAttachmentNode.ts`: the two `'data-attachment-id'` literals in `addAttributes` and the one in `parseHTML` use `ATTACHMENT_ID_ATTR`.

- [ ] **Step 6: Gates**

Run: `grep -rn "attachment-html\|note-attachments\|lib/checklist\|'li\[data-type=\"taskItem\"\]'\|'data-attachment-id'" src e2e --include='*.ts' --include='*.tsx'` (expected: no output outside `src/lib/body.ts`), then `pnpm vitest run src/lib src/components src/sync src/hooks`, `pnpm exec tsc -b --noEmit`, `pnpm check:ci`, `pnpm lint`.
Expected: all green.

- [ ] **Step 7: Commit**

Stop and ask souki to commit:

```
refactor(body): lib/body.ts is the one module for the Body's HTML vocabulary
```

---

### Task 6: Docs follow the code, then every gate

**Files:**
- Modify: `src/components/editor/CLAUDE.md` (the attachment passages)
- Modify: `src/components/cards/CLAUDE.md` and `src/lib/CLAUDE.md` if they exist and name a deleted module (`grep -rn "note-attachments\|attachment-html\|checklist.ts\|insert.ts\|ImageButton" --include=CLAUDE.md -r src CLAUDE.md`)
- Modify: `PLAN.md` (M6 slice 3)

- [ ] **Step 1: `src/components/editor/CLAUDE.md`**

In the Image bullet, after the sentence that ends `never persists a \`src\`/base64 -` (its continuation), append one sentence: `Every kind's facts (MIME prefix, whitelist, cap, Body tag, extensions, picker \`accept\`) are one row of \`ATTACHMENT_SPECS\` in \`src/lib/attachments.ts\`; the node factory, the insert path and the Body readers all key on it.`

In the File bullet, the sentence that names `MAX_FILE_BYTES` and `MIME_PREFIX` now says: the size cap is the `file` row of `ATTACHMENT_SPECS` and a file matches every MIME prefix (`prefix: ''`), so the whitelist is skipped and only the cap gates it. Keep the rest of the bullet.

Replace the bullet that begins `All four media nodes (Image/Audio/Video/File) share the \`attachments/\` core` with:

```
- All five attachment nodes share the `attachments/` core: `createAttachmentNode({ kind, nodeView, button })` derives the node name, the Body tag and the insert command from the kind; `insertAttachmentNode(editor, kind, id)` places a node; `insert.ts` is the one path from files to nodes (`insertFiles(kind, editor, files, deps)` validates, derives what the kind's `DERIVE` entry computes, stores and places; `insertTransferredFiles` routes a paste or drop file by file; `pickerButton(kind, icon)` is the toolbar button of every picker kind); `AttachmentNodeView` draws the delete overlay, the remote and missing placeholders and the loading pulse, and Image, Video and File supply only their ready element.
  Audio and Excalidraw keep their own node views (an inline delete button and a canvas surface) and their own buttons (a record request, a dialog).
```

In the Testing extensions section, add after the `formatting.test.ts` sentence: `The attachment nodes are tested as tables too: \`attachments/createAttachmentNode.test.ts\` (parse, insert, name per kind), \`attachments/insert.test.ts\` (the insert path per kind, derived data, transfer routing) and \`attachments/AttachmentNodeView.test.tsx\` (the shared states per visual kind); a kind's own test keeps only its button and its ready element.`

- [ ] **Step 2: Other CLAUDE.md files and the lib**

Run the grep in the Files list. Where a doc names `lib/note-attachments.ts`, `lib/attachment-html.ts` or `lib/checklist.ts`, name `lib/body.ts` instead, keeping the sentence; where it names `ImageButton`, `VideoButton` or `FileButton`, name `pickerButton`; where it names `insertImageAttachmentFiles` or `insertAttachmentFiles`, name `insertFiles`. Change nothing else. List every edit in the report.

- [ ] **Step 3: `PLAN.md`**

Mark M6 slice 3 `✅` the way slices 1 and 2 are marked and append, three-space indented:

```
   Harmless changes: image validation ignores a `;parameter` on the MIME like the other kinds; a ready `<video>` has the same corner radius as its thumbnail; `EMPTY_CHECKLIST_BODY` carries TipTap's full item markup, which parses to the same document.
   Deviations: Audio and Excalidraw keep their own node views and buttons (their tests pin an inline delete button and a canvas surface); `flip-rows.ts` stays its own module and imports the task-list selector from `body.ts`; the shared Share page keeps its kind switch (it renders from the server's list, not from the Body); the five `declare module` command augmentations stay in the extension files, since TipTap's typing needs them.
```

Append to the M6 **Tickets** list:

```
- Every kind's insert errors toast through `editor.image.errors.*`, so a rejected video says "Image is too large (max 10 MB)"; per-kind keys, or one neutral set with the cap interpolated, would fix the copy.
- `AttachmentNotDownloaded` renders a remote video as a plain `<img>` with no marker that it is a video.
- `stripHtml` stops at the first `>` inside an attribute value and decodes only five entities; a DOM `textContent` projection would be exact.
```

- [ ] **Step 4: Run every gate**

Run, in order:
```bash
pnpm check:ci
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```
Expected: all green, no new warnings (six ESLint warnings pre-exist in files this slice does not touch), no flaky retries. The e2e run matters: `e2e/capture.spec.ts` inserts a picked image through the picker Start and `e2e/checklist.spec.ts` ticks a checklist from the card.

- [ ] **Step 5: Commit**

Stop and ask souki to commit:

```
docs(attachments): kind table, one insert path, node shell and body.ts
```

---

## Not in this plan

- Dropping or pasting a document (`application/pdf`) as a File attachment: paste and drop route the three media kinds as before; a `file` branch is a feature decision.
- Moving Audio and Excalidraw onto `AttachmentNodeView` (their delete affordances and surfaces differ by design).
- `useVideoPosterBackfill` in `CardMedia.tsx`: it repairs rows stored before posters were captured and now also covers slash-inserted videos from before this slice; it stays until those rows age out.
- Making `AttachmentNodeConfig` generic over its button component (a generic widens the icon literal to `string`; the concrete `pickerButton` return type gives the check where it matters).
- The per-kind error copy (ticketed above).
