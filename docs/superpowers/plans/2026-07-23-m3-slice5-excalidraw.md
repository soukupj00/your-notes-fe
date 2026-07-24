# M3 Slice 5 - Excalidraw drawing attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Depends on: Slice 3.5** - the Excalidraw NodeView's delete button (Task 6) consumes the shared `ConfirmDeleteButton` (`src/components/editor/extensions/attachments/ConfirmDeleteButton.tsx`), which must already exist.

**Goal:** Add embedded Excalidraw drawings as an attachment kind - a toolbar button that inserts a live, editable drawing canvas whose scene is stored (and re-saved on edit) in the generic `attachments` table as a JSON blob, with a lightweight stored-SVG preview on the home card - reusing the Slice 1-4 attachment core unchanged.

**Architecture:** The `excalidrawAttachment` node is built on the **unchanged** `createAttachmentNode` factory (same id-only parse/render, stacking insert command, and `getDeps` wiring as image/audio/video), serialized with its own `<excalidraw-drawing>` tag. What differs from prior kinds lives outside the node: creation mints an *empty* JSON scene (no file picker) via `createAttachment`; the interactive `@excalidraw/excalidraw` canvas in the NodeView writes the edited scene **back** to the same row through a new `updateAttachment` primitive; a JSON-scene loader hook (`useExcalidrawScene`) replaces the object-URL hook; and a new `Attachment.preview` SVG field lets the home card render a snapshot inline (image-like resolution in `NoteBody`) without re-mounting the canvas.

**Tech Stack:** React 19, TypeScript, TipTap v3 (`@tiptap/core` + `@tiptap/react`), Dexie (IndexedDB), `@excalidraw/excalidraw`, Vitest + React Testing Library + `fake-indexeddb`, i18next, sonner.

## Global Constraints

- Package manager is **pnpm**. `pnpm test`, `pnpm build`, `pnpm check:ci` - never npm/yarn.
- **IDs** `uuid` v4; **timestamps** ISO strings on `createdAt`/`updatedAt`.
- **Payload is a native `Blob`**, never base64/`data:` (ADR 0007). Body persists `<excalidraw-drawing data-attachment-id>` with **NO inline scene**.
- **tsconfig `erasableSyntaxOnly: true`**: no TS constructor parameter-property shorthand (declare field + assign in body). No `enum`/`namespace`.
- **jsdom + fake-indexeddb Blob gotcha**: a Blob read back from the DB under jsdom is a plain object (`instanceof Blob === false`). Blob-identity / blob-content round-trip tests use `// @vitest-environment node` as the file's FIRST line; hook/component tests stay jsdom and mock `@excalidraw/excalidraw`.
- **Icons** are string keys in `src/components/icons/icons.ts` - never import a Lucide component into a button config.
- **No em dashes** in code/comments/docs - plain `-`. `@/` import alias. Keep files under 500 lines.
- **Excalidraw scene MIME:** `application/json`. **Scene size cap: 25 MB** (`25 * 1024 * 1024`), enforced at creation only.
- **Reuse `createAttachmentNode` unchanged** - do not fork a bespoke node. The custom `<excalidraw-drawing>` tag is supplied via the factory's `renderTag`/`parseTag` config.
- **No paste/drop** for Excalidraw (not file-driven). **No `NoteCard` change** and **no `bodyHasExcalidraw`** helper - the card renders the stored SVG inline through `NoteBody` (image-like), not a boolean-gated button.
- Each task lands with its tests + a commit; `pnpm test` + `pnpm build` stay green at every task boundary.

---

## File Structure

**Create (Excalidraw extension):**
- `src/components/editor/extensions/Excalidraw/scene.ts` - scene JSON + SVG helpers.
- `src/components/editor/extensions/Excalidraw/useExcalidrawScene.ts` - attachmentId -> scene loader hook.
- `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.tsx` - interactive canvas (editable) / SVG preview (read-only) / missing.
- `src/components/editor/extensions/Excalidraw/ExcalidrawButton.tsx` - "insert drawing" toolbar button (empty-scene creator).
- `src/components/editor/extensions/Excalidraw/Excalidraw.ts` - `excalidrawAttachment` node via the factory.
- `src/components/editor/extensions/Excalidraw/index.ts` + tests alongside each.

**Modify:**
- `package.json` / lockfile - add `@excalidraw/excalidraw`.
- `src/models.ts` - `AttachmentKind` gains `'excalidraw'`; `Attachment` gains `preview?: string`.
- `src/lib/attachments.ts` - `EXCALIDRAW_MIME`, `MAX_EXCALIDRAW_BYTES`, `validateAttachmentFile` excalidraw branch.
- `src/hooks/data/useAttachmentActions.ts` - `updateAttachment`.
- `src/components/editor/extensions/attachments/deps.ts` - `updateAttachment` on `AttachmentDeps`.
- `src/components/editor/editor.tsx` - register `createExcalidraw`; thread `updateAttachment`; set `EXCALIDRAW_ASSET_PATH`.
- `src/components/editor/menus/toolbars/BlocksSection.tsx` - add `'excalidrawAttachment'`.
- `src/components/NoteBody.tsx` - resolve + inject the stored `preview` SVG for excalidraw nodes.
- `src/components/icons/icons.ts` - `PenTool`.
- `public/locales/{en,cs}/translation.json` - excalidraw strings.

---

## Task 1: Add the `@excalidraw/excalidraw` dependency

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: the `@excalidraw/excalidraw` module (`Excalidraw`, `exportToSvg`) available to later tasks.

- [ ] **Step 1: Install**

Run: `pnpm add @excalidraw/excalidraw`
Expected: `package.json` `dependencies` gains `@excalidraw/excalidraw`, lockfile updates.

- [ ] **Step 2: Verify the named exports resolve**

Run: `pnpm exec node --input-type=module -e "import * as x from '@excalidraw/excalidraw'; if (!x.Excalidraw || !x.exportToSvg) { throw new Error('missing exports'); } console.log('ok');"`
Expected: prints `ok` (confirms both the canvas component and the SVG exporter are importable).

- [ ] **Step 3: Verify the app still builds with the new dep present**

Run: `pnpm build`
Expected: green (no code imports it yet; this only confirms the install did not break the build/toolchain).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[ADD] @excalidraw/excalidraw dependency (M3 Slice 5)"
```

---

## Task 2: Model + kind-dispatched validation for `excalidraw`

**Files:**
- Modify: `src/models.ts`
- Modify: `src/lib/attachments.ts`
- Test: `src/lib/attachments.test.ts`

**Interfaces:**
- Consumes: `AttachmentKind`, `validateAttachmentFile`, `AttachmentErrorCode` (existing).
- Produces: `AttachmentKind` includes `'excalidraw'`; `Attachment.preview?: string`; `EXCALIDRAW_MIME: 'application/json'`; `MAX_EXCALIDRAW_BYTES: number`; `validateAttachmentFile(file, 'excalidraw')`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/attachments.test.ts`:

```ts
import { MAX_EXCALIDRAW_BYTES, validateAttachmentFile } from './attachments';

function fileOf(type: string, size = 10): File {
  return new File([new Uint8Array(size)], 'x', { type });
}

describe('validateAttachmentFile - excalidraw', () => {
  it('accepts an application/json scene under the cap', () => {
    expect(validateAttachmentFile(fileOf('application/json'), 'excalidraw')).toBeNull();
  });

  it('rejects a non-json type', () => {
    expect(validateAttachmentFile(fileOf('image/png'), 'excalidraw')).toBe('unsupported-type');
  });

  it('rejects oversize and accepts exactly the cap', () => {
    expect(validateAttachmentFile(fileOf('application/json', MAX_EXCALIDRAW_BYTES + 1), 'excalidraw')).toBe('too-large');
    expect(validateAttachmentFile(fileOf('application/json', MAX_EXCALIDRAW_BYTES), 'excalidraw')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/lib/attachments.test.ts`
Expected: FAIL - `MAX_EXCALIDRAW_BYTES` not exported / `'excalidraw'` branch missing.

- [ ] **Step 3: Extend the model**

In `src/models.ts`:
- change `export type AttachmentKind = 'image' | 'audio' | 'video' | 'file';` to `export type AttachmentKind = 'image' | 'audio' | 'video' | 'file' | 'excalidraw';`
- add to the `Attachment` interface, after `duration?`:

```ts
  preview?: string; // excalidraw: rendered SVG snapshot of the scene, stored at save-time for cheap card rendering (no canvas re-mount)
```

- [ ] **Step 4: Implement the validation branch**

In `src/lib/attachments.ts`, add after the video constants:

```ts
/** Excalidraw scenes are stored as a JSON document (reuses the Blob-based attachments table). */
export const EXCALIDRAW_MIME = 'application/json';

/** Per-scene size cap: 25 MB. Enforced at creation only. */
export const MAX_EXCALIDRAW_BYTES = 25 * 1024 * 1024;
```

In `validateAttachmentFile`, replace the trailing `// file kind ...` fallthrough with an explicit excalidraw branch before it:

```ts
  if (kind === 'excalidraw') {
    if (file.type.split(';')[0].trim() !== EXCALIDRAW_MIME) return 'unsupported-type';
    if (file.size > MAX_EXCALIDRAW_BYTES) return 'too-large';
    return null;
  }
  // file kind lands in a later slice; reject until then.
  return 'unsupported-type';
```

- [ ] **Step 5: Run tests + build**

Run: `pnpm test src/lib/attachments.test.ts && pnpm build`
Expected: PASS (new excalidraw cases + existing image/audio/video cases green).

- [ ] **Step 6: Commit**

```bash
git add src/models.ts src/lib/attachments.ts src/lib/attachments.test.ts
git commit -m "[EDIT] Add excalidraw AttachmentKind, preview field, validation"
```

---

## Task 3: `updateAttachment` write-back primitive

**Files:**
- Modify: `src/hooks/data/useAttachmentActions.ts`
- Modify: `src/components/editor/extensions/attachments/deps.ts`
- Test: `src/hooks/data/useAttachmentActions.test.ts`

**Interfaces:**
- Consumes: `db.attachments` (existing).
- Produces:
  - `useAttachmentActions().updateAttachment(id: string, changes: { blob?: Blob; preview?: string }): Promise<void>`
  - `AttachmentDeps.updateAttachment: (id: string, changes: { blob?: Blob; preview?: string }) => Promise<void>`

- [ ] **Step 1: Write the failing test**

Add to `src/hooks/data/useAttachmentActions.test.ts` (first line of the file must be `// @vitest-environment node` if it is not already - the blob-content assertion needs the node env; if the file is already node-env, just add the block):

```ts
it('updateAttachment replaces the blob and sets preview + updatedAt', async () => {
  const { result } = renderHook(() => useAttachmentActions());
  const created = await result.current.createAttachment(
    'note-1',
    new File(['{"elements":[]}'], 'd.json', { type: 'application/json' }),
    'excalidraw'
  );
  await result.current.updateAttachment(created.id, {
    blob: new Blob(['{"elements":[1]}'], { type: 'application/json' }),
    preview: '<svg id="snap"/>',
  });
  const row = await result.current.getAttachment(created.id);
  expect(await row?.blob.text()).toBe('{"elements":[1]}');
  expect(row?.preview).toBe('<svg id="snap"/>');
  expect(row?.updatedAt).not.toBe(created.updatedAt);
});
```

(If `renderHook` is not yet imported in this file, add `import { renderHook } from '@testing-library/react';`. Match the existing test file's setup; it already exercises `createAttachment`/`getAttachment`.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/hooks/data/useAttachmentActions.test.ts`
Expected: FAIL - `updateAttachment` is not a function.

- [ ] **Step 3: Implement `updateAttachment`**

In `src/hooks/data/useAttachmentActions.ts`, add after `cloneAttachment`:

```ts
  // Write-back for interactive attachments (Excalidraw): replace the stored
  // scene blob and/or refresh the SVG preview in place, on the same row the
  // Body already references by id. Decoupled from Body autosave (the
  // attachmentId never changes on an edit).
  const updateAttachment = useCallback(
    async (id: string, changes: { blob?: Blob; preview?: string }): Promise<void> => {
      await db.attachments.update(id, { ...changes, updatedAt: new Date().toISOString() });
    },
    []
  );
```

Add `updateAttachment` to the returned object.

- [ ] **Step 4: Thread it into `AttachmentDeps`**

In `src/components/editor/extensions/attachments/deps.ts`, add after `cloneAttachment`:

```ts
  updateAttachment: (id: string, changes: { blob?: Blob; preview?: string }) => Promise<void>;
```

- [ ] **Step 5: Provide it in `editor.tsx`**

In `src/components/editor/editor.tsx`: add `updateAttachment` to the `useAttachmentActions()` destructure (near `createAttachment, getAttachment, cloneAttachment`), add `updateAttachment,` to the `attachmentDeps` `useMemo` object, and add `updateAttachment` to that memo's dependency array.

- [ ] **Step 6: Run tests + build**

Run: `pnpm test src/hooks/data/useAttachmentActions.test.ts && pnpm build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/data/useAttachmentActions.ts src/hooks/data/useAttachmentActions.test.ts src/components/editor/extensions/attachments/deps.ts src/components/editor/editor.tsx
git commit -m "[ADD] updateAttachment write-back primitive"
```

---

## Task 4: Scene helpers (`scene.ts`)

**Files:**
- Create: `src/components/editor/extensions/Excalidraw/scene.ts`
- Test: `src/components/editor/extensions/Excalidraw/scene.test.ts`

**Interfaces:**
- Consumes: `exportToSvg` (`@excalidraw/excalidraw`).
- Produces:
  - `interface ExcalidrawScene { elements: readonly unknown[]; appState: Record<string, unknown>; files: Record<string, unknown>; }`
  - `emptyScene(): ExcalidrawScene`
  - `sceneToFile(scene: ExcalidrawScene): File`
  - `parseScene(text: string): ExcalidrawScene | null`
  - `sceneToSvgString(scene: ExcalidrawScene): Promise<string>`

- [ ] **Step 1: Write the failing test**

Create `src/components/editor/extensions/Excalidraw/scene.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { emptyScene, parseScene, sceneToFile } from './scene';

describe('excalidraw scene helpers', () => {
  it('emptyScene has empty elements and a background color', () => {
    const s = emptyScene();
    expect(s.elements).toEqual([]);
    expect(s.appState.viewBackgroundColor).toBe('#ffffff');
    expect(s.files).toEqual({});
  });

  it('sceneToFile produces an application/json File', () => {
    const f = sceneToFile(emptyScene());
    expect(f.type).toBe('application/json');
    expect(f.name).toBe('drawing.excalidraw.json');
  });

  it('sceneToFile -> parseScene round-trips', async () => {
    const scene = { elements: [{ id: 'a' }], appState: { zoom: 1 }, files: {} };
    const text = await sceneToFile(scene).text();
    expect(parseScene(text)).toEqual(scene);
  });

  it('parseScene returns null on malformed JSON', () => {
    expect(parseScene('{not json')).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Excalidraw/scene.test.ts`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement `scene.ts`**

Create `src/components/editor/extensions/Excalidraw/scene.ts`:

```ts
import { exportToSvg } from '@excalidraw/excalidraw';

/** The subset of an Excalidraw scene we persist. `files` holds Excalidraw's own
 *  embedded-asset map (kept verbatim; no UI for it this slice). */
export interface ExcalidrawScene {
  elements: readonly unknown[];
  appState: Record<string, unknown>;
  files: Record<string, unknown>;
}

/** A fresh, empty scene for a newly inserted drawing. */
export function emptyScene(): ExcalidrawScene {
  return { elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} };
}

/** Serialize a scene as a JSON File so it flows through the same createAttachment
 *  path (and the same Blob-based attachments table) as every other media kind. */
export function sceneToFile(scene: ExcalidrawScene): File {
  return new File([JSON.stringify(scene)], 'drawing.excalidraw.json', {
    type: 'application/json',
  });
}

/** Tolerant parse: returns null on malformed JSON so the NodeView can show the
 *  "unavailable" state instead of throwing. */
export function parseScene(text: string): ExcalidrawScene | null {
  try {
    return JSON.parse(text) as ExcalidrawScene;
  } catch {
    return null;
  }
}

/** Render a scene to a standalone SVG string for the lightweight card snapshot.
 *  The one place that pulls the heavy exporter; never called on the card path. */
export async function sceneToSvgString(scene: ExcalidrawScene): Promise<string> {
  const svg = await exportToSvg({
    elements: scene.elements as never,
    appState: scene.appState as never,
    files: scene.files as never,
  });
  return new XMLSerializer().serializeToString(svg);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/components/editor/extensions/Excalidraw/scene.test.ts`
Expected: PASS (4 tests; `sceneToSvgString` is covered later via the NodeView test with a mocked exporter).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/scene.ts src/components/editor/extensions/Excalidraw/scene.test.ts
git commit -m "[ADD] Excalidraw scene serialization helpers"
```

---

## Task 5: `useExcalidrawScene` loader hook

**Files:**
- Create: `src/components/editor/extensions/Excalidraw/useExcalidrawScene.ts`
- Test: `src/components/editor/extensions/Excalidraw/useExcalidrawScene.test.tsx`

**Interfaces:**
- Consumes: `AttachmentDeps['getAttachment']`, `parseScene`/`ExcalidrawScene` (Task 4), `Attachment` (`@/models.ts`).
- Produces:
  - `type ExcalidrawSceneState = { status: 'loading' } | { status: 'ready'; scene: ExcalidrawScene; attachment: Attachment } | { status: 'missing' }`
  - `useExcalidrawScene(attachmentId: string | null, getAttachment: AttachmentDeps['getAttachment']): ExcalidrawSceneState`

- [ ] **Step 1: Write the failing test**

Create `src/components/editor/extensions/Excalidraw/useExcalidrawScene.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Attachment } from '@/models.ts';
import { useExcalidrawScene } from './useExcalidrawScene';

function att(body: string): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'a1', noteId: 'n1', kind: 'excalidraw', mime: 'application/json',
    blob: new Blob([body], { type: 'application/json' }), createdAt: now, updatedAt: now,
  };
}

function Probe({ get }: { get: (i: string) => Promise<Attachment | undefined> }) {
  const s = useExcalidrawScene('a1', get);
  return <div data-testid="s">{s.status === 'ready' ? `ready:${s.scene.elements.length}` : s.status}</div>;
}

describe('useExcalidrawScene', () => {
  it('resolves a stored scene', async () => {
    render(<Probe get={async () => att('{"elements":[{"id":"x"}],"appState":{},"files":{}}')} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('ready:1'));
  });

  it('reports missing when the row is absent', async () => {
    render(<Probe get={async () => undefined} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('missing'));
  });

  it('reports missing when the scene JSON is malformed', async () => {
    render(<Probe get={async () => att('{bad')} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('missing'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Excalidraw/useExcalidrawScene.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the hook**

Create `src/components/editor/extensions/Excalidraw/useExcalidrawScene.ts`:

```ts
import { useEffect, useState } from 'react';
import type { Attachment } from '@/models.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { type ExcalidrawScene, parseScene } from './scene';

export type ExcalidrawSceneState =
  | { status: 'loading' }
  | { status: 'ready'; scene: ExcalidrawScene; attachment: Attachment }
  | { status: 'missing' };

/**
 * JSON analogue of useAttachmentObjectUrl: resolves attachmentId -> Attachment ->
 * parsed scene. No object URL to revoke - a plain async read guarded by `active`.
 * Pass a STABLE getAttachment so the effect does not re-run every render.
 */
export function useExcalidrawScene(
  attachmentId: string | null,
  getAttachment: AttachmentDeps['getAttachment']
): ExcalidrawSceneState {
  const [state, setState] = useState<ExcalidrawSceneState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    if (!attachmentId) {
      setState({ status: 'missing' });
      return;
    }
    getAttachment(attachmentId).then(async (att) => {
      if (!active) return;
      if (!att) {
        setState({ status: 'missing' });
        return;
      }
      const scene = parseScene(await att.blob.text());
      setState(scene ? { status: 'ready', scene, attachment: att } : { status: 'missing' });
    });
    return () => {
      active = false;
    };
  }, [attachmentId, getAttachment]);
  return state;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/components/editor/extensions/Excalidraw/useExcalidrawScene.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/useExcalidrawScene.ts src/components/editor/extensions/Excalidraw/useExcalidrawScene.test.tsx
git commit -m "[ADD] useExcalidrawScene loader hook"
```

---

## Task 6: `ExcalidrawNodeView` - interactive canvas + write-back + preview

**Files:**
- Create: `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.tsx`
- Create: `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx`
- Modify: `src/components/icons/icons.ts` (add `PenTool`)
- Modify: `public/locales/{en,cs}/translation.json` (excalidraw strings used by the view + tests)

**Interfaces:**
- Consumes: `useExcalidrawScene` (Task 5), `sceneToFile`/`sceneToSvgString` (Task 4), `AttachmentDeps` (`updateAttachment` from Task 3), `ConfirmDeleteButton` (Slice 3.5, `../attachments/ConfirmDeleteButton`). Also adds `PenTool` to the `icons` registry (for the Task 7 button).
- Produces: `ExcalidrawNodeView` (default export) - rendered by `ReactNodeViewRenderer` in Task 7.

- [ ] **Step 1: Add the i18n keys**

Add to `public/locales/en/translation.json` under `editor`, a new `excalidraw` object: `{ "tooltip": "Insert drawing", "delete": "Delete drawing", "unavailable": "Drawing unavailable" }`.
Add to `public/locales/cs/translation.json`: `{ "tooltip": "Vložit kresbu", "delete": "Smazat kresbu", "unavailable": "Kresba není k dispozici" }`.

- [ ] **Step 2: Write the failing test**

Create `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx`:

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';

// Mock the heavy canvas: render a button that invokes onChange with one element.
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({ onChange }: { onChange?: (els: unknown[], app: unknown, files: unknown) => void }) => (
    <button type="button" data-testid="canvas" onClick={() => onChange?.([{ id: 'e1' }], {}, {})}>
      canvas
    </button>
  ),
  exportToSvg: vi.fn(async () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('id', 'snap');
    return el;
  }),
}));

import { ExcalidrawNodeView } from './ExcalidrawNodeView';

function att(body: string): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'a1', noteId: 'n1', kind: 'excalidraw', mime: 'application/json',
    blob: new Blob([body], { type: 'application/json' }), createdAt: now, updatedAt: now,
  };
}
function props(get: (i: string) => Promise<Attachment | undefined>, updateAttachment = vi.fn(async () => {})) {
  return {
    node: { attrs: { attachmentId: 'a1' } },
    editor: { isEditable: true },
    deleteNode: vi.fn(),
    extension: { options: { getDeps: () => ({ getAttachment: get, updateAttachment, t: (k: string) => k }) } },
  } as unknown as Parameters<typeof ExcalidrawNodeView>[0];
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ExcalidrawNodeView', () => {
  it('mounts the canvas for a ready scene', async () => {
    render(<ExcalidrawNodeView {...props(async () => att('{"elements":[],"appState":{},"files":{}}'))} />);
    await vi.waitFor(() => expect(screen.getByTestId('canvas')).toBeInTheDocument());
  });

  it('writes the edited scene back (blob + preview) on change, debounced', async () => {
    const update = vi.fn(async () => {});
    render(<ExcalidrawNodeView {...props(async () => att('{"elements":[],"appState":{},"files":{}}'), update)} />);
    await vi.waitFor(() => expect(screen.getByTestId('canvas')).toBeInTheDocument());
    screen.getByTestId('canvas').click();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith('a1', expect.objectContaining({ preview: expect.stringContaining('snap') })));
  });

  it('shows the unavailable box when the row is missing', async () => {
    render(<ExcalidrawNodeView {...props(async () => undefined)} />);
    await vi.waitFor(() => expect(screen.getByText('editor.excalidraw.unavailable')).toBeInTheDocument());
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 4: Add the `PenTool` icon**

In `src/components/icons/icons.ts`, add `PenTool` to the `lucide-react` import and to the `icons` object.

- [ ] **Step 5: Implement the NodeView**

Create `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.tsx`:

```tsx
import { Excalidraw } from '@excalidraw/excalidraw';
import type { ReactNodeViewProps } from '@tiptap/react';
import { NodeViewWrapper } from '@tiptap/react';
import { useCallback, useEffect, useRef } from 'react';
import { ConfirmDeleteButton } from '../attachments/ConfirmDeleteButton';
import type { AttachmentDeps } from '../attachments/deps';
import { type ExcalidrawScene, sceneToFile, sceneToSvgString } from './scene';
import { useExcalidrawScene } from './useExcalidrawScene';

const WRITE_DEBOUNCE_MS = 800;

/** Editor render path for excalidrawAttachment. Editable: the live canvas with a
 *  debounced write-back to the same attachment row (blob + regenerated SVG
 *  snapshot). Read-only: the stored preview SVG. Missing/malformed: a dashed box.
 *  The home feed never mounts this - it injects the stored SVG in NoteBody. */
export function ExcalidrawNodeView(props: ReactNodeViewProps) {
  const attachmentId = props.node.attrs.attachmentId as string | null;
  const deps = (props.extension.options.getDeps as () => AttachmentDeps)();
  const state = useExcalidrawScene(attachmentId, deps.getAttachment);
  const canDelete = props.editor?.isEditable ?? false;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<ExcalidrawScene | null>(null);

  const flush = useCallback(async () => {
    const scene = pendingRef.current;
    if (!scene || !attachmentId) return;
    pendingRef.current = null;
    try {
      const blob = sceneToFile(scene);
      let preview: string | undefined;
      try {
        preview = await sceneToSvgString(scene);
      } catch (err) {
        console.error('ExcalidrawNodeView: SVG snapshot failed', err);
      }
      await deps.updateAttachment(attachmentId, { blob, preview });
    } catch (err) {
      console.error('ExcalidrawNodeView: scene write-back failed', err);
    }
  }, [attachmentId, deps]);

  // Flush any pending write on unmount so the last edit is not lost.
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flush();
    };
  }, [flush]);

  const onChange = useCallback(
    (elements: readonly unknown[], appState: Record<string, unknown>, files: Record<string, unknown>) => {
      pendingRef.current = { elements, appState, files };
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flush(), WRITE_DEBOUNCE_MS);
    },
    [flush]
  );

  const deleteButton = canDelete ? (
    <ConfirmDeleteButton
      onConfirm={() => props.deleteNode()}
      label={deps.t('editor.excalidraw.delete')}
      t={deps.t}
    />
  ) : null;

  if (state.status === 'missing') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="flex items-center gap-3 rounded-md border border-dashed p-4 text-muted-foreground text-sm">
          <span className="flex-1 text-center">{deps.t('editor.excalidraw.unavailable')}</span>
          {deleteButton}
        </div>
      </NodeViewWrapper>
    );
  }

  if (state.status === 'loading') {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        <div className="h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      </NodeViewWrapper>
    );
  }

  // Read-only viewer: the stored SVG snapshot (self-generated, trusted markup).
  if (!canDelete) {
    return (
      <NodeViewWrapper as="div" className="my-2" data-drag-handle>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: self-generated SVG snapshot */}
        <div className="max-w-full [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: state.attachment.preview ?? '' }} />
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper as="div" className="my-2" data-drag-handle>
      <div className="flex items-start gap-3">
        <div className="h-[420px] flex-1 overflow-hidden rounded-md border" contentEditable={false}>
          <Excalidraw initialData={state.scene as never} onChange={onChange} />
        </div>
        {deleteButton}
      </div>
    </NodeViewWrapper>
  );
}

export default ExcalidrawNodeView;
```

- [ ] **Step 6: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.tsx src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx src/components/icons/icons.ts public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] ExcalidrawNodeView interactive canvas + write-back"
```

---

## Task 7: `ExcalidrawButton` - empty-scene creator

**Files:**
- Create: `src/components/editor/extensions/Excalidraw/ExcalidrawButton.tsx`
- Test: `src/components/editor/extensions/Excalidraw/ExcalidrawButton.test.tsx`

**Interfaces:**
- Consumes: `ActionButton`, `AttachmentDeps` (`getNoteId`/`createAttachment`/`onError`), `emptyScene`/`sceneToFile` (Task 4).
- Produces: `ExcalidrawButton({ editor, getDeps, tooltip })` - a toolbar entry that mints an empty scene attachment and inserts the node.

- [ ] **Step 1: Write the failing test**

Create `src/components/editor/extensions/Excalidraw/ExcalidrawButton.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Editor } from '@tiptap/core';
import type { AttachmentDeps } from '../attachments/deps';
import { ExcalidrawButton } from './ExcalidrawButton';

function setup() {
  const run = vi.fn();
  const insert = vi.fn(() => ({ run }));
  const focus = vi.fn(() => ({ insertExcalidrawAttachment: insert }));
  const chain = vi.fn(() => ({ focus }));
  const editor = { chain } as unknown as Editor;
  const createAttachment = vi.fn(async () => ({ id: 'att-1' }));
  const onError = vi.fn();
  const deps = {
    getNoteId: vi.fn(async () => 'note-1'),
    createAttachment,
    onError,
  } as unknown as AttachmentDeps;
  return { editor, deps, createAttachment, insert, onError };
}

describe('ExcalidrawButton', () => {
  it('creates an empty excalidraw scene and inserts the node', async () => {
    const { editor, deps, createAttachment, insert } = setup();
    render(<ExcalidrawButton editor={editor} getDeps={() => deps} tooltip="Insert drawing" />);
    await userEvent.click(screen.getByRole('button', { name: 'Insert drawing' }));
    await vi.waitFor(() => {
      expect(createAttachment).toHaveBeenCalledWith('note-1', expect.any(File), 'excalidraw');
      expect(insert).toHaveBeenCalledWith({ attachmentId: 'att-1' });
    });
  });

  it('routes a creation failure through onError instead of throwing', async () => {
    const { editor, deps, createAttachment, onError } = setup();
    (createAttachment as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('boom'));
    render(<ExcalidrawButton editor={editor} getDeps={() => deps} tooltip="Insert drawing" />);
    await userEvent.click(screen.getByRole('button', { name: 'Insert drawing' }));
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith('insert-failed'));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Excalidraw/ExcalidrawButton.test.tsx`
Expected: FAIL - module not found.

- [ ] **Step 3: Implement the button**

Create `src/components/editor/extensions/Excalidraw/ExcalidrawButton.tsx`:

```tsx
import type { Editor } from '@tiptap/core';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { AttachmentError } from '@/lib/attachments.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { emptyScene, sceneToFile } from './scene';

export interface ExcalidrawButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point. Unlike image/audio/video there is no file - clicking
 *  mints an empty scene attachment (kind 'excalidraw', a JSON blob) and inserts
 *  the node; the NodeView's canvas then edits it in place and writes back. */
export function ExcalidrawButton({ editor, getDeps, tooltip }: ExcalidrawButtonProps) {
  const insert = async () => {
    const deps = getDeps(); // resolve at click time for the freshest getNoteId
    try {
      const noteId = await deps.getNoteId();
      const att = await deps.createAttachment(noteId, sceneToFile(emptyScene()), 'excalidraw');
      editor.chain().focus().insertExcalidrawAttachment({ attachmentId: att.id }).run();
    } catch (err) {
      if (err instanceof AttachmentError) {
        deps.onError(err.code);
      } else {
        console.error('ExcalidrawButton: failed to create drawing', err);
        deps.onError('insert-failed');
      }
    }
  };

  return <ActionButton icon="PenTool" tooltip={tooltip} action={() => void insert()} />;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test src/components/editor/extensions/Excalidraw/ExcalidrawButton.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/ExcalidrawButton.tsx src/components/editor/extensions/Excalidraw/ExcalidrawButton.test.tsx
git commit -m "[ADD] ExcalidrawButton empty-scene creator"
```

---

## Task 8: `excalidrawAttachment` node via the factory (headless)

**Files:**
- Create: `src/components/editor/extensions/Excalidraw/Excalidraw.ts`, `Excalidraw/index.ts`
- Create: `src/components/editor/extensions/Excalidraw/Excalidraw.test.ts`

**Interfaces:**
- Consumes: `createAttachmentNode` (unchanged), `AttachmentDeps`, `ExcalidrawNodeView` (Task 6), `ExcalidrawButton` (Task 7).
- Produces: `createExcalidraw(getDeps: () => AttachmentDeps)` -> node `excalidrawAttachment`, command `insertExcalidrawAttachment({ attachmentId })`, body tag `excalidraw-drawing[data-attachment-id]`.

- [ ] **Step 1: Write the failing headless test**

Create `src/components/editor/extensions/Excalidraw/Excalidraw.test.ts`:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttachmentDeps } from '../attachments/deps';
import { createExcalidraw } from './Excalidraw';

// The node factory pulls in the NodeView module; mock the heavy canvas lib so
// this headless test never touches it.
vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createExcalidraw(() => deps)],
    content: '<p></p>',
  });
}

describe('excalidrawAttachment node', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('parses excalidraw-drawing[data-attachment-id] and re-renders with no payload', () => {
    editor.commands.setContent('<excalidraw-drawing data-attachment-id="abc"></excalidraw-drawing>');
    const html = editor.getHTML();
    expect(html).toContain('data-attachment-id="abc"');
    expect(html).toContain('excalidraw-drawing');
  });

  it('insertExcalidrawAttachment inserts a node with the id', () => {
    editor.commands.insertExcalidrawAttachment({ attachmentId: 'xyz' });
    expect(editor.getHTML()).toContain('data-attachment-id="xyz"');
  });

  it('exposes a Pattern A button with the drawing tooltip', () => {
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'excalidrawAttachment');
    const button = ext?.options.button({ editor, t: (k: string) => k }) as { componentProps: { tooltip: string } };
    expect(button.componentProps.tooltip).toBe('editor.excalidraw.tooltip');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Excalidraw/Excalidraw.test.ts`
Expected: FAIL - `createExcalidraw` not found.

- [ ] **Step 3: Implement `Excalidraw.ts`**

Create `src/components/editor/extensions/Excalidraw/Excalidraw.ts`:

```ts
import type { Editor } from '@tiptap/core';
import { createAttachmentNode } from '../attachments/createAttachmentNode';
import type { AttachmentDeps } from '../attachments/deps';
import { ExcalidrawButton } from './ExcalidrawButton';
import { ExcalidrawNodeView } from './ExcalidrawNodeView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    excalidrawAttachment: {
      insertExcalidrawAttachment: (attrs: { attachmentId: string }) => ReturnType;
    };
  }
}

/** Custom Excalidraw-drawing node on the shared factory. Serializes as
 *  <excalidraw-drawing data-attachment-id> (no scene payload); the NodeView is
 *  the interactive canvas. Reuses createAttachmentNode unchanged - only the tag,
 *  NodeView, button, and command name differ from image/audio/video. */
export function createExcalidraw(getDeps: () => AttachmentDeps) {
  return createAttachmentNode(getDeps, {
    name: 'excalidrawAttachment',
    parseTag: 'excalidraw-drawing[data-attachment-id]',
    renderTag: 'excalidraw-drawing',
    insertCommandName: 'insertExcalidrawAttachment',
    nodeView: ExcalidrawNodeView,
    button: ({
      editor,
      getDeps,
      t,
    }: {
      editor: Editor;
      getDeps: () => AttachmentDeps;
      t: (k: string) => string;
    }) => ({
      component: ExcalidrawButton,
      componentProps: { editor, getDeps, tooltip: t('editor.excalidraw.tooltip') },
    }),
  });
}
```

Create `src/components/editor/extensions/Excalidraw/index.ts`:

```ts
export * from './Excalidraw';
export * from './ExcalidrawButton';
```

- [ ] **Step 4: Run to verify it passes + full suite**

Run: `pnpm test src/components/editor/extensions/Excalidraw/Excalidraw.test.ts && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/Excalidraw.ts src/components/editor/extensions/Excalidraw/index.ts src/components/editor/extensions/Excalidraw/Excalidraw.test.ts
git commit -m "[ADD] excalidrawAttachment node via shared factory (headless)"
```

---

## Task 9: Wire the node into the editor toolbar

**Files:**
- Modify: `src/components/editor/editor.tsx`
- Modify: `src/components/editor/menus/toolbars/BlocksSection.tsx`
- Modify: `src/components/editor/menus/toolbars/BlocksSection.test.tsx`

**Interfaces:**
- Consumes: `createExcalidraw` (Task 8).
- Produces: the drawing button rendered in the Blocks toolbar section; the node registered in the editor.

- [ ] **Step 1: Extend the BlocksSection test**

In `src/components/editor/menus/toolbars/BlocksSection.test.tsx`, in the "surfaces the image, audio, and video insert buttons" test, register the excalidraw extension in the editor built by the test and assert its button. Add `createExcalidraw(() => deps)` (mirroring how `createVideo` is added in that test's editor setup - use the same `deps` stub the test already passes to the other attachment nodes) to the `extensions` array, add `vi.mock('@excalidraw/excalidraw', () => ({ Excalidraw: () => null, exportToSvg: vi.fn() }));` at the top of the file, and add:

```ts
expect(screen.getByRole('button', { name: 'editor.excalidraw.tooltip' })).toBeInTheDocument();
```

(Rename the test title to "surfaces the image, audio, video, and drawing insert buttons".)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/menus/toolbars/BlocksSection.test.tsx`
Expected: FAIL - no button with name `editor.excalidraw.tooltip` (name not yet in `BLOCK_EXTENSION_NAMES`).

- [ ] **Step 3: Add the name to `BlocksSection`**

In `src/components/editor/menus/toolbars/BlocksSection.tsx`, add `'excalidrawAttachment'` to `BLOCK_EXTENSION_NAMES` (after `'videoAttachment'`) and extend the file's doc comment to mention `excalidrawAttachment` is the custom Excalidraw node (M3 Slice 5).

- [ ] **Step 4: Register the node in `editor.tsx`**

In `src/components/editor/editor.tsx`:
- add `import { createExcalidraw } from '@/components/editor/extensions/Excalidraw';` (near the `createVideo` import);
- add `createExcalidraw(getAttachmentDeps),` to the `extensions` array (after `createVideo(getAttachmentDeps)`);
- at module top level (once, outside the component), set the Excalidraw asset origin so fonts resolve from the app origin under the PWA:

```ts
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/';
}
```

Do **not** add a paste/drop branch - Excalidraw drawings are never file-pasted.

- [ ] **Step 5: Run to verify it passes + full suite + build**

Run: `pnpm test src/components/editor/menus/toolbars/BlocksSection.test.tsx && pnpm test && pnpm build`
Expected: green - the drawing button surfaces alongside image/audio/video.

- [ ] **Step 6: Commit**

```bash
git add src/components/editor/editor.tsx src/components/editor/menus/toolbars/BlocksSection.tsx src/components/editor/menus/toolbars/BlocksSection.test.tsx
git commit -m "[ADD] Register excalidraw node + toolbar button"
```

---

## Task 10: Home-card preview - inject the stored SVG in `NoteBody`

**Files:**
- Modify: `src/components/NoteBody.tsx`
- Test: `src/components/NoteBody.test.tsx`

**Interfaces:**
- Consumes: `useAttachmentActions().getAttachment` (existing), the `Attachment.preview` field (Task 2).
- Produces: excalidraw nodes on the card render their stored SVG snapshot inline (image-like), not stripped and not re-mounting the canvas.

- [ ] **Step 1: Write the failing test**

Add to `src/components/NoteBody.test.tsx` (mirror the existing image-resolution test's `getAttachment` mock; if the file mocks `useAttachmentActions`, extend that mock to return a `preview` for the excalidraw id):

```tsx
it('injects the stored SVG preview for an excalidraw node (not stripped)', async () => {
  // getAttachment returns a row with a preview SVG for id 'draw-1'
  const html = '<excalidraw-drawing data-attachment-id="draw-1"></excalidraw-drawing>';
  const { container } = render(<NoteBody html={html} />);
  await waitFor(() => expect(container.querySelector('svg[id="snap"]')).toBeInTheDocument());
  expect(container.querySelector('excalidraw-drawing')).toBeInTheDocument();
});
```

Wire the test's `getAttachment` stub so that `getAttachment('draw-1')` resolves to `{ id: 'draw-1', kind: 'excalidraw', preview: '<svg id="snap"></svg>', blob: new Blob([]) }` (match the existing test file's mocking style - it already stubs `useAttachmentActions`/`getAttachment` for the image case).

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/NoteBody.test.tsx`
Expected: FAIL - the excalidraw node is left empty (no SVG injected).

- [ ] **Step 3: Implement the resolution in `NoteBody`**

In `src/components/NoteBody.tsx`, inside the effect (after the image-resolution block, before the audio/video strip block), add:

```ts
    // Excalidraw drawings render as their stored SVG snapshot on the card
    // (image-like inline resolution) - never re-mounting the canvas on the feed.
    root.querySelectorAll<HTMLElement>('excalidraw-drawing[data-attachment-id]').forEach((el) => {
      const id = el.getAttribute('data-attachment-id');
      if (!id) return;
      getAttachment(id).then((att) => {
        if (!active || !att?.preview) return;
        // Self-generated SVG markup (see sceneToSvgString), same trust model as
        // the Body HTML this component already sets.
        el.innerHTML = att.preview;
        const svg = el.querySelector('svg');
        if (svg) svg.style.maxWidth = '100%';
      });
    });
```

Leave the existing `audio`/`video` strip block unchanged - do **not** add `excalidraw-drawing` to it (it must render, not be removed).

- [ ] **Step 4: Run to verify it passes + full suite + build**

Run: `pnpm test src/components/NoteBody.test.tsx && pnpm test && pnpm build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/components/NoteBody.tsx src/components/NoteBody.test.tsx
git commit -m "[ADD] Render excalidraw SVG preview on note cards"
```

---

## Task 11: Documentation - editor `CLAUDE.md`

**Files:**
- Modify: `src/components/editor/CLAUDE.md`

**Interfaces:**
- None (docs only).

- [ ] **Step 1: Update the editor doc**

In `src/components/editor/CLAUDE.md`, in the extensions state list: change the "Still upstream / stubs" line so `Excalidraw` is no longer listed as a deferred stub, and add a bullet describing the `excalidrawAttachment` node - built on the same shared `createAttachmentNode` factory as Image/Audio/Video, serialized as `<excalidraw-drawing data-attachment-id>`, scene stored as an `application/json` blob in the `attachments` table (`kind: 'excalidraw'`) with a stored SVG snapshot in `Attachment.preview`, edited in place by the `@excalidraw/excalidraw` canvas in `ExcalidrawNodeView` and written back via `updateAttachment`, inserted (empty scene) by `ExcalidrawButton`, and rendered on cards as the stored SVG (not the canvas). Note it is the first attachment kind that is created empty and mutated in place rather than attached from a pre-existing file.

- [ ] **Step 2: Verify no code broke (docs-only, but keep the gate honest)**

Run: `pnpm check:ci`
Expected: green (Biome does not format Markdown, but this confirms nothing else regressed).

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/CLAUDE.md
git commit -m "[DOC] Document excalidraw attachment node"
```

---

## Self-Review notes

- **Spec coverage:** dependency (T1), model + validation (T2), `updateAttachment` (T3), scene helpers (T4), loader hook (T5), NodeView + write-back + preview + icon + i18n (T6), button (T7), node + factory reuse (T8), editor/toolbar wiring + asset path (T9), card SVG injection (T10), docs (T11). Out-of-scope items (collab, in-scene media UI, PNG/PDF export, libraries, metadata) are not implemented, as intended.
- **Type consistency:** `updateAttachment(id, { blob?, preview? })` is identical in `useAttachmentActions`, `AttachmentDeps`, and both call sites; `ExcalidrawScene` and `parseScene`/`sceneToFile`/`sceneToSvgString` signatures match across `scene.ts`, the hook, and the NodeView; the node name `excalidrawAttachment`, command `insertExcalidrawAttachment`, and tag `excalidraw-drawing` are used consistently across node, button, `BlocksSection`, tests, and `NoteBody`.
- **No `createAttachmentNode` change** and **no `NoteCard`/`attachment-html.ts` change** - deliberate, per the spec's reuse decision and the card-treatment divergence.

---

# Phase 2 - Modal rework (supersedes the inline-canvas NodeView + button)

> **Status:** Phase 1 (Tasks 1-11 above) shipped, but the inline-canvas approach does not work.
> This phase reworks the editing surface into a modal, per the **"Rework v2 - Modal editing surface"** section of the design doc (`docs/superpowers/specs/2026-07-23-m3-slice5-excalidraw-design.md`).
> Read that section before starting.
>
> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` tracking. `pnpm test` + `pnpm build` stay green at every task boundary; each task lands with its tests + a commit.

**What changes:** the live `<Excalidraw>` canvas moves out of the ProseMirror NodeView into a shared modal (`ExcalidrawDialog`). The NodeView becomes a passive, live-queried SVG preview that opens the modal on tap and carries a delete X. Attachment creation + node insertion move from button-click to the modal's **Save** (commit-on-Save). The critical CSS import is added.

**What is kept unchanged:** `scene.ts`, `updateAttachment` (Task 3), `Attachment.preview` + validation (Task 2), the `excalidrawAttachment` node/factory/tag + `BlocksSection` registration (Tasks 8-9), `EXCALIDRAW_ASSET_PATH`, and the `NoteBody` SVG injection (Task 10). Do not re-do those.

## Global constraints (Phase 2 additions)

- **Sizing uses relative units only** - `vw`/`vh`/`dvh`/`rem`, never `px`, including `max-*`/`min-*`.
- **Three distinct verbs** in the modal: **Save** (commit; disabled when scene empty; never deletes), **Cancel/X** (discard + close, dirty-guarded), **Delete** (edit-mode only; confirm-guarded). No button does the opposite of its label.
- **No accidental dismissal** - backdrop and Escape are `preventDefault`ed; the dialog's built-in close-X is disabled and replaced by our own guarded X.

---

## Task 12: Fix the Excalidraw stylesheet import (critical bug)

**Files:**
- Modify: the module that will mount the canvas (created in Task 13). If landing this ahead of Task 13 to unblock manual verification, import it once in `src/components/editor/editor.tsx` and move it to `ExcalidrawDialog` in Task 13.

**Interfaces:** none (side-effect import).

- [x] **Step 1: Add the CSS import**

Add `import '@excalidraw/excalidraw/index.css';` (confirmed export in v0.18.1: `exports['./index.css']`). Preferred final home is the top of `ExcalidrawDialog.tsx` (the only place the canvas mounts).

- [x] **Step 2: Verify build resolves the CSS export**

Run: `pnpm build`
Expected: green (Vite resolves `@excalidraw/excalidraw/index.css`).

---

## Task 13: `ExcalidrawDialog` - the modal editing surface

**Files:**
- Create: `src/components/editor/extensions/Excalidraw/ExcalidrawDialog.tsx`
- Create: `src/components/editor/extensions/Excalidraw/ExcalidrawDialog.test.tsx`
- Modify: `public/locales/{en,cs}/translation.json` (new modal strings)

**Interfaces:**
- Consumes: `@excalidraw/excalidraw` (`Excalidraw`, `excalidrawAPI` ref), the shared `Dialog`/`DialogContent` (`src/components/ui/dialog.tsx`), `ExcalidrawScene`/`emptyScene` (`scene.ts`), `ConfirmDeleteButton` is **not** reused here (the modal's Delete is a labelled button with its own confirm); `t`.
- Produces: `ExcalidrawDialog` (controlled, presentational + local editing state).

Props:
```ts
interface ExcalidrawDialogProps {
  open: boolean;
  mode: 'new' | 'edit';
  initialScene: ExcalidrawScene | null; // emptyScene() for 'new'
  onSave: (scene: ExcalidrawScene) => void | Promise<void>;
  onDelete?: () => void;   // present only in 'edit' mode
  onClose: () => void;     // discard + close
  t: (k: string) => string;
}
```

- [x] **Step 1: Add i18n keys**

`public/locales/en/translation.json` under `editor.excalidraw`, add: `"title": "Drawing"`, `"save": "Save"`, `"cancel": "Cancel"`, `"deleteModal": "Delete drawing"`, `"discardTitle": "Discard drawing?"`, `"discardDescription": "Your changes will be lost."`, `"discardConfirm": "Discard"`, `"discardCancel": "Keep editing"`.
`public/locales/cs/translation.json`: `"title": "Kresba"`, `"save": "Uložit"`, `"cancel": "Zrušit"`, `"deleteModal": "Smazat kresbu"`, `"discardTitle": "Zahodit kresbu?"`, `"discardDescription": "Vaše změny budou ztraceny."`, `"discardConfirm": "Zahodit"`, `"discardCancel": "Pokračovat v úpravách"`.

- [x] **Step 2: Write the failing test** (mock `@excalidraw/excalidraw`)

Mirror the NodeView test's mock but expose an `excalidrawAPI` and let a click add an element and fire `onChange`. Assert:
1. Save is **disabled** when the scene is empty (no elements).
2. After the mock "draw" (onChange with one element), Save is enabled and clicking it calls `onSave` with a scene containing that element.
3. Clicking Cancel/X while **dirty** shows the discard-confirm; confirming calls `onClose`; "Keep editing" does not.
4. `mode: 'edit'` renders a Delete button that calls `onDelete`; `mode: 'new'` renders none.
5. `onEscapeKeyDown`/`onPointerDownOutside` are prevented (no `onClose` on Escape/backdrop) - assert `onClose` not called on an Escape key event.

- [x] **Step 3: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Excalidraw/ExcalidrawDialog.test.tsx`
Expected: FAIL - module not found.

- [x] **Step 4: Implement `ExcalidrawDialog`**

- Import `@excalidraw/excalidraw/index.css` at the top (Task 12's final home).
- `DialogContent` with `showCloseButton={false}`, `onEscapeKeyDown={(e) => e.preventDefault()}`, `onPointerDownOutside={(e) => e.preventDefault()}`, and className (relative units only): base `w-screen h-[100dvh] max-w-none rounded-none p-0 gap-0 flex flex-col`, then `sm:w-[92vw] sm:max-w-[75rem] sm:h-[88vh] sm:rounded-lg`.
- A slim header row (`shrink-0`) with the title left and the actions **top-right**: Delete (edit mode only), Cancel/X, Save (disabled when `elements.length === 0`).
- The canvas fills the rest: a `flex-1 min-h-0` container holding `<Excalidraw initialData={initialScene} excalidrawAPI={(api) => (apiRef.current = api)} onChange={() => setDirty(true)} />`.
- On **Save**: read `apiRef.current.getSceneElements()/getAppState()/getFiles()`, build an `ExcalidrawScene`, call `onSave(scene)`, then `onClose` is driven by the parent (or call a provided close). Guard against empty.
- **Cancel/X**: if `dirty`, open the discard-confirm (a nested `Dialog` or `ConfirmDeleteButton`-style confirm using the `discard*` strings); on confirm call `onClose`. If not dirty, call `onClose` directly.
- **Delete**: confirm using the `discard`-style dialog titled `deleteModal`; on confirm call `onDelete?.()`.
- Reset local state (`dirty`) when `open`/identity changes - the parent `key`s the dialog by drawing identity (Task 14), so a fresh mount per open is the simplest reset.

- [x] **Step 5: Run to verify it passes + build**

Run: `pnpm test src/components/editor/extensions/Excalidraw/ExcalidrawDialog.test.tsx && pnpm build`
Expected: green.

- [x] **Step 6: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/ExcalidrawDialog.tsx src/components/editor/extensions/Excalidraw/ExcalidrawDialog.test.tsx public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] ExcalidrawDialog modal editing surface + CSS fix"
```

---

## Task 14: `openExcalidraw` on `AttachmentDeps` + modal state in `editor.tsx`

**Files:**
- Modify: `src/components/editor/extensions/attachments/deps.ts`
- Modify: `src/components/editor/editor.tsx`
- Test: extend `src/components/editor/editor.test.tsx` (or a focused new test) for the new-drawing Save (creates + inserts) and edit Save (updateAttachment).

**Interfaces:**
- Produces: `AttachmentDeps.openExcalidraw: (args: { attachmentId?: string; onDelete?: () => void }) => void`; a single `<ExcalidrawDialog>` rendered by `editor.tsx`.

- [x] **Step 1: Add `openExcalidraw` to `AttachmentDeps`**

In `deps.ts` add `openExcalidraw: (args: { attachmentId?: string; onDelete?: () => void }) => void;`.

- [x] **Step 2: Modal state + orchestration in `editor.tsx`**

- Hold state `{ open, attachmentId: string | null, initialScene, onDelete }`.
- Implement `openExcalidraw({ attachmentId, onDelete })`: if `attachmentId`, one-shot `getAttachment` + `parseScene(await blob.text())` to seed `initialScene` (mode `edit`); else seed `emptyScene()` (mode `new`). Set `open = true`. Thread `openExcalidraw` into the `attachmentDeps` memo (+ dep array).
- Implement `onSave(scene)`:
  - **new** (`attachmentId == null`): `const noteId = await getNoteId(); const att = await createAttachment(noteId, sceneToFile(scene), 'excalidraw'); await updateAttachment(att.id, { preview: await sceneToSvgString(scene) }); editor.chain().focus().insertExcalidrawAttachment({ attachmentId: att.id }).run();` (or pass the preview through creation if `createAttachment` supports it - otherwise the immediate `updateAttachment` sets it).
  - **edit**: `await updateAttachment(attachmentId, { blob: sceneToFile(scene), preview: await sceneToSvgString(scene) });`
  - then close the modal.
- Render `<ExcalidrawDialog key={attachmentId ?? 'new'} open={...} mode={...} initialScene={...} onSave={onSave} onDelete={onDelete} onClose={() => setOpen(false)} t={t} />`.

- [x] **Step 3: Tests + build**

Run: `pnpm test src/components/editor/editor.test.tsx && pnpm build`
Expected: green (new-drawing Save creates + inserts; edit Save calls `updateAttachment`).

- [x] **Step 4: Commit**

```bash
git add src/components/editor/extensions/attachments/deps.ts src/components/editor/editor.tsx src/components/editor/editor.test.tsx
git commit -m "[ADD] openExcalidraw deps + modal orchestration (commit-on-Save)"
```

---

## Task 15: Rewrite `ExcalidrawNodeView` - passive live-queried preview

**Files:**
- Modify: `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.tsx`
- Modify: `src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx`

**Interfaces:**
- Consumes: `deps.openExcalidraw` (Task 14), a live read of the attachment row (Dexie `useLiveQuery` via `db.attachments.get(id)` or an existing live hook), `ConfirmDeleteButton`, `Attachment.preview`.
- Produces: preview-only NodeView (no `<Excalidraw>` import, no write-back).

- [x] **Step 1: Rewrite the test**

Drop the canvas-mount + debounced-write-back assertions. Assert instead:
1. Renders the live-queried `preview` SVG.
2. Clicking the preview surface calls `deps.openExcalidraw({ attachmentId, onDelete: <fn> })`.
3. The corner-X (`ConfirmDeleteButton`) confirm calls `props.deleteNode()` and, because it is a sibling of the surface, does **not** call `openExcalidraw`.
4. Missing row -> the unavailable box (with delete).

- [x] **Step 2: Run to verify it fails**

Run: `pnpm test src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx`
Expected: FAIL (old behavior asserted / new behavior missing).

- [x] **Step 3: Implement the preview NodeView**

- Live-query the attachment row for its `preview` (Dexie `useLiveQuery`). Loading -> pulse box; missing -> unavailable box + delete; ready -> the SVG surface.
- Wrap the SVG in a `cursor-pointer` surface (a native `<button>` when editable, so keyboard + `aria-label` come for free; `onClick` -> `deps.openExcalidraw({ attachmentId, onDelete: () => props.deleteNode() })`), inject `preview` via `dangerouslySetInnerHTML` after running it through `DOMPurify.sanitize` (matches the read-only `NoteBody` trust model), `contentEditable={false}`.
- The surface sits in a `relative inline-block max-w-full` frame so the border and the delete overlay **shrink-wrap the drawing** instead of spanning the editor width.
- Overlay the always-visible top-right `ConfirmDeleteButton`. It is a DOM sibling of the surface (not a descendant), so a delete tap never reaches the surface's open handler - no `stopPropagation` needed. It is styled larger and destructive-red for visibility on top of the drawing via the shared button's `triggerClassName`/`iconClassName` props.
- Remove the `@excalidraw/excalidraw` import, `sceneToFile`/`sceneToSvgString` usage, the debounce refs, and the unmount flush.

- [x] **Step 4: Run to verify it passes + full suite + build**

Run: `pnpm test && pnpm build`
Expected: green.

- [x] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.tsx src/components/editor/extensions/Excalidraw/ExcalidrawNodeView.test.tsx
git commit -m "[EDIT] ExcalidrawNodeView -> passive live-queried preview"
```

---

## Task 16: Rewrite `ExcalidrawButton` - open empty modal (no eager create)

**Files:**
- Modify: `src/components/editor/extensions/Excalidraw/ExcalidrawButton.tsx`
- Modify: `src/components/editor/extensions/Excalidraw/ExcalidrawButton.test.tsx`

**Interfaces:**
- Consumes: `deps.openExcalidraw`. No longer calls `getNoteId`/`createAttachment`/insert.
- Produces: an `ActionButton` (icon `PenTool`) whose action is `getDeps().openExcalidraw({})`.

- [x] **Step 1: Rewrite the test**

Assert clicking the button calls `openExcalidraw({})` and does **not** call `createAttachment` or the insert command.

- [x] **Step 2: Run to verify it fails**; **Step 3: Implement** (`action: () => getDeps().openExcalidraw({})`); **Step 4: Run + build**.

- [x] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Excalidraw/ExcalidrawButton.tsx src/components/editor/extensions/Excalidraw/ExcalidrawButton.test.tsx
git commit -m "[EDIT] ExcalidrawButton opens empty modal (commit-on-Save)"
```

---

## Task 17: Manual verification + docs

**Files:**
- Modify: `src/components/editor/CLAUDE.md` (correct the Excalidraw paragraph to the modal architecture)

- [x] **Step 1: Manual E2E** (no Playwright on this project - verify by hand): click the drawing button -> modal opens (styled canvas, not broken); draw -> Save enabled; Save -> preview appears inline; tap preview -> modal reopens with the scene; edit + Save -> preview updates (live); Cancel while dirty -> discard-confirm; Delete (modal + corner-X) -> node gone + confirm; empty new drawing -> Save disabled, Cancel leaves nothing; mobile fullscreen; desktop large. Check light/dark.
- [x] **Step 2: Update `src/components/editor/CLAUDE.md`** - replace the inline-canvas Excalidraw description with the modal model: passive live-queried SVG preview node (tap-to-edit, corner-X delete), single shared `ExcalidrawDialog` owned by `editor.tsx` opened via `deps.openExcalidraw`, commit-on-Save (create+insert on new / `updateAttachment` on edit), guarded Save/Cancel/Delete, `@excalidraw/excalidraw/index.css` imported in the dialog.
- [x] **Step 3:** `pnpm check:ci && pnpm test && pnpm build` green.
- [x] **Step 4: Commit**

```bash
git add src/components/editor/CLAUDE.md
git commit -m "[DOC] Document Excalidraw modal editing architecture"
```

---

## Phase 2 self-review notes

- **CSS import (Task 12)** is the single highest-value fix and is independent of the modal rework - it must land or the canvas is broken anywhere it mounts.
- **Verb separation** (Save/Cancel/Delete) is a hard requirement - reviewers should reject any path where Save can delete or Cancel can persist.
- **Live-query preview (Task 15)** is what makes edit-Save reflect without dirtying the body - do not "fix" a stale preview by bumping a node attribute.
- **Kept-from-Phase-1** items (`scene.ts`, `updateAttachment`, validation, node/factory, `NoteBody` injection) are deliberately untouched.

### Post-E2E refinements (from manual verification)

- **Preview shrink-wraps the drawing.** The border/overlay frame is `relative inline-block max-w-full` (not full editor width), so the border hugs the SVG and the delete button lands on the drawing itself.
- **Delete button visibility.** The overlaid `ConfirmDeleteButton` is enlarged and destructive-red via new optional `triggerClassName`/`iconClassName` props on the shared component (default look unchanged for image/audio/video/file).
- **Preview sanitization.** The inline preview SVG is run through `DOMPurify.sanitize` before `dangerouslySetInnerHTML`, matching the read-only `NoteBody` path (both now depend on `dompurify`).
