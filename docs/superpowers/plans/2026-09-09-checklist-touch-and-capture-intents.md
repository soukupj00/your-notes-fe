# Checklist Touch and Capture Intents - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A phone user can tick, reorder and edit a Checklist without mis-taps, every Start on the speed dial asks for its permission on the tap itself, the camera is a Start of its own, and opening an existing Note no longer raises the keyboard.

**Architecture:** Seven independent changes, one commit each. The checkbox and hit box shrink to 32px in CSS. The Card's whole item row becomes the tick control and long-press opens the Note. A new `TaskItem` extension (Pattern A) owns a `moveTaskItem` command and a grip node view driven by pointer events. The audio recorder moves out of the toolbar button into an always-mounted host inside the Editor. Picker Starts open the OS picker inside the tap and hand the files to the Editor as an open intent. The dialog stops focusing the title for an existing Note on a Coarse pointer. Playwright specs cover the three user flows.

**Tech Stack:** React 19, TipTap 3 (`@tiptap/extension-list`), Vitest + jsdom + `fake-indexeddb`, Playwright, Tailwind v4, i18next.

**Spec:** The grilling session of 2026-09-09 (this file is its record). Glossary terms **Card**, **Start**, **Checklist**, **Sinking**, **Pointer Class** in [`CONTEXT.md`](../../../CONTEXT.md). The 44px Touch Rule in [`DESIGN.md`](../../../DESIGN.md). Sinking in [ADR 0013](../../adr/0013-checklist-sinking-is-presentation-not-storage.md). Pattern A in [ADR 0004](../../adr/0004-canonical-editor-toolbar-pattern.md).

## Global Constraints

- Package manager is `pnpm`; never npm or yarn.
- Never use the em dash; plain `-` only, in code, comments, docs and translations.
- Never add a `Co-Authored-By` trailer to commits.
- `pnpm check` (Biome) must pass on every commit; the pre-commit hook runs it on staged files.
- `pnpm test` and `pnpm tsc --noEmit -p tsconfig.json` (the `build` script runs `tsc`) must pass before every commit.
- Keep files under 500 lines.
- Every user-facing string goes in **both** `public/locales/en/translation.json` and `public/locales/cs/translation.json`; `src/i18n.test.ts` fails otherwise.
- New icons are registered by name in `src/components/icons/icons.ts`; never import a Lucide icon in an extension button config.
- The Card and the Editor render the same Checklist markup and share the `.prose` CSS; nothing may make them read differently.
- The stored Body is never given a grip, a drag class or any other editor-only markup. Node-view DOM is not serialised; `renderHTML` is, and it is untouched.
- Coarse pointer means `@media (pointer: coarse)` in CSS and `useFinePointer() === false` in React. Never a viewport width.

## File structure

```
src/styles/globals.css                                    checklist box, hit box, grip, drag styles   (Tasks 1, 3)
DESIGN.md                                                 32px exception to the Touch Rule            (Task 1)
src/lib/long-press.ts (+ .test.ts)                        attachLongPress(el, opts): pointer timer     (Task 2)
src/components/cards/NoteCard.tsx (+ .test.tsx)           whole-row tick, long-press opens            (Task 2)
src/components/editor/extensions/TaskItem/
  TaskItem.ts (+ .test.ts)                                extension: moveTaskItem command + grip view (Task 3)
  taskItemDrag.ts (+ .test.ts)                            dropIndex() and the pointer gesture         (Task 3)
  index.ts                                                                                            (Task 3)
src/components/editor/extensions/build.ts                 registers ./TaskItem instead of upstream    (Task 3)
src/components/editor/extensions/Audio/
  audioCapture.ts (+ .test.ts)                            coordinator gains recording status          (Task 4)
  AudioRecorderHost.tsx (+ .test.tsx)                     owns useAudioRecorder + the recording panel (Task 4)
  AudioRecordButton.tsx (+ .test.tsx)                     becomes a plain button                      (Task 4)
src/components/editor/editor.tsx                          mounts the host; initialFiles intent        (Tasks 4, 5)
src/components/notes/quickCaptureActions.ts               camera Start, picker descriptors            (Task 5)
src/components/notes/useStartPicker.tsx                   the hidden input both bars share            (Task 5)
src/components/notes/QuickCaptureBar.tsx (+ .test.tsx)    picker Starts open the input on tap         (Task 5)
src/components/notes/DesktopCaptureBar.tsx                same                                        (Task 5)
src/components/notes/NotesView.tsx                        files intent replaces capture 'picture'     (Task 5)
src/components/notes/NoteEditorDialog.tsx (+ .test.tsx)   initialFiles; no title focus on Coarse      (Tasks 5, 6)
src/components/editor/extensions/Image/ImageButton.tsx    accept="image/*"                            (Task 5)
public/locales/{en,cs}/translation.json                   camera, image, grip, recording strings      (Tasks 3, 4, 5)
e2e/helpers.ts                                            skipTour(page)                              (Task 7)
e2e/checklist.spec.ts, e2e/capture.spec.ts, e2e/editor-focus.spec.ts                                  (Task 7)
```

---

### Task 1: A 32px checkbox with a 32px hit box

**Files:**
- Modify: `src/styles/globals.css` (the `@media (pointer: coarse)` block after "The 44px Touch Rule (DESIGN.md) reaches into the note body", around line 1011-1052, and the `accent-color` rule around line 929)
- Modify: `DESIGN.md` (the 44px Touch Rule paragraph, around line 262)

**Interfaces:**
- Produces: nothing programmatic. Task 3's grip CSS sits next to these rules.

This is purely visual, so it is build-then-check (ADR 0003). The rule being replaced is the 44px-wide `::before` anchored at the row's left edge; the text starts about 20px in, so the first letters of every item belonged to the checkbox.

- [ ] **Step 1: Replace the coarse-pointer block**

Replace the whole `@media (pointer: coarse) { ... }` block that follows the "The 44px Touch Rule (DESIGN.md) reaches into the note body" comment, and the comment itself, with:

```css
/* The checklist box on a Coarse pointer. The 44px Touch Rule (DESIGN.md) has one
   recorded exception here, and the reason is what the rule is for: a 44px hit
   box anchored at the row's left edge reached ~24px into the text, so a tap on
   the first letters of an item ticked it instead of placing the caret. The box
   is drawn at 32px and its hit box is exactly the box: what you see is what you
   tap, and the text is the text.

   Both surfaces, deliberately. A checklist should not feel like a different
   control depending on whether you are reading it or writing it.

   32 rather than 44 was chosen on 2026-09-09 with the option of growing it if
   mis-taps show up; grow the box, never a hidden halo over the text. */
@media (pointer: coarse) {
  .prose ul[data-type="taskList"] li > label {
    @apply mt-0 flex h-8 w-8 flex-none items-center justify-center;
  }

  .prose ul[data-type="taskList"] li > label input[type="checkbox"] {
    @apply m-0 size-8;
  }

  /* The row is at least as tall as its box so a one-line item is not a 20px line
     beside a 32px square with the text riding its top edge. */
  .prose ul[data-type="taskList"] li > div {
    @apply min-h-8 self-center;
  }
}
```

- [ ] **Step 2: Record the exception in DESIGN.md**

In `DESIGN.md`, append to the 44px Touch Rule paragraph (the one that ends "This is the second thing to fix in the redesign."), as its own line:

```markdown
One recorded exception, measured on 2026-09-09: the Checklist box is 32x32 with a hit box of exactly its own size, on both the Card and the Editor. A 44px hit box anchored at the row's edge overlapped the first letters of the item, so a tap meant to place the caret ticked the box instead. If mis-taps show up, grow the visible box; never restore an invisible halo over the text.
```

- [ ] **Step 3: Check, typecheck, test**

Run: `pnpm check && pnpm test`
Expected: Biome clean; every Vitest suite green (`globals.test.ts` reads the stylesheet and must still pass).

- [ ] **Step 4: Look at it**

Run `pnpm dev`, open a Checklist in Chrome DevTools device mode (Pixel 7). Expect a 32px box with the text starting immediately after it; a tap on the first letter places the caret. Check the Card too.

- [ ] **Step 5: Commit**

```bash
git add src/styles/globals.css DESIGN.md
git commit -m "[EDIT] Checklist box is 32px with a 32px hit box, so the first letters of an item are text again"
```

---

### Task 2: The whole Card row ticks, long-press opens

**Files:**
- Create: `src/lib/long-press.ts`, `src/lib/long-press.test.ts`
- Modify: `src/components/cards/NoteCard.tsx` (`handleChecklistClick`, around lines 85-122; the effect after it)
- Modify: `src/components/cards/NoteCard.test.tsx` (`describe('checklist (ADR 0013)')`, around line 461)
- Modify: `src/styles/globals.css` (one rule beside Task 1's block)

**Interfaces:**
- Produces: `attachLongPress(el: HTMLElement, opts: { isTarget(target: Element): boolean; onLongPress(target: Element): void; delayMs?: number }): () => void`. Returns the detach function. Fires once per press, only for `pointerType !== 'mouse'`, cancels on pointer up/cancel/leave or movement over 10px, and suppresses the click and contextmenu that follow a fired press.

- [ ] **Step 1: Write the failing long-press tests**

`src/lib/long-press.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachLongPress } from './long-press';

function pointer(type: string, target: Element, init: Partial<PointerEventInit> = {}) {
  target.dispatchEvent(
    new PointerEvent(type, { bubbles: true, pointerType: 'touch', clientX: 0, clientY: 0, ...init })
  );
}

describe('attachLongPress', () => {
  let root: HTMLDivElement;
  let row: HTMLLIElement;
  let onLongPress: ReturnType<typeof vi.fn>;
  let detach: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    row = document.createElement('li');
    root.append(row);
    document.body.append(root);
    onLongPress = vi.fn();
    detach = attachLongPress(root, { isTarget: (t) => t === row, onLongPress, delayMs: 500 });
  });

  afterEach(() => {
    detach();
    root.remove();
    vi.useRealTimers();
  });

  it('fires after the delay when the finger holds still', () => {
    pointer('pointerdown', row);
    vi.advanceTimersByTime(499);
    expect(onLongPress).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledWith(row);
  });

  it('does not fire when the finger lifts first', () => {
    pointer('pointerdown', row);
    vi.advanceTimersByTime(200);
    pointer('pointerup', row);
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('does not fire when the finger travels, because that is a scroll', () => {
    pointer('pointerdown', row);
    pointer('pointermove', row, { clientX: 0, clientY: 15 });
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores a mouse, whose press-and-hold is text selection', () => {
    pointer('pointerdown', row, { pointerType: 'mouse' });
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('ignores a press outside its targets', () => {
    pointer('pointerdown', root);
    vi.advanceTimersByTime(500);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('swallows the click and context menu that follow a fired press', () => {
    pointer('pointerdown', row);
    vi.advanceTimersByTime(500);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    row.dispatchEvent(menu);
    row.dispatchEvent(click);
    expect(menu.defaultPrevented).toBe(true);
    expect(click.defaultPrevented).toBe(true);
    // Only the one press: the next click goes through.
    const next = new MouseEvent('click', { bubbles: true, cancelable: true });
    row.dispatchEvent(next);
    expect(next.defaultPrevented).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/lib/long-press.test.ts`
Expected: FAIL, "Failed to resolve import ./long-press".

- [ ] **Step 3: Implement `attachLongPress`**

`src/lib/long-press.ts`:

```ts
export interface LongPressOptions {
  /** Which element under the pointer counts. Receives the event target. */
  isTarget: (target: Element) => boolean;
  onLongPress: (target: Element) => void;
  delayMs?: number;
}

const DEFAULT_DELAY_MS = 500;
/** Movement past this is a scroll, not a hold. */
const SLOP_PX = 10;

/**
 * Press-and-hold on a touch pointer, attached once to a container and delegated
 * to whichever descendant `isTarget` accepts - the same shape as the Card's
 * click delegate, because the rows it watches are `innerHTML` with no React
 * elements to hand a handler to.
 *
 * Mouse pointers are ignored: press-and-hold with a mouse is how text is
 * selected, and the Card's rows are readable text.
 *
 * After a press fires, the click and contextmenu the platform sends next are
 * swallowed once, so opening the Note does not also tick the row underneath and
 * Android's long-press menu does not appear over the dialog.
 */
export function attachLongPress(el: HTMLElement, opts: LongPressOptions): () => void {
  const delay = opts.delayMs ?? DEFAULT_DELAY_MS;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let origin: { x: number; y: number } | null = null;
  let fired = false;

  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    origin = null;
  };

  const onDown = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') return;
    const target = event.target as Element | null;
    if (!target || !opts.isTarget(target)) return;
    cancel();
    fired = false;
    origin = { x: event.clientX, y: event.clientY };
    timer = setTimeout(() => {
      timer = null;
      origin = null;
      fired = true;
      opts.onLongPress(target);
    }, delay);
  };

  const onMove = (event: PointerEvent) => {
    if (!origin) return;
    if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > SLOP_PX) cancel();
  };

  const swallow = (event: Event) => {
    if (!fired) return;
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'click') fired = false;
  };

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', cancel);
  el.addEventListener('pointercancel', cancel);
  el.addEventListener('pointerleave', cancel);
  // Capture phase: the contextmenu has to be stopped before the browser's own
  // menu, and the click before the delegate that would tick the row.
  el.addEventListener('contextmenu', swallow, true);
  el.addEventListener('click', swallow, true);

  return () => {
    cancel();
    el.removeEventListener('pointerdown', onDown);
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerup', cancel);
    el.removeEventListener('pointercancel', cancel);
    el.removeEventListener('pointerleave', cancel);
    el.removeEventListener('contextmenu', swallow, true);
    el.removeEventListener('click', swallow, true);
  };
}
```

- [ ] **Step 4: Run the long-press tests**

Run: `pnpm vitest run src/lib/long-press.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Rewrite the Card checklist tests**

In `src/components/cards/NoteCard.test.tsx`, inside `describe('checklist (ADR 0013)')`, replace the test `'still opens the note when the row’s text is clicked'` with these two, and add the imports `act` from `@testing-library/react` if not already imported:

```tsx
    it('ticks when the row’s text is clicked, and does not open the note', async () => {
      // The whole row is the control (CONTEXT.md, Card): a thumb aims at the
      // words, not at a 32px square beside them.
      const note = makeNote({ body: checklist(['Milk', false]) });
      await testStore.notes.put(note);
      const onSelect = vi.fn();
      render(<NoteCard note={note} onSelect={onSelect} />);

      await userEvent.click(screen.getByText('Milk'));

      await waitFor(async () => {
        expect(await storedBody(note.id)).toContain('data-checked="true"');
      });
      expect(onSelect).not.toHaveBeenCalled();
      expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    });

    it('opens the note from a long press on the row', async () => {
      vi.useFakeTimers();
      try {
        const note = makeNote({ body: checklist(['Milk', false]) });
        await testStore.notes.put(note);
        const onSelect = vi.fn();
        render(<NoteCard note={note} onSelect={onSelect} />);
        const row = screen.getByText('Milk').closest('li') as HTMLElement;

        row.dispatchEvent(
          new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' })
        );
        await act(async () => {
          vi.advanceTimersByTime(500);
        });

        expect(onSelect).toHaveBeenCalledWith(note.id);
        expect(await storedBody(note.id)).toContain('data-checked="false"');
      } finally {
        vi.useRealTimers();
      }
    });
```

The existing tests `'ticks an item from the card and persists it'`, `'does not open the note when the box itself is clicked'` and `'ticks from the keyboard...'` stay as they are.

- [ ] **Step 6: Run the Card tests to see the two fail**

Run: `pnpm vitest run src/components/cards/NoteCard.test.tsx`
Expected: FAIL on the two new tests only (the text click opens the note; the long press does nothing).

- [ ] **Step 7: Make the row the control**

In `src/components/cards/NoteCard.tsx`, change `handleChecklistClick`:

```tsx
  /**
   * Ticking a checklist item without opening the note (ADR 0013).
   *
   * Delegated because the body is `innerHTML`, so there is nothing to attach a
   * per-item handler to.
   *
   * The whole row is the control (CONTEXT.md, Card). The native box flips
   * itself when it is the thing tapped; when the text is, the box is set here
   * so the tap is answered on the same frame either way, and the re-render
   * that follows the write sets it from the attribute regardless.
   */
  const handleChecklistClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const root = proseRef.current;
      if (!root) return;
      const target = event.target as Element;
      const item = target.closest('li[data-type="taskItem"]');
      if (!item) return;

      event.stopPropagation();

      const index = checklistItemIndexAt(root, item);
      if (index === null) return;
      const checked = item.getAttribute('data-checked') !== 'true';
      const box = item.querySelector<HTMLInputElement>('input[type="checkbox"]');
      if (box) box.checked = checked;
      const nextBody = setChecklistItemChecked(bodyRef.current, index, checked);
      if (!nextBody) return;
      bodyRef.current = nextBody;

      // Measured now, while the DOM still shows the old order. The write is what
      // moves it: the live query echoes a new body, `NoteBody` re-renders, and
      // the CSS `order` rule re-lays-out the list.
      flipRef.current = reducedMotion ? null : captureRows(root);
      void updateNote(note.id, { body: nextBody });
    },
    [note.id, updateNote, reducedMotion]
  );
```

Then add the long-press effect right after the `useLayoutEffect` that plays the FLIP (before `const open = ...`), and import `attachLongPress` from `@/lib/long-press.ts` and `useEffect` from React:

```tsx
  // Press-and-hold on a row opens the note, because the tap now ticks it. The
  // prose is rebuilt on every body change, but the listener sits on the
  // container `NoteBody` keeps, so it survives the rebuild.
  useEffect(() => {
    const root = proseRef.current;
    if (!root) return;
    return attachLongPress(root, {
      isTarget: (target) => target.closest('li[data-type="taskItem"]') !== null,
      onLongPress: () => onSelect(note.id),
    });
  }, [note.id, onSelect]);
```

Note `hasProse` gates the `NoteBody`; when it is false `proseRef.current` is null and the effect is a no-op, which is right.

- [ ] **Step 8: Stop the platform selecting the row during the hold**

In `src/styles/globals.css`, inside Task 1's `@media (pointer: coarse)` block, add:

```css
  /* A Card row is a control on a Coarse pointer: no text selection and no
     touch callout during the press that opens the note. Card only: in the
     Editor the row is text and the hold is how a caret is placed. */
  .note-card-body ul[data-type="taskList"] li {
    -webkit-touch-callout: none;
    user-select: none;
  }
```

- [ ] **Step 9: Run the Card tests and the whole suite**

Run: `pnpm vitest run src/components/cards/NoteCard.test.tsx && pnpm check && pnpm test`
Expected: all PASS.

- [ ] **Step 10: Commit**

```bash
git add src/lib/long-press.ts src/lib/long-press.test.ts src/components/cards/NoteCard.tsx src/components/cards/NoteCard.test.tsx src/styles/globals.css
git commit -m "[EDIT] A Card's checklist row is the control: tap ticks it, press-and-hold opens the note"
```

---

### Task 3: The `TaskItem` extension - a move command and a grip that works under a finger

**Files:**
- Create: `src/components/editor/extensions/TaskItem/TaskItem.ts`, `TaskItem.test.ts`, `taskItemDrag.ts`, `taskItemDrag.test.ts`, `index.ts`
- Modify: `src/components/editor/extensions/build.ts` (line 3 import, line 83 registration)
- Modify: `src/styles/globals.css` (grip and drag rules beside the task-list rules, around line 905)
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json` (under `editor`, a new `taskItem` object)
- Modify: `src/components/icons/icons.ts` is **not** touched: the grip is DOM built by a node view, so it embeds the SVG path directly (see Step 7).

**Interfaces:**
- Produces: `editor.commands.moveTaskItem({ pos, to })` - `pos` is the document position of a `taskItem` node, `to` is the child index it should occupy in its list **after** it has been removed. Returns false when `pos` is not a task item or `to` is out of range.
- Produces: `dropIndex(stored: number, candidates: number[], slot: number): number` - pure; `stored` is the dragged item's child index, `candidates` the stored indices of the rows it may land among in their **visual** order (its group, excluding itself), `slot` how many candidates it was dropped after. Returns the `to` for `moveTaskItem`.
- Produces: `startTaskItemDrag(args)` - the gesture; see Step 7.

- [ ] **Step 1: Write the failing `dropIndex` tests**

`src/components/editor/extensions/TaskItem/taskItemDrag.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { dropIndex } from './taskItemDrag';

/**
 * `dropIndex` turns "dropped after N of these rows" into the child index the
 * item takes once it has been removed from the list. The rows it may land among
 * are its own group (ADR 0013: with sinking on, checked and unchecked are shown
 * apart, so an item only ever moves within its half), in visual order.
 */
describe('dropIndex', () => {
  it('moves down: dropped after a later row', () => {
    // stored [A B C D], drag A after C -> [B C A D]
    expect(dropIndex(0, [1, 2, 3], 2)).toBe(2);
  });

  it('moves up: dropped before an earlier row', () => {
    // stored [A B C D], drag D before B -> [A D B C]
    expect(dropIndex(3, [0, 1, 2], 1)).toBe(1);
  });

  it('returns the same index when dropped where it was', () => {
    expect(dropIndex(1, [0, 2, 3], 1)).toBe(1);
  });

  it('lands at the very end', () => {
    expect(dropIndex(0, [1, 2, 3], 3)).toBe(3);
  });

  it('keeps to its group: a checked item shown at the bottom moves among the checked only', () => {
    // stored [u0 c1 u2 c3 c4], sinking shows [u0 u2 | c1 c3 c4]. Drag c4 to the
    // top of the checked group -> it goes before c1 -> stored index 1.
    expect(dropIndex(4, [1, 3], 0)).toBe(1);
  });

  it('is a no-op with nothing to land among', () => {
    expect(dropIndex(2, [], 0)).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/components/editor/extensions/TaskItem/taskItemDrag.test.ts`
Expected: FAIL, cannot resolve `./taskItemDrag`.

- [ ] **Step 3: Write the failing `moveTaskItem` tests**

`src/components/editor/extensions/TaskItem/TaskItem.test.ts`:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskItem } from './TaskItem';

const item = (label: string, checked = false) =>
  `<li data-type="taskItem" data-checked="${checked}"><p>${label}</p></li>`;
const list = (...items: string[]) => `<ul data-type="taskList">${items.join('')}</ul>`;

/** Labels in stored order, which is what the command changes. */
function labels(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'taskItem') out.push(node.textContent);
  });
  return out;
}

/** Document position of the nth task item. */
function posOf(editor: Editor, index: number): number {
  let n = 0;
  let found = -1;
  editor.state.doc.descendants((node, pos) => {
    if (found >= 0) return false;
    if (node.type.name === 'taskItem') {
      if (n === index) found = pos;
      n++;
    }
  });
  return found;
}

describe('TaskItem extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Paragraph, Text, TaskList, TaskItem],
      content: list(item('A'), item('B', true), item('C')),
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('moveTaskItem moves an item down to the given index', () => {
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: 2 })).toBe(true);
    expect(labels(editor)).toEqual(['B', 'C', 'A']);
  });

  it('moveTaskItem moves an item up to the given index', () => {
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 2), to: 0 })).toBe(true);
    expect(labels(editor)).toEqual(['C', 'A', 'B']);
  });

  it('keeps the checked state of the moved item', () => {
    editor.commands.moveTaskItem({ pos: posOf(editor, 1), to: 0 });
    expect(editor.getHTML()).toMatch(/^<ul data-type="taskList"><li data-type="taskItem" data-checked="true">/);
  });

  it('is one undo step', () => {
    // History is not registered here; the command must be a single transaction
    // so that when it is, one Undo puts the item back.
    let transactions = 0;
    editor.on('transaction', () => {
      transactions += 1;
    });
    editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: 2 });
    expect(transactions).toBe(1);
  });

  it('refuses a position that is not a task item', () => {
    expect(editor.commands.moveTaskItem({ pos: 0, to: 1 })).toBe(false);
    expect(labels(editor)).toEqual(['A', 'B', 'C']);
  });

  it('refuses an index outside the list', () => {
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: 3 })).toBe(false);
    expect(editor.commands.moveTaskItem({ pos: posOf(editor, 0), to: -1 })).toBe(false);
  });

  it('serialises no grip: the stored Body is the same markup as before', () => {
    expect(editor.getHTML()).not.toContain('button');
    expect(editor.getHTML()).not.toContain('grip');
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `pnpm vitest run src/components/editor/extensions/TaskItem/TaskItem.test.ts`
Expected: FAIL, cannot resolve `./TaskItem`.

- [ ] **Step 5: Implement `dropIndex` and the gesture**

`src/components/editor/extensions/TaskItem/taskItemDrag.ts`:

```ts
/**
 * The child index an item takes after being removed and dropped after `slot` of
 * its `candidates` - the rows it may land among, as **stored** indices in
 * **visual** order. Indices above the item's own shift down by one once it is
 * gone, which is the whole of the arithmetic.
 */
export function dropIndex(stored: number, candidates: number[], slot: number): number {
  if (candidates.length === 0) return stored;
  const afterRemoval = (index: number) => (index > stored ? index - 1 : index);
  if (slot < candidates.length) return afterRemoval(candidates[slot]);
  return afterRemoval(candidates[candidates.length - 1]) + 1;
}

export interface TaskItemDragArgs {
  /** The pointerdown that begins the gesture, on the grip. */
  event: PointerEvent;
  /** The `<li>` being dragged. */
  item: HTMLElement;
  /** Called on drop with the child index for `moveTaskItem`, or not at all when nothing moved. */
  onDrop: (to: number) => void;
}

const DRAGGING = 'task-item-dragging';
const DROP_BEFORE = 'task-item-drop-before';
const DROP_AFTER = 'task-item-drop-after';

/**
 * Reorder by pointer, not by HTML5 drag. HTML5 drag never fires on touch, which
 * is why the previous grip could not move a row on a phone; pointer events are
 * the one model a finger and a mouse share.
 *
 * The row travels with the pointer (a transform, so the document is untouched
 * until the drop) and a line marks the slot it will land in. The slot is
 * chosen among the row's own group - with sinking on, checked rows are shown
 * apart from unchecked ones (ADR 0013), so a row only ever lands among rows it
 * is displayed with, and `dropIndex` maps the visual slot back to stored order.
 */
export function startTaskItemDrag({ event, item, onDrop }: TaskItemDragArgs): void {
  const list = item.parentElement;
  if (!list) return;
  const grip = event.currentTarget as HTMLElement;
  const rows = Array.from(list.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement && el !== item
  );
  const group = item.dataset.checked;
  const sinking = document.documentElement.hasAttribute('data-sink-checked');
  const candidates = rows
    .filter((row) => !sinking || row.dataset.checked === group)
    .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
  const stored = Array.from(list.children).indexOf(item);
  const storedOf = (row: HTMLElement) => Array.from(list.children).indexOf(row);

  const startY = event.clientY;
  let slot = candidates.findIndex((row) => storedOf(row) > stored && !sinking) ;
  if (slot < 0) slot = candidates.filter((row) => storedOf(row) < stored).length;
  const initialSlot = slot;

  const clearMarks = () => {
    for (const row of candidates) row.classList.remove(DROP_BEFORE, DROP_AFTER);
  };
  const mark = () => {
    clearMarks();
    if (candidates.length === 0) return;
    if (slot < candidates.length) candidates[slot].classList.add(DROP_BEFORE);
    else candidates[candidates.length - 1].classList.add(DROP_AFTER);
  };

  const onMove = (move: PointerEvent) => {
    item.style.transform = `translateY(${move.clientY - startY}px)`;
    slot = candidates.filter((row) => {
      const rect = row.getBoundingClientRect();
      return rect.top + rect.height / 2 < move.clientY;
    }).length;
    mark();
  };

  const finish = (dropped: boolean) => {
    grip.removeEventListener('pointermove', onMove);
    grip.removeEventListener('pointerup', onUp);
    grip.removeEventListener('pointercancel', onCancel);
    if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
    item.style.transform = '';
    item.classList.remove(DRAGGING);
    clearMarks();
    if (dropped && slot !== initialSlot) {
      onDrop(dropIndex(stored, candidates.map(storedOf), slot));
    }
  };
  const onUp = () => finish(true);
  const onCancel = () => finish(false);

  event.preventDefault();
  grip.setPointerCapture(event.pointerId);
  item.classList.add(DRAGGING);
  grip.addEventListener('pointermove', onMove);
  grip.addEventListener('pointerup', onUp);
  grip.addEventListener('pointercancel', onCancel);
}
```

Then fix the `initialSlot` computation, which the draft above gets wrong for the sinking case. Replace the three lines from `let slot = ...` through `const initialSlot = slot;` with:

```ts
  // Where the row already sits among its candidates, so a drop back into the
  // same slot is a no-op rather than a spurious transaction.
  let slot = candidates.filter((row) => row.getBoundingClientRect().top < item.getBoundingClientRect().top).length;
  const initialSlot = slot;
```

- [ ] **Step 6: Run the `dropIndex` tests**

Run: `pnpm vitest run src/components/editor/extensions/TaskItem/taskItemDrag.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Implement the extension**

`src/components/editor/extensions/TaskItem/TaskItem.ts`:

```ts
import { type TaskItemOptions, TaskItem as TiptapTaskItem } from '@tiptap/extension-list';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { startTaskItemDrag } from './taskItemDrag';

export interface TaskItemExtensionOptions extends TaskItemOptions {
  /** Accessible name for the grip. Read at render time so the locale is live. */
  gripLabel: () => string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    taskItem: {
      /**
       * Move the task item at `pos` so it becomes child `to` of its list, `to`
       * being counted after the item has been removed.
       */
      moveTaskItem: (attrs: { pos: number; to: number }) => ReturnType;
    };
  }
}

/** Lucide `grip-vertical`, inlined: this DOM is built by a node view, not React. */
const GRIP_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/>' +
  '<circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>';

/**
 * The upstream task item plus the two things a checklist needs to be reordered
 * by hand: a `moveTaskItem` command, and a grip in the editable node view that
 * drives it by pointer events (touch and mouse alike) or by arrow keys.
 *
 * The grip lives in the node view's DOM only. `renderHTML` is the upstream one,
 * so the stored Body and the Card's markup are unchanged, and the Card's
 * `.prose` rules never see a grip.
 */
export const TaskItem = TiptapTaskItem.extend<TaskItemExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      gripLabel: () => 'Reorder',
    };
  },

  addCommands() {
    return {
      ...this.parent?.(),
      moveTaskItem:
        ({ pos, to }) =>
        ({ tr, dispatch }) => {
          const node = tr.doc.nodeAt(pos);
          if (!node || node.type.name !== this.name) return false;
          const $pos = tr.doc.resolve(pos);
          const list = $pos.parent;
          if (to < 0 || to > list.childCount - 1) return false;
          const from = $pos.index();
          if (from === to) return true;
          if (!dispatch) return true;

          const listStart = $pos.start();
          tr.delete(pos, pos + node.nodeSize);
          // Offsets in the list after the removal.
          let insertAt = listStart;
          const remaining = tr.doc.resolve(listStart).parent;
          for (let i = 0; i < to; i++) insertAt += remaining.child(i).nodeSize;
          tr.insert(insertAt, node);
          return true;
        },
    };
  },

  addNodeView() {
    const parent = this.parent?.();
    if (!parent) return null;
    return (props) => {
      const view = parent(props);
      const { editor, getPos } = props;
      if (!editor.isEditable || typeof getPos !== 'function' || !('dom' in view)) return view;

      const item = view.dom as HTMLElement;
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'task-item-grip';
      grip.contentEditable = 'false';
      grip.setAttribute('aria-label', this.options.gripLabel());
      grip.innerHTML = GRIP_SVG;

      const move = (to: number) => {
        const pos = getPos();
        if (typeof pos === 'number') editor.commands.moveTaskItem({ pos, to });
      };
      grip.addEventListener('pointerdown', (event) => {
        startTaskItemDrag({ event, item, onDrop: move });
      });
      // The keyboard path, so a grip that can be focused can also be used.
      grip.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
        event.preventDefault();
        const pos = getPos();
        if (typeof pos !== 'number') return;
        const index = editor.state.doc.resolve(pos).index();
        move(event.key === 'ArrowUp' ? Math.max(0, index - 1) : index + 1);
        grip.focus();
      });

      item.prepend(grip);

      return {
        ...view,
        // The grip is ours, not the document's: ProseMirror must neither treat
        // its events as edits nor re-render the node when it changes.
        stopEvent: (event: Event) =>
          grip.contains(event.target as Node) || (view.stopEvent?.(event) ?? false),
        ignoreMutation: (mutation) =>
          grip.contains(mutation.target) || (view.ignoreMutation?.(mutation) ?? false),
      };
    };
  },
});

export type { ProseMirrorNode };
```

Remove the last line (`export type { ProseMirrorNode }`) and the `ProseMirrorNode` import if Biome flags them unused; they are not needed.

`src/components/editor/extensions/TaskItem/index.ts`:

```ts
export { TaskItem, type TaskItemExtensionOptions } from './TaskItem';
export { dropIndex, startTaskItemDrag } from './taskItemDrag';
```

- [ ] **Step 8: Run the extension tests**

Run: `pnpm vitest run src/components/editor/extensions/TaskItem`
Expected: PASS. If `moveTaskItem` returns true but the doc is unchanged, the position arithmetic is wrong: `tr.insert` must use the list's start after `tr.delete` has run, which is unchanged because the deleted range lies inside the list.

If `moveTaskItem` to index `childCount - 1` throws an out-of-range error, `to` is being compared before the removal; the guard `to > list.childCount - 1` is correct because after removal the list has `childCount - 1` children and valid insert indices are `0..childCount-1`.

- [ ] **Step 9: Register it, style it, name it**

In `src/components/editor/extensions/build.ts`, delete the line `import { TaskItem } from '@tiptap/extension-list';` and add `import { TaskItem } from './TaskItem';` in alphabetical position (after `./Strike`, before `./TaskList`). Replace the registration `TaskItem,` (line 83) with:

```ts
    TaskItem.configure({ gripLabel: () => t('editor.taskItem.grip') }),
```

Check that `t` is in scope at that point in `build.ts` (it is the `TFunction` the builder receives; `createSlashMenu` uses it). If the builder receives it under another name, use that name.

In `public/locales/en/translation.json`, under `"editor"`, add:

```json
    "taskItem": {
      "grip": "Reorder item"
    },
```

In `public/locales/cs/translation.json`, under `"editor"`, add:

```json
    "taskItem": {
      "grip": "Přesunout položku"
    },
```

In `src/styles/globals.css`, after the rule `.prose ul[data-type="taskList"] li > div p { @apply my-0; }`, add:

```css
/* The reorder grip. Editor only by construction: it is node-view DOM, never
   stored markup, so the Card cannot have one. Pointer-driven, so a finger can
   use it (`extensions/TaskItem/taskItemDrag.ts`).

   44x44 on a Coarse pointer and always visible there, because there is no
   hover to reveal it. On a Fine pointer it keeps its column but only shows on
   the row's hover, so a long list is not a wall of dots. */
.tiptap ul[data-type="taskList"] li > .task-item-grip {
  @apply -ml-1 flex size-6 flex-none cursor-grab touch-none items-center justify-center self-center rounded-md text-muted-foreground opacity-0 transition-opacity;
}

.tiptap ul[data-type="taskList"] li > .task-item-grip > svg {
  @apply size-4;
}

.tiptap ul[data-type="taskList"] li:hover > .task-item-grip,
.tiptap ul[data-type="taskList"] li > .task-item-grip:focus-visible {
  @apply opacity-100;
}

@media (pointer: coarse) {
  .tiptap ul[data-type="taskList"] li > .task-item-grip {
    @apply -ml-2 size-11 opacity-100;
  }

  .tiptap ul[data-type="taskList"] li > .task-item-grip > svg {
    @apply size-5;
  }
}

.tiptap ul[data-type="taskList"] li.task-item-dragging {
  @apply relative z-10 cursor-grabbing bg-background shadow-lift;
}

.tiptap ul[data-type="taskList"] li.task-item-drop-before {
  box-shadow: 0 -2px 0 0 var(--primary);
}

.tiptap ul[data-type="taskList"] li.task-item-drop-after {
  box-shadow: 0 2px 0 0 var(--primary);
}
```

- [ ] **Step 10: Full check**

Run: `pnpm check && pnpm test && pnpm build`
Expected: all green. `editor.test.tsx` and `NoteEditorDialog.realEditor.test.tsx` mount the real editor and must still pass; a failure there about `this.parent` in `addNodeView` means TipTap did not bind a parent for node views and the fallback is to copy the upstream node view body (from `node_modules/@tiptap/extension-list/dist/index.js`, `addNodeView` around line 1360) into `TaskItem.ts` and prepend the grip there.

- [ ] **Step 11: Look at it**

`pnpm dev`. Desktop: hover a checklist row, a grip appears; drag it up and down, the row travels and a line marks the slot; release and the order changes; Ctrl+Z undoes it in one step. Device mode (Pixel 7): the grip is always visible and 44px; drag with the touch pointer. Switch Sinking on in Settings → Appearance and confirm a checked row drags only among checked rows.

- [ ] **Step 12: Commit**

```bash
git add src/components/editor/extensions/TaskItem src/components/editor/extensions/build.ts src/styles/globals.css public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[EDIT] A checklist item can be reordered by its grip under a finger or a mouse (TaskItem extension)"
```

---

### Task 4: The recorder belongs to the Editor, not to a toolbar button

**Files:**
- Modify: `src/components/editor/extensions/Audio/audioCapture.ts`, `audioCapture.test.ts`
- Create: `src/components/editor/extensions/Audio/AudioRecorderHost.tsx`, `AudioRecorderHost.test.tsx`
- Modify: `src/components/editor/extensions/Audio/AudioRecordButton.tsx`, `AudioRecordButton.test.tsx`
- Modify: `src/components/editor/extensions/Audio/index.ts` (export the host)
- Modify: `src/components/editor/editor.tsx` (mount the host before `{footer}`)

**Interfaces:**
- Consumes: `editor.storage.audioAttachment.capture` (the coordinator), `useAudioRecorder()`.
- Produces: `AudioCaptureCoordinator` gains `isRecording(): boolean`, `setRecording(recording: boolean): void`, `subscribe(listener: () => void): () => void`. `requestRecording()` and `registerRecorder()` keep their signatures.
- Produces: `<AudioRecorderHost editor={editor} getDeps={() => AttachmentDeps} />` - always mounted while the editor is editable. Owns `useAudioRecorder`, registers with the coordinator, mirrors `status === 'recording'` into `setRecording`, toasts errors, renders the recording panel (timer, waveform, Cancel, Stop) while recording, and inserts the attachment on Stop.
- Produces: `AudioRecordButton` renders one `ActionButton` whose action is `capture.requestRecording()` and which is disabled while `isRecording()`.

The root cause this fixes: on Compact width the media family is collapsed, so the mic button - and with it the recorder - was mounted only while that menu was open. The speed dial's request waited for a recorder that never came.

- [ ] **Step 1: Write the failing coordinator tests**

Append to `src/components/editor/extensions/Audio/audioCapture.test.ts` (inside its existing `describe`, or a new one):

```ts
describe('recording status', () => {
  it('starts not recording and notifies subscribers on every change', () => {
    const capture = createAudioCaptureCoordinator();
    const seen: boolean[] = [];
    const unsubscribe = capture.subscribe(() => seen.push(capture.isRecording()));

    expect(capture.isRecording()).toBe(false);
    capture.setRecording(true);
    capture.setRecording(false);
    unsubscribe();
    capture.setRecording(true);

    expect(seen).toEqual([true, false]);
  });

  it('does not notify when the value does not change', () => {
    const capture = createAudioCaptureCoordinator();
    const listener = vi.fn();
    capture.subscribe(listener);
    capture.setRecording(false);
    expect(listener).not.toHaveBeenCalled();
  });
});
```

Add `vi` to the vitest import at the top of that file if it is not already there.

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/components/editor/extensions/Audio/audioCapture.test.ts`
Expected: FAIL, `capture.subscribe is not a function`.

- [ ] **Step 3: Extend the coordinator**

Replace `src/components/editor/extensions/Audio/audioCapture.ts` with:

```ts
export type RecorderCleanup = () => void;

export interface AudioCaptureCoordinator {
  /** Ask for a recording to start as soon as a recorder exists. */
  requestRecording(): void;
  registerRecorder(start: () => void): RecorderCleanup;
  /** Whether a take is in progress. Set by the recorder's owner; read by buttons. */
  isRecording(): boolean;
  setRecording(recording: boolean): void;
  /** `useSyncExternalStore` shape, so a button can re-render on a change. */
  subscribe(listener: () => void): () => void;
}

/**
 * Bridges "start recording" (asked for by the editor from the speed-dial's
 * intent, or by the toolbar's mic button) to the one recorder the editor owns
 * (`AudioRecorderHost`). The two mount independently, so a request is held
 * until a recorder registers - the same pending-then-fire shape as
 * `audioAutoplay`.
 *
 * It also carries the recording status the other way, so a mic button in a
 * collapsed toolbar menu - or none at all - can still tell whether a take is
 * running. The recorder used to live in that button, which meant a phone's
 * collapsed media menu had no recorder until it was opened, and the dial's
 * request waited on a button that was not there.
 *
 * One-shot on purpose: a request is consumed by the first recorder that takes
 * it, so remounting cannot start a second take.
 */
export function createAudioCaptureCoordinator(): AudioCaptureCoordinator {
  let pending = false;
  let current: (() => void) | null = null;
  let recording = false;
  const listeners = new Set<() => void>();

  return {
    requestRecording() {
      if (current) {
        current();
        return;
      }
      pending = true;
    },

    registerRecorder(start) {
      current = start;
      if (pending) {
        pending = false;
        start();
      }
      return () => {
        if (current === start) current = null;
      };
    },

    isRecording() {
      return recording;
    },

    setRecording(next) {
      if (next === recording) return;
      recording = next;
      for (const listener of listeners) listener();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
```

- [ ] **Step 4: Run the coordinator tests**

Run: `pnpm vitest run src/components/editor/extensions/Audio/audioCapture.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing host test**

`src/components/editor/extensions/Audio/AudioRecorderHost.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudioCaptureCoordinator } from './audioCapture';
import { AudioRecorderHost } from './AudioRecorderHost';
import type { AudioRecorder } from './useAudioRecorder';

const recorder: AudioRecorder = {
  status: 'idle',
  elapsedMs: 0,
  error: null,
  supported: true,
  stream: null,
  start: vi.fn(async () => {}),
  stop: vi.fn(async () => null),
  cancel: vi.fn(),
};

vi.mock('./useAudioRecorder', () => ({ useAudioRecorder: () => recorder }));
vi.mock('./RecordingWaveform', () => ({ RecordingWaveform: () => null }));

const t = (key: string) => key;

function makeEditor() {
  const capture = createAudioCaptureCoordinator();
  const chain = { focus: () => chain, insertAudioAttachment: () => chain, run: vi.fn() };
  return {
    capture,
    editor: { storage: { audioAttachment: { capture } }, chain: () => chain } as never,
  };
}

const getDeps = () =>
  ({
    t,
    getNoteId: async () => 'note-1',
    createAttachment: vi.fn(async () => ({ id: 'att-1' })),
    onError: vi.fn(),
  }) as never;

describe('AudioRecorderHost', () => {
  beforeEach(() => {
    recorder.status = 'idle';
    vi.mocked(recorder.start).mockClear();
  });

  it('answers a recording request made before it mounted', () => {
    const { editor, capture } = makeEditor();
    capture.requestRecording();

    render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  it('answers a request made after it mounted', () => {
    const { editor, capture } = makeEditor();
    render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    capture.requestRecording();

    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  it('shows nothing while idle and the take controls while recording', () => {
    const { editor } = makeEditor();
    const { rerender } = render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);
    expect(screen.queryByRole('button', { name: 'editor.audio.stop' })).not.toBeInTheDocument();

    recorder.status = 'recording';
    rerender(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    expect(screen.getByRole('button', { name: 'editor.audio.stop' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'editor.audio.cancel' })).toBeVisible();
  });

  it('publishes the recording status to the coordinator', () => {
    const { editor, capture } = makeEditor();
    const { rerender } = render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);
    expect(capture.isRecording()).toBe(false);

    recorder.status = 'recording';
    rerender(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    expect(capture.isRecording()).toBe(true);
  });

  it('cancels the take from its Cancel control', async () => {
    const { editor } = makeEditor();
    recorder.status = 'recording';
    render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);

    await userEvent.click(screen.getByRole('button', { name: 'editor.audio.cancel' }));

    expect(recorder.cancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `pnpm vitest run src/components/editor/extensions/Audio/AudioRecorderHost.test.tsx`
Expected: FAIL, cannot resolve `./AudioRecorderHost`.

- [ ] **Step 7: Write the host**

`src/components/editor/extensions/Audio/AudioRecorderHost.tsx`:

```tsx
import type { Editor } from '@tiptap/core';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { formatElapsed } from '@/lib/format-attachment.ts';
import type { AttachmentDeps } from '../attachments/deps';
import { RecordingWaveform } from './RecordingWaveform';
import { useAudioRecorder } from './useAudioRecorder';

export interface AudioRecorderHostProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
}

/** RecorderError code -> translation key. 'denied' keeps the legacy 'permission'
 *  key; the rest are distinct so the toast tells the true cause. */
const ERROR_KEY: Record<string, string> = {
  denied: 'editor.audio.errors.permission',
  unsupported: 'editor.audio.errors.unsupported',
  'no-device': 'editor.audio.errors.no-device',
  'in-use': 'editor.audio.errors.in-use',
  failed: 'editor.audio.errors.failed',
};

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/**
 * The one recorder an editor has. Mounted by the Editor for as long as it is
 * editable, whatever the toolbar shows: the mic button used to own this, and on
 * a phone that button sits inside a collapsed menu, so a "Voice note" started
 * from the speed dial waited for a recorder that only existed once the user
 * happened to open that menu.
 *
 * Renders nothing until a take is running, then the take's controls (timer,
 * waveform, Cancel, Stop) in the editor's own flow, above the note bar and the
 * toolbar - a place that exists on every layout.
 */
export function AudioRecorderHost({ editor, getDeps }: AudioRecorderHostProps) {
  const rec = useAudioRecorder();
  const capture = editor.storage.audioAttachment.capture;
  const Square = icons.Square;

  useEffect(() => {
    if (rec.status === 'error') {
      toast(getDeps().t(ERROR_KEY[rec.error ?? 'failed'] ?? ERROR_KEY.failed));
    }
  }, [rec.status, rec.error, getDeps]);

  const start = rec.start;
  useEffect(() => capture.registerRecorder(() => void start()), [capture, start]);

  const recording = rec.status === 'recording';
  useEffect(() => {
    capture.setRecording(recording);
    return () => capture.setRecording(false);
  }, [capture, recording]);

  const onStop = async () => {
    const out = await rec.stop();
    if (!out) return;
    const deps = getDeps();
    try {
      const noteId = await deps.getNoteId();
      const ext = EXT[out.mime.split(';')[0]] ?? 'webm';
      const file = new File([out.blob], `recording.${ext}`, { type: out.mime });
      // The recorder already measured this; persisting it is what lets a card
      // show a clip's length without decoding the audio on the feed.
      const att = await deps.createAttachment(noteId, file, 'audio', {
        duration: out.durationMs / 1000,
      });
      editor.chain().focus().insertAudioAttachment({ attachmentId: att.id }).run();
    } catch {
      deps.onError('insert-failed');
    }
  };

  if (!recording) return null;

  const t = getDeps().t;
  return (
    <div
      role="group"
      aria-label={t('editor.audio.recording')}
      className="my-2 flex flex-col gap-3 rounded-md border border-border bg-card p-3 shadow-rest"
    >
      <div className="flex items-center gap-2">
        <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden />
        <span className="text-xs tabular-nums">{formatElapsed(rec.elapsedMs / 1000)}</span>
      </div>
      <RecordingWaveform stream={rec.stream} />
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => rec.cancel()}
          className="touch-target rounded-md px-2 py-1 text-muted-foreground text-xs hover:bg-muted"
        >
          {t('editor.audio.cancel')}
        </button>
        <button
          type="button"
          onClick={() => void onStop()}
          className="touch-target flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-primary-foreground text-xs transition-colors hover:bg-primary/90"
        >
          <Square className="size-3.5" />
          {t('editor.audio.stop')}
        </button>
      </div>
    </div>
  );
}
```

Add to `public/locales/en/translation.json` under `"editor" > "audio"`: `"recording": "Recording"`. To `cs`: `"recording": "Nahrávání"`.

- [ ] **Step 8: Run the host test**

Run: `pnpm vitest run src/components/editor/extensions/Audio/AudioRecorderHost.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 9: Slim the button and update its tests**

Replace `src/components/editor/extensions/Audio/AudioRecordButton.tsx` with:

```tsx
import type { Editor } from '@tiptap/core';
import { useSyncExternalStore } from 'react';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { AttachmentDeps } from '../attachments/deps';

export interface AudioRecordButtonProps {
  editor: Editor;
  getDeps: () => AttachmentDeps;
  tooltip: string;
}

/** Toolbar entry point for audio. A request, not a recorder: the recorder is
 *  `AudioRecorderHost`, mounted by the Editor whatever the toolbar shows, so
 *  this button can sit inside a collapsed menu or be switched off entirely and
 *  a take still has an owner. File uploads (including .mp3 etc.) go through the
 *  generic File extension's toolbar button instead - this is record-only. */
export function AudioRecordButton({ editor, tooltip }: AudioRecordButtonProps) {
  const capture = editor.storage.audioAttachment.capture;
  const recording = useSyncExternalStore(capture.subscribe, capture.isRecording, () => false);
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  return (
    <ActionButton
      icon="Mic"
      tooltip={tooltip}
      disabled={!supported || recording}
      action={() => capture.requestRecording()}
    />
  );
}
```

Open `src/components/editor/extensions/Audio/AudioRecordButton.test.tsx` and read it in full. Tests that drove a recording through the button (waveform, Stop inserting an attachment, Esc cancelling) now belong to the host: delete them, and keep or rewrite these three so the file reads:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createAudioCaptureCoordinator } from './audioCapture';
import { AudioRecordButton } from './AudioRecordButton';

function makeEditor() {
  const capture = createAudioCaptureCoordinator();
  return { capture, editor: { storage: { audioAttachment: { capture } } } as never };
}

const getDeps = () => ({ t: (k: string) => k }) as never;

describe('AudioRecordButton', () => {
  it('asks the coordinator to record; it does not own a recorder', async () => {
    const { editor, capture } = makeEditor();
    const start = vi.fn();
    capture.registerRecorder(start);
    render(<AudioRecordButton editor={editor} getDeps={getDeps} tooltip="Record" />);

    await userEvent.click(screen.getByRole('button', { name: 'Record' }));

    expect(start).toHaveBeenCalledTimes(1);
  });

  it('is disabled while a take is running', () => {
    const { editor, capture } = makeEditor();
    capture.setRecording(true);
    render(<AudioRecordButton editor={editor} getDeps={getDeps} tooltip="Record" />);

    expect(screen.getByRole('button', { name: 'Record' })).toBeDisabled();
  });
});
```

If the existing test file stubs `navigator.mediaDevices` and `MediaRecorder` in a `beforeEach`, keep that stub: without it `supported` is false in jsdom and the first test's button is disabled. If it does not, add at the top of the `describe`:

```tsx
  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn() },
    });
    vi.stubGlobal('MediaRecorder', class {});
  });
```

and import `beforeEach`.

- [ ] **Step 10: Mount the host in the Editor**

In `src/components/editor/editor.tsx`: import `AudioRecorderHost` from `./extensions/Audio` (add `export { AudioRecorderHost } from './AudioRecorderHost';` to `src/components/editor/extensions/Audio/index.ts`). In the JSX, immediately before `{footer}`, add:

```tsx
        {/* The recorder, mounted for as long as the editor is editable and
            whatever the toolbar shows - see `AudioRecorderHost`. */}
        {editable && (
          <AudioRecorderHost editor={editor} getDeps={() => attachmentDepsRef.current} />
        )}
```

- [ ] **Step 11: Full check**

Run: `pnpm check && pnpm test && pnpm build`
Expected: all green. `editor.test.tsx` may contain a test that finds the mic button by its tooltip and expects a popover; update it to expect the host's Stop button instead (`screen.getByRole('button', { name: /stop/i })`).

- [ ] **Step 12: Look at it**

`pnpm dev` in device mode: tap `＋`, Voice note. The browser asks for the microphone at once, and the take's panel with Stop appears above the toolbar with the media menu never opened. Stop inserts the clip. Desktop: the mic button in the bar starts a take; it is disabled during one.

- [ ] **Step 13: Commit**

```bash
git add src/components/editor/extensions/Audio src/components/editor/editor.tsx public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[FIX] The recorder belongs to the editor, so a voice note started from the dial records on any toolbar layout"
```

---

### Task 5: Image and Camera Starts that open the picker in the tap

**Files:**
- Modify: `src/components/notes/quickCaptureActions.ts`
- Create: `src/components/notes/useStartPicker.tsx`
- Modify: `src/components/notes/QuickCaptureBar.tsx`, `QuickCaptureBar.test.tsx`
- Modify: `src/components/notes/DesktopCaptureBar.tsx`, `DesktopCaptureBar.test.tsx`
- Modify: `src/components/notes/NotesView.tsx` (`NoteOpenRequest`, `OpenIntent`, `start`, the dialog props around line 164)
- Modify: `src/components/notes/NoteEditorDialog.tsx` (props, the `<Editor>` element around line 431)
- Modify: `src/components/editor/editor.tsx` (`CaptureKind`, `initialCapture` effect around line 368, the auto-capture input around line 475)
- Modify: `src/components/editor/extensions/Image/ImageButton.tsx` (`accept`)
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json` (`notes.capture`)
- Modify: `src/lib/tour/steps.ts` comment "five starts" → "the starts" (comment only)

**Interfaces:**
- Produces: `QuickCaptureAction.picker?: { accept: string; capture?: 'environment' }`. A Start with a `picker` opens the OS picker inside the tap; its `editing` is the request to open with once files are chosen, and the bar adds `files` to it.
- Produces: `NoteOpenRequest.files?: File[]` and `OpenIntent.files?: File[]`. `CaptureKind` becomes `'audio' | 'drawing'`.
- Produces: `EditorProps.initialFiles?: File[]` and `NoteEditorDialogProps.initialFiles?: File[]`: images inserted once, when the editor is ready.
- Produces: `useStartPicker(onStart): { input: ReactNode; open(action: QuickCaptureAction): void }`.

Why the picker moves: `input.click()` needs the tap's user activation, and that activation does not reliably survive the route change and the editor mounting; the old `initialCapture === 'picture'` effect was clicking from a `useEffect` after both. The tap itself is the only place the picker can be opened, so the files, not the intent, travel to the editor.

The `picture` **key** is kept and only its label changes to "Image", because the key is what a user's stored dial order is written in; renaming it would drop that entry from every existing arrangement.

- [ ] **Step 1: Update the actions**

Replace `src/components/notes/quickCaptureActions.ts` with:

```ts
import type { LucideIcon } from 'lucide-react';
import { Camera, Image, ListChecks, Mic, PencilRuler, SquarePen } from 'lucide-react';
import type { NoteOpenRequest } from '@/components/notes/NotesView.tsx';
import { EMPTY_CHECKLIST_BODY } from '@/components/notes/noteDrafts.ts';

export type QuickCaptureActionKey = 'text' | 'checklist' | 'audio' | 'drawing' | 'picture' | 'camera';

/** A Start that begins by choosing files: the OS picker opens inside the tap. */
export interface StartPicker {
  accept: string;
  /** Straight to the camera on a phone; ignored by a desktop browser. */
  capture?: 'environment';
}

export type QuickCaptureAction = {
  key: QuickCaptureActionKey;
  Icon: LucideIcon;
  /** i18n key for the action's accessible name and its speed-dial label. */
  labelKey: string;
  /** The editor state this action opens - a body seed, a capture, or neither.
   *  For a picker Start, the bar adds the chosen `files` to it. */
  editing: NoteOpenRequest;
  picker?: StartPicker;
};

/**
 * The ways to start a note, defined once so the mobile speed-dial and the
 * desktop quick-action row cannot drift. Order is deliberate: plain text first
 * (the common case), media after.
 *
 * A picker Start opens the OS picker in the tap itself and hands the files to
 * the editor, because the tap's user activation is the only thing that can
 * open a picker and it does not survive the route change to the editor.
 *
 * `picture` keeps its key although it is labelled "Image": the key is what a
 * user's stored dial order is written in.
 */
export const QUICK_CAPTURE_ACTIONS: QuickCaptureAction[] = [
  { key: 'text', Icon: SquarePen, labelKey: 'notes.capture.text', editing: { id: null } },
  {
    key: 'checklist',
    Icon: ListChecks,
    labelKey: 'notes.capture.checklist',
    editing: { id: null, initialBody: EMPTY_CHECKLIST_BODY },
  },
  {
    key: 'audio',
    Icon: Mic,
    labelKey: 'notes.capture.audio',
    editing: { id: null, capture: 'audio' },
  },
  {
    key: 'drawing',
    Icon: PencilRuler,
    labelKey: 'notes.capture.drawing',
    editing: { id: null, capture: 'drawing' },
  },
  {
    key: 'picture',
    Icon: Image,
    labelKey: 'notes.capture.picture',
    editing: { id: null },
    picker: { accept: 'image/*' },
  },
  {
    key: 'camera',
    Icon: Camera,
    labelKey: 'notes.capture.camera',
    editing: { id: null },
    picker: { accept: 'image/*', capture: 'environment' },
  },
];
```

Translations. In `en` `notes.capture`: change `"picture": "Photo"` to `"picture": "Image"` and add `"camera": "Camera"`. In `cs`: `"picture": "Obrázek"` and `"camera": "Fotoaparát"`.

- [ ] **Step 2: Write the shared picker hook**

`src/components/notes/useStartPicker.tsx`:

```tsx
import { type ReactNode, useRef } from 'react';
import type { NoteOpenRequest } from '@/components/notes/NotesView.tsx';
import type { QuickCaptureAction } from '@/components/notes/quickCaptureActions.ts';

/**
 * One hidden file input a capture bar owns, opened synchronously inside a
 * Start's tap - the only moment a browser lets a picker open - and reporting
 * the chosen files as part of the open request. Both bars use it, so the two
 * cannot differ in what a picker Start does.
 */
export function useStartPicker(onStart: (editing: NoteOpenRequest) => void): {
  input: ReactNode;
  open: (action: QuickCaptureAction) => void;
} {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<QuickCaptureAction | null>(null);

  const open = (action: QuickCaptureAction) => {
    const input = inputRef.current;
    if (!action.picker || !input) return;
    pendingRef.current = action;
    input.accept = action.picker.accept;
    if (action.picker.capture) input.setAttribute('capture', action.picker.capture);
    else input.removeAttribute('capture');
    input.click();
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      multiple
      className="hidden"
      data-testid="start-picker"
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        event.target.value = '';
        const action = pendingRef.current;
        pendingRef.current = null;
        if (files.length && action) onStart({ ...action.editing, files });
      }}
    />
  );

  return { input, open };
}
```

- [ ] **Step 3: Update the bar tests to fail**

In `src/components/notes/QuickCaptureBar.test.tsx`: change `'expands into the five ways to start a note'` to iterate `['text', 'checklist', 'audio', 'drawing', 'picture', 'camera']` and rename it `'expands into every way to start a note'`. In the `it.each` table remove the `['picture', { id: null, capture: 'picture' }]` row. Add:

```tsx
  it.each([
    ['picture', 'image/*', null],
    ['camera', 'image/*', 'environment'],
  ])('%s opens the picker inside the tap and starts with the chosen files', async (key, accept, capture) => {
    const onStart = vi.fn();
    render(<QuickCaptureBar onStart={onStart} />, { wrapper });
    await userEvent.click(screen.getByRole('button', { name: 'notes.capture.open' }));
    const input = screen.getByTestId('start-picker') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');

    await userEvent.click(await screen.findByRole('button', { name: `notes.capture.${key}` }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe(accept);
    expect(input.getAttribute('capture')).toBe(capture);
    expect(onStart).not.toHaveBeenCalled();

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await userEvent.upload(input, file);

    expect(onStart).toHaveBeenCalledWith({ id: null, files: [file] });
  });
```

Adapt `wrapper`, `openDial` and the imports to what the file already has. In `src/components/notes/DesktopCaptureBar.test.tsx`, add the same test with the desktop bar (no dial to open first).

- [ ] **Step 4: Run them to see them fail**

Run: `pnpm vitest run src/components/notes/QuickCaptureBar.test.tsx src/components/notes/DesktopCaptureBar.test.tsx`
Expected: FAIL: no `start-picker`, and `camera` not rendered.

- [ ] **Step 5: Wire the bars**

In `QuickCaptureBar.tsx`: import `useStartPicker`; inside the component add `const picker = useStartPicker(onStart);`. In the dial's `<Button onClick>` replace the body with:

```tsx
                  onClick={() => {
                    setOpen(false);
                    if (action.picker) picker.open(action);
                    else onStart(action.editing);
                  }}
```

which needs the map to bind `action` (`actions.map((action, index) => { const { key, Icon, labelKey } = action; ...`). Render `{picker.input}` inside the outer `<div>` next to the `<Popover>`.

In `DesktopCaptureBar.tsx` do the same where its quick-action icons call `onStart(action.editing)`: read the file, find that call, and branch on `action.picker` the same way; render `{picker.input}` beside the icons.

- [ ] **Step 6: Carry the files to the editor**

`src/components/notes/NotesView.tsx`: add `files?: File[];` to both `NoteOpenRequest` (doc: "Files chosen by a picker Start, inserted once the editor is ready.") and `OpenIntent`; in `start`, add `files: editing.files,` to the `setIntent` call; where the dialog is rendered (`initialCapture={active?.capture}`) add `initialFiles={active?.files}`.

`src/components/notes/NoteEditorDialog.tsx`: add `initialFiles?: File[];` to the props type (doc: "Images from a picker Start, inserted once the editor is ready."), destructure it, and pass `initialFiles={initialFiles}` on the `<Editor>`.

`src/components/editor/editor.tsx`:
- `export type CaptureKind = 'audio' | 'drawing';`
- add to `EditorProps`: `/** Images chosen by a picker Start, inserted once when the editor is ready. */ initialFiles?: File[];` and destructure it.
- delete `pictureInputRef` and the whole `{initialCapture === 'picture' && (<input ... />)}` block.
- replace the auto-capture effect with:

```tsx
  // One-shot open intents: the speed-dial picked a medium, so open straight
  // into it instead of making the user hunt for the same button in the toolbar.
  // A picker Start arrives as files, because the picker itself can only open
  // inside the tap that chose it (`useStartPicker`).
  const intentStartedRef = useRef(false);
  useEffect(() => {
    if (!editor || intentStartedRef.current) return;
    if (!initialCapture && !initialFiles?.length) return;
    intentStartedRef.current = true;
    if (initialCapture === 'drawing') {
      openExcalidraw({});
    } else if (initialCapture === 'audio') {
      editor.storage.audioAttachment.capture.requestRecording();
    }
    if (initialFiles?.length) {
      void insertImageAttachmentFiles(editor, initialFiles, attachmentDepsRef.current, (id) =>
        editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
      );
    }
  }, [editor, initialCapture, initialFiles, openExcalidraw]);
```

`src/components/editor/extensions/Image/ImageButton.tsx`: change `accept={ALLOWED_IMAGE_MIME.join(',')}` to `accept="image/*"`, drop the now-unused import, and change the doc comment to: `/** Toolbar entry point: opens a hidden multi-file image picker. \`accept="image/*"\` rather than the MIME whitelist, for the same two reasons as VideoButton: Android only offers the camera for the wildcard, and Chrome on Linux greys out valid files when specific types are listed. The whitelist is still enforced in \`validateAttachmentFile\` after selection. */`

In `src/lib/tour/steps.ts` line ~116 change "The five starts are on screen" to "The starts are on screen"; in `DesktopCaptureBar.tsx`'s doc comment change "the same five quick-capture starts" to "the same quick-capture starts".

- [ ] **Step 7: Fix what the change broke**

Run: `pnpm check && pnpm build && pnpm test`

Expected failures to fix, then re-run until green:
- `editor.test.tsx` tests referencing `auto-capture-picture-input` or `capture: 'picture'`: replace with a test that renders `<Editor initialFiles={[png]} ... />` and asserts an image attachment is inserted (mock `insertImageAttachmentFiles` from `./extensions/Image/insert` with `vi.mock` and assert it was called once with the files). 
- `NotesView.openNote.test.tsx` or `NoteEditorDialog.test.tsx` rows using `capture: 'picture'`: change to `files: [file]`.
- `QuickCaptureSection.test.tsx` uses `QUICK_CAPTURE_ACTIONS.length` and needs nothing.
- `src/i18n.test.ts` fails if a locale is missing `camera`.

- [ ] **Step 8: Look at it**

Device mode cannot show the OS sheet; on a real phone: `＋` → Image opens the gallery, `＋` → Camera opens the camera, and the chosen picture lands in a new note. Desktop: the bar's Image icon opens the file dialog at once.

- [ ] **Step 9: Commit**

```bash
git add src/components/notes src/components/editor/editor.tsx src/components/editor/editor.test.tsx src/components/editor/extensions/Image/ImageButton.tsx src/lib/tour/steps.ts public/locales
git commit -m "[EDIT] Image and Camera starts open the picker in the tap and hand the files to the editor"
```

---

### Task 6: No keyboard for an existing Note on a Coarse pointer

**Files:**
- Modify: `src/components/notes/NoteEditorDialog.tsx` (`onOpenAutoFocus`, around line 310)
- Modify: `src/components/notes/NoteEditorDialog.test.tsx`

**Interfaces:**
- Consumes: `useFinePointer()` from `@/hooks/useFinePointer.ts`.

- [ ] **Step 1: Write the failing tests**

Read `src/components/notes/NoteEditorDialog.test.tsx` for its render helper and how it seeds an existing note (it puts a note in the test store and renders with `noteId`). Add, matching those helpers:

```tsx
describe('opening focus', () => {
  /** `useFinePointer` reads `matchMedia('(pointer: fine)')`. */
  const setPointer = (fine: boolean) => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query === '(pointer: fine)' ? fine : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      dispatchEvent: () => false,
    }));
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('focuses the title of a new note on a Coarse pointer, because the user came to type', async () => {
    setPointer(false);
    renderDialog({ draftId: crypto.randomUUID() });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'notes.titlePlaceholder' })).toHaveFocus();
    });
  });

  it('focuses nothing for an existing note on a Coarse pointer, so the keyboard stays down', async () => {
    setPointer(false);
    const note = await seedNote({ header: 'Kept', body: '<p>text</p>' });
    renderDialog({ noteId: note.id });
    await screen.findByDisplayValue('Kept');
    expect(screen.getByRole('textbox', { name: 'notes.titlePlaceholder' })).not.toHaveFocus();
  });

  it('still focuses the title of an existing note on a Fine pointer', async () => {
    setPointer(true);
    const note = await seedNote({ header: 'Kept', body: '<p>text</p>' });
    renderDialog({ noteId: note.id });
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'notes.titlePlaceholder' })).toHaveFocus();
    });
  });
});
```

`renderDialog` and `seedNote` stand for whatever the file's existing helpers are called; use those names. If `useIsMobile` also reads `matchMedia`, the stub above returns `false` for its query, which is the desktop layout; that is fine for focus.

- [ ] **Step 2: Run to see the middle one fail**

Run: `pnpm vitest run src/components/notes/NoteEditorDialog.test.tsx`
Expected: FAIL on "focuses nothing for an existing note on a Coarse pointer".

- [ ] **Step 3: Implement**

In `NoteEditorDialog.tsx`: import `useFinePointer` from `@/hooks/useFinePointer.ts`, add `const finePointer = useFinePointer();` beside `const isMobile = useIsMobile();`, and change the `onOpenAutoFocus` handler and its comment to:

```tsx
        // Radix gives the opening focus to the first focusable child, which is
        // now the app bar's back arrow: opening a note would put the caret on
        // "leave" rather than in the note. Redirect it to the title - except on
        // a Coarse pointer for a note that already exists, where a focused
        // field raises the keyboard over a note the user came to read. A new
        // note is different: the user came to type. A checklist draft is left
        // alone - `Editor autoFocus` puts the caret in the first item, and this
        // must not race it back up to the title.
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (focusBody) return;
          if (noteId && !finePointer) return;
          headerInputRef.current?.focus();
        }}
```

- [ ] **Step 4: Run the dialog tests and the suite**

Run: `pnpm vitest run src/components/notes/NoteEditorDialog.test.tsx && pnpm check && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/notes/NoteEditorDialog.tsx src/components/notes/NoteEditorDialog.test.tsx
git commit -m "[EDIT] Opening an existing note on a phone focuses nothing, so the keyboard stays down"
```

---

### Task 7: Playwright specs for the three flows

**Files:**
- Create: `e2e/helpers.ts`, `e2e/checklist.spec.ts`, `e2e/capture.spec.ts`, `e2e/editor-focus.spec.ts`
- Modify: `playwright.config.ts` (fake media devices for the microphone test)

**Interfaces:**
- Produces: `skipTour(page)`: stamps `onboardingSeenAt` in `localStorage` before the app loads, so the Tour is not offered. `newTextNote(page, title)`: creates and closes a note through the UI.

Playwright's `mobile` project emulates Pixel 7, which reports `pointer: coarse`, so the Coarse branches run there and the Fine ones on `desktop`.

- [ ] **Step 1: Helpers**

`e2e/helpers.ts`:

```ts
import type { Page } from '@playwright/test';

/**
 * A fresh context has empty storage, so the Tour is due (ADR 0015) and would
 * mark everything but its popover `inert`. These specs are about the app the
 * Tour demonstrates, not the Tour, so the offer is recorded as already made.
 * The blob is the Preferences schema's own shape: `version` is a literal.
 */
export async function skipTour(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'preferences',
      JSON.stringify({ version: 2, onboardingSeenAt: '2026-01-01T00:00:00.000Z' })
    );
  });
}

/** Whichever capture surface this width shows: the desktop bar's own field, or the dial. */
export async function startNote(page: Page, start: string) {
  const dial = page.getByRole('button', { name: 'New note' });
  if (await dial.isVisible()) await dial.click();
  await page.getByRole('button', { name: start, exact: true }).click();
}

/** Creates a text note through the UI and closes it, so it sits on the wall. */
export async function newTextNote(page: Page, title: string, body = '') {
  await startNote(page, 'Note');
  const titleField = page.getByRole('textbox', { name: 'Title' });
  await titleField.fill(title);
  if (body) {
    await page.locator('.tiptap').click();
    await page.keyboard.type(body);
  }
  await closeNote(page);
  await page.getByRole('heading', { name: title }).waitFor();
}

/** Mobile closes from the app bar's back arrow, desktop from the dialog's X. */
export async function closeNote(page: Page) {
  const back = page.getByRole('button', { name: 'Back' });
  if (await back.isVisible()) await back.click();
  else await page.getByRole('button', { name: 'Close' }).click();
}
```

The accessible names ("New note", "Note", "Title", "Back", "Close") are the English strings for `notes.capture.open`, `notes.capture.text`, `notes.titlePlaceholder`, the app bar's back control and the vendored dialog close. Read `public/locales/en/translation.json` and `src/components/nav/BackButton.tsx` (or wherever the back arrow's `aria-label` comes from) and correct any that differ before running.

- [ ] **Step 2: The checklist spec**

`e2e/checklist.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { closeNote, newTextNote, skipTour, startNote } from './helpers';

test.describe('checklist', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('a tap on the item text ticks it from the card', async ({ page }) => {
    await startNote(page, 'Checklist');
    await page.locator('.tiptap').click();
    await page.keyboard.type('Milk');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Bread');
    await page.getByRole('textbox', { name: 'Title' }).fill('Shopping');
    await closeNote(page);

    const card = page.getByRole('button', { name: /Shopping/ });
    await card.getByText('Milk').click();

    await expect(card.locator('li[data-checked="true"]')).toHaveCount(1);
    // The card was not opened by the tap.
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('the grip reorders an item, and the order is what is saved', async ({ page }) => {
    await startNote(page, 'Checklist');
    await page.locator('.tiptap').click();
    await page.keyboard.type('One');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Two');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Three');
    await page.getByRole('textbox', { name: 'Title' }).fill('Order');

    const rows = page.locator('.tiptap li[data-type="taskItem"]');
    const first = rows.nth(0);
    await first.hover();
    const grip = first.getByRole('button', { name: 'Reorder item' });
    const gripBox = await grip.boundingBox();
    const lastBox = await rows.nth(2).boundingBox();
    if (!gripBox || !lastBox) throw new Error('rows not laid out');

    await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(gripBox.x + gripBox.width / 2, lastBox.y + lastBox.height, { steps: 8 });
    await page.mouse.up();

    await expect(rows).toHaveText(['Two', 'Three', 'One']);

    await closeNote(page);
    const card = page.getByRole('button', { name: /Order/ });
    await expect(card.locator('li[data-type="taskItem"]')).toHaveText(['Two', 'Three', 'One']);
  });

  test('a long press on a card row opens the note', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'press-and-hold is a touch gesture');
    await newTextNote(page, 'Held');
    // Turn the note into a checklist so it has a row.
    await page.getByRole('button', { name: /Held/ }).click();
    await page.locator('.tiptap').click();
    await page.keyboard.press('Control+Shift+9');
    await page.keyboard.type('Item');
    await closeNote(page);

    const row = page.getByRole('button', { name: /Held/ }).locator('li[data-type="taskItem"]');
    const box = await row.boundingBox();
    if (!box) throw new Error('row not laid out');
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }],
    });
    await page.waitForTimeout(600);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(row.locator('..').locator('li[data-checked="true"]')).toHaveCount(0);
  });
});
```

- [ ] **Step 3: The capture spec**

`e2e/capture.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { skipTour, startNote } from './helpers';

test.describe('capture starts', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('Image opens the picker in the tap and the picture lands in a new note', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'Image');
    const picker = await chooser;
    expect(picker.isMultiple()).toBe(true);
    await picker.setFiles({
      name: 'dot.png',
      mimeType: 'image/png',
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        'base64'
      ),
    });

    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').locator('img')).toHaveCount(1);
  });

  test('Camera asks for the camera', async ({ page }) => {
    const chooser = page.waitForEvent('filechooser');
    await startNote(page, 'Camera');
    const picker = await chooser;
    await expect(picker.element()).toHaveAttribute('capture', 'environment');
    await expect(picker.element()).toHaveAttribute('accept', 'image/*');
  });

  test('Voice note starts recording at once, whatever the toolbar shows', async ({ page, context }) => {
    await context.grantPermissions(['microphone']);
    await startNote(page, 'Voice note');

    await expect(page.getByRole('button', { name: 'Stop' })).toBeVisible();
    // The media menu was never opened: the recorder no longer lives in it.
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).toBeVisible();
  });
});
```

In `playwright.config.ts`, add to both projects' `use` a `launchOptions` with Chromium's fake media so `getUserMedia` resolves headlessly:

```ts
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
      },
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
      },
    },
```

- [ ] **Step 4: The focus spec**

`e2e/editor-focus.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { newTextNote, skipTour, startNote } from './helpers';

test.describe('opening focus', () => {
  test.beforeEach(async ({ page }) => {
    await skipTour(page);
    await page.goto('/');
  });

  test('a new note opens with the title focused', async ({ page }) => {
    await startNote(page, 'Note');
    await expect(page.getByRole('textbox', { name: 'Title' })).toBeFocused();
  });

  test('an existing note opens with nothing focused on a phone, and the title focused on a desktop', async ({ page, isMobile }) => {
    await newTextNote(page, 'Kept', 'some text');
    await page.getByRole('button', { name: /Kept/ }).click();

    const title = page.getByRole('textbox', { name: 'Title' });
    await expect(title).toHaveValue('Kept');
    if (isMobile) {
      await expect(title).not.toBeFocused();
      await expect(page.locator('.tiptap')).not.toBeFocused();
    } else {
      await expect(title).toBeFocused();
    }
  });
});
```

- [ ] **Step 5: Run the suite**

Run: `pnpm exec playwright install chromium` once if needed, then `pnpm test:e2e`.
Expected: every spec green in both projects (the long-press one skipped on desktop). Fix accessible names in the helpers first if a locator does not resolve; do not loosen an assertion to make it pass.

- [ ] **Step 6: Typecheck the specs and commit**

Run: `pnpm exec tsc --noEmit -p tsconfig.node.json && pnpm check`

```bash
git add e2e playwright.config.ts
git commit -m "[TEST] Playwright covers ticking, reordering, the picker and voice starts, and opening focus"
```

---

## Self-review

- **Coverage.** Q1 → Task 1. Q2 → Task 2. Q3 and Q4 → Task 3 (`dropIndex` is the group rule). Q5 → Task 4. Q6 → Task 5 (both the picker-in-the-tap and the Camera Start, and `image/*` on the toolbar). Q7 → Task 6. Q8 → Tasks 1-6 carry unit tests, Task 7 the Playwright specs; the real-phone check is called out in each "Look at it" step.
- **Names used across tasks.** `moveTaskItem({ pos, to })`, `dropIndex(stored, candidates, slot)`, `startTaskItemDrag({ event, item, onDrop })`, `capture.isRecording/setRecording/subscribe`, `AudioRecorderHost`, `useStartPicker`, `NoteOpenRequest.files`, `initialFiles`, `CaptureKind = 'audio' | 'drawing'`. Task 7's "Reorder item", "Stop", "Cancel", "Image", "Camera", "Voice note" are the English strings Tasks 3-5 add or keep.
- **Placeholders.** None; where a file's existing helper names are unknown (Task 6 `renderDialog`/`seedNote`, Task 7 accessible names) the step says to read the file and use its names.
