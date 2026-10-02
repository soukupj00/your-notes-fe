# M6 slice 2: Editor buttons - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One helper builds every Pattern A extension, the ten one-button marks and blocks become declarations in one file with one table-driven test, the button view type tells the truth about custom components, the four variant wrapper components go, and the editor's live values reach its once-built extensions through one `useLatest` hook, which also fixes the microphone-error toast repeating on every keystroke.

**Architecture:** `withButton(Upstream, ctx => view, options?)` in `src/components/editor/extensions/withButton.ts` does the `.extend()` and the one cast that eleven files each did. `ButtonView<C>` in `button-types.ts` becomes generic over the component, defaulting to `ActionButton`, so an extension that yields a picker or a select names it instead of declaring a local copy of the shape. The ten one-button extensions (Bold, Italic, Strike, Underline, Code, CodeBlock, Blockquote, HorizontalRule, BulletList, OrderedList) move into `extensions/formatting.ts`; TaskList, Heading, TextAlign and History use the helper in their folders, which they keep because each has more than its declaration. The four `variant` wrapper components become a `variant` prop in the extension's view. A `useLatest(value)` hook in `src/hooks/` returns a stable getter over the latest value; `editor.tsx` uses it for its two ref-plus-getter triples and hands the stable getter to `AudioRecorderHost`, which reads its deps through the same hook so a new getter identity can never re-run its error toast.

**Tech Stack:**
- React 19, TypeScript 6;
- TipTap 3 (`@tiptap/core` exports the `Extendable` base class every `Mark`, `Node` and `Extension` extends; its `.extend()` is what the helper wraps);
- Vitest with Testing Library (headless TipTap editors in tests);
- Biome; pnpm, Node 24.

**Spec:** `PLAN.md` milestone M6, slice 2, and [ADR 0022](../../adr/0022-interfaces-and-closures-not-classes.md) (helper functions and tables, never base classes; a folder is for an extension with more than its declaration).
Evidence: [the refactor survey](./2026-10-02-refactor-survey.md), section B ("Simple extensions", "Inventory", "getDeps", the mic-toast bug).
The helper's typing was verified against TipTap 3 before this plan was written: `E extends Extendable` with a concrete `(context) => ButtonView | ButtonView[]` return typechecks, keeps upstream behaviour, merges extra options, and makes a misspelt icon name a compile error in both the single and the array form.

## Global Constraints

- pnpm only, never npm or yarn; Node 24.
- Plain dash, never an em dash; in long Markdown one sentence per line.
- Comments are short, plain and high level: why, a decision (link the ADR) or a trap; never narrate the next line (`CLAUDE.md` hard rule). Agents get context from the `.md` files, so no comment briefs an agent.
- ADR 0022: helper functions and closure factories, never classes; no abstraction without a second implementation or three call sites.
- ADR 0004 stands: every toolbar button is extension-owned, `icon` is a string key into `src/components/icons/icons.ts`, `ActionButton` is the shared button, tooltips go through `t()`.
- The toolbar registry (`toolbar/registry.ts`) stays the single id space; it is not edited in this slice. `registry.test.ts`, `shortcuts.test.ts` and `slashItems.test.ts` must stay green unchanged.
- Files stay under 500 lines.
- Test first: write the failing test, run it to see it fail, then the code, then run it to see it pass.
- Near-identical tests collapse into one table-driven test rather than a copy per unit; behaviour specific to one unit (Blockquote's `>` input rule, HorizontalRule's insert) keeps its own case inside that file.
- Never commit, push or switch branches without asking.
  souki makes every commit; a "Commit" step means stop and ask souki to commit, with the suggested message.
  Never add a `Co-Authored-By` trailer or name an agent as author.
- Work on `refactor/editor-buttons`, branched from `main` after slice 1 merged.
- Gates before handing back: `pnpm check:ci`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, all green with no new warnings or flaky retries.

## Review Focus

1. A misspelt icon name in a declaration must fail the typecheck rather than render an empty button; the old `as unknown as` cast let it through, so the helper is what makes this true (`@ts-expect-error` pin in Task 1).
2. A collapsed family's trigger icon and the Settings shortcut list read the resolved button's props through the registry; both must keep working for every moved extension (`registry.test.ts` and `shortcuts.test.ts` run in Task 2).
3. TextAlign's `types` and `alignments` options must survive the helper, or alignment silently no-ops on paragraphs (option assertions in Task 1's helper test and Task 2's TextAlign test).
4. A microphone permission error must toast once, not once per keystroke (Task 4's host test with a changing getter identity).
5. Toggling reduced motion while a note is open must reach the checklist flip plugin on the next tick, which is what the stable getter is for (Task 4's `useLatest` test pins "returns the latest value after a rerender").

---

### Task 1: `withButton` and a generic `ButtonView`

**Files:**
- Modify: `src/components/editor/extensions/button-types.ts`
- Create: `src/components/editor/extensions/withButton.ts`
- Create: `src/components/editor/extensions/withButton.test.ts`
- Modify: `src/components/editor/extensions/attachments/createAttachmentNode.ts` (the `button` field's return type)

**Interfaces:**
- Produces, from `button-types.ts`: `TFunction` and `ButtonContext` unchanged; `ButtonView<C extends ElementType = typeof ActionButton>` with `component: C` and `componentProps: ComponentProps<C>`; `AnyButtonView = ButtonView<ElementType>`; `ButtonOption<V = ButtonView | ButtonView[]> = { button: (context: ButtonContext) => V }`.
- Produces, from `withButton.ts`: `withButton<E extends Extendable>(upstream: E, button: (context: ButtonContext) => ButtonView | ButtonView[], options?: object): E`.
- Every existing importer of `ButtonView` keeps compiling: the default type parameter is the old shape.

- [ ] **Step 1: Write the failing test**

Create `src/components/editor/extensions/withButton.test.ts`:

```ts
import { Editor } from '@tiptap/core';
import { Bold as TiptapBold } from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import { Heading as TiptapHeading } from '@tiptap/extension-heading';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextAlign as TiptapTextAlign } from '@tiptap/extension-text-align';
import { afterEach, describe, expect, it } from 'vitest';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { ButtonOption, ButtonView } from './button-types';
import { withButton } from './withButton';

const t = (key: string) => key;

const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    icon: 'Bold',
    tooltip: t('editor.bold.tooltip'),
    toggle: true,
  },
}));

const Heading = withButton(TiptapHeading, ({ editor, t }) =>
  ([1, 2, 3] as const).map((level) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.chain().focus().toggleHeading({ level }).run(),
      isActive: () => editor.isActive('heading', { level }),
      icon: `Heading${level}`,
      tooltip: t(`editor.heading.h${level}`),
      toggle: true,
    },
  }))
);

const TextAlign = withButton(
  TiptapTextAlign,
  ({ editor, t }) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.chain().focus().toggleTextAlign('center').run(),
      isActive: () => editor.isActive({ textAlign: 'center' }),
      icon: 'AlignCenter',
      tooltip: t('editor.textAlign.center'),
      toggle: true,
    },
  }),
  { types: ['heading', 'paragraph'], alignments: ['left', 'center', 'right'] }
);

// Not a runtime case: a misspelt icon must fail the typecheck rather than render an empty button.
withButton(TiptapBold, () => ({
  component: ActionButton,
  // @ts-expect-error icon names are checked against the registry
  componentProps: { icon: 'Bolf' },
}));

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function createEditor() {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, Bold, Heading, TextAlign],
    content: '<p>hi</p>',
  });
  editors.push(editor);
  return editor;
}

function optionsOf(editor: Editor, name: string) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === name);
  if (!ext) throw new Error(`${name} not registered`);
  return ext.options as ButtonOption<ButtonView | ButtonView[]> & Record<string, unknown>;
}

describe('withButton', () => {
  it('keeps the upstream behaviour and adds the button', () => {
    const editor = createEditor();
    editor.commands.selectAll();
    editor.commands.toggleBold();
    expect(editor.getHTML()).toContain('<strong>');

    const view = optionsOf(editor, 'bold').button({ editor, t });
    if (Array.isArray(view)) throw new Error('bold yields one button');
    expect(view.component).toBe(ActionButton);
    expect(view.componentProps.icon).toBe('Bold');
    expect(view.componentProps.isActive?.()).toBe(true);
  });

  it('passes an array through for an extension that yields several buttons', () => {
    const editor = createEditor();
    const views = optionsOf(editor, 'heading').button({ editor, t });
    if (!Array.isArray(views)) throw new Error('heading yields three buttons');
    expect(views.map((v) => v.componentProps.icon)).toEqual(['Heading1', 'Heading2', 'Heading3']);
  });

  it('merges extra options under the button, so a wrapper can still configure upstream', () => {
    const editor = createEditor();
    const options = optionsOf(editor, 'textAlign');
    expect(options.types).toEqual(['heading', 'paragraph']);
    expect(options.alignments).toEqual(['left', 'center', 'right']);
    editor.commands.selectAll();
    editor.commands.setTextAlign('center');
    expect(editor.isActive({ textAlign: 'center' })).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/components/editor/extensions/withButton.test.ts`
Expected: FAIL, `./withButton` cannot be resolved.

- [ ] **Step 3: Make `ButtonView` generic**

Replace the contents of `src/components/editor/extensions/button-types.ts` with:

```ts
import type { Editor } from '@tiptap/core';
import type { ComponentProps, ElementType } from 'react';
import type { ActionButton } from '@/components/ui/ActionButton.tsx';

/** Subset of i18next's TFunction covering how button factories use it */
export type TFunction = (key: string, opts?: Record<string, unknown>) => string;

export interface ButtonContext {
  editor: Editor;
  t: TFunction;
}

/**
 * What an extension's `button` option yields: a component and the props to render it with.
 * Most leaves are `ActionButton`; a picker or a select names its own component.
 */
export interface ButtonView<C extends ElementType = typeof ActionButton> {
  component: C;
  componentProps: ComponentProps<C>;
}

/** A view of any component, for the places that render whatever an extension yields. */
export type AnyButtonView = ButtonView<ElementType>;

/** The option every Pattern A extension adds (ADR 0004): one view, or several (Heading yields three). */
export type ButtonOption<V = ButtonView | ButtonView[]> = {
  button: (context: ButtonContext) => V;
};
```

- [ ] **Step 4: Write the helper**

Create `src/components/editor/extensions/withButton.ts`:

```ts
import type { Extendable } from '@tiptap/core';
import type { ButtonContext, ButtonView } from './button-types';

/**
 * Pattern A in one place (ADR 0004): the upstream extension plus a `button` option. `options` are
 * any other defaults the wrapper sets (TextAlign's `types`). The one cast lives here, not per file.
 */
export function withButton<E extends Extendable>(
  upstream: E,
  button: (context: ButtonContext) => ButtonView | ButtonView[],
  options: object = {}
): E {
  return upstream.extend({
    addOptions() {
      return { ...this.parent?.(), ...options, button };
    },
  }) as E;
}
```

- [ ] **Step 5: Tell the truth in `createAttachmentNode`**

In `src/components/editor/extensions/attachments/createAttachmentNode.ts`, change the import `import type { TFunction } from '../button-types';` to `import type { AnyButtonView, TFunction } from '../button-types';` and the config field

```ts
  button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => unknown;
```

to

```ts
  button: (ctx: { editor: Editor; getDeps: () => AttachmentDeps; t: TFunction }) => AnyButtonView;
```

The five attachment factories already return `{ component: ImageButton, componentProps: {...} }` shapes, so nothing else changes.

- [ ] **Step 6: Run the tests and the typecheck**

Run: `pnpm vitest run src/components/editor/extensions/withButton.test.ts`
Expected: PASS, 3 tests.

Run: `pnpm exec tsc -b --noEmit`
Expected: no output. If the `@ts-expect-error` line reports "Unused '@ts-expect-error' directive", the helper's signature has lost its contextual typing; fix the helper, not the test.

Run: `pnpm vitest run src/components/editor` and `pnpm check:ci`
Expected: PASS and clean; nothing else has changed behaviour yet.

- [ ] **Step 7: Commit**

Stop and ask souki to commit:

```
refactor(editor): withButton builds a Pattern A extension; ButtonView is generic over its component
```

---

### Task 2: The ten one-button extensions become `formatting.ts`

**Files:**
- Create: `src/components/editor/extensions/formatting.ts`
- Create: `src/components/editor/extensions/formatting.test.ts`
- Delete the ten folders, three files each: `Bold/`, `Italic/`, `Strike/`, `Underline/`, `Code/`, `CodeBlock/`, `Blockquote/`, `HorizontalRule/`, `BulletList/`, `OrderedList/`
- Modify: `src/components/editor/extensions/build.ts` (imports)
- Modify: `src/components/editor/extensions/TaskList/TaskList.ts`, `TaskList/TaskList.test.ts`
- Modify: `src/components/editor/extensions/Heading/Heading.ts`, `Heading/Heading.test.ts`
- Modify: `src/components/editor/extensions/TextAlign/TextAlign.ts`, `TextAlign/TextAlign.test.ts`
- Modify: `src/components/editor/extensions/history/History.ts`, `history/History.test.ts`

**Interfaces:**
- Consumes: `withButton`, `ButtonOption`, `ButtonView` from Task 1.
- Produces: `formatting.ts` exports `Bold`, `Italic`, `Strike`, `Underline`, `Code`, `CodeBlock`, `Blockquote`, `HorizontalRule`, `BulletList`, `OrderedList`, each the same TipTap extension name, button, icon, tooltip key and shortcut as before. `TaskList`, `Heading`, `TextAlign`, `History` keep their export names and folders. The exported `XExtensionOptions` interfaces are gone; tests cast with `ButtonOption`.
- `Clear` is untouched: it is an `Extension.create` with its own shortcut, not a wrapper of an upstream extension.

- [ ] **Step 1: Write the failing table-driven test**

Create `src/components/editor/extensions/formatting.test.ts`:

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import type { Extendable } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';
import type { ButtonOption } from './button-types';
import {
  Blockquote,
  Bold,
  BulletList,
  Code,
  CodeBlock,
  HorizontalRule,
  Italic,
  OrderedList,
  Strike,
  Underline,
} from './formatting';

const t = (key: string) => key;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

function createEditor(extensions: Extendable[], content = '<p>hello</p>') {
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, ...extensions],
    content,
  });
  editors.push(editor);
  return editor;
}

function buttonProps(editor: Editor, name: string) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === name);
  if (!ext) throw new Error(`${name} not registered`);
  const view = (ext.options as ButtonOption).button({ editor, t });
  if (Array.isArray(view)) throw new Error(`${name} yields one button`);
  return view.componentProps;
}

// One row per toggle. `extra` is what the extension needs beside the document skeleton.
const TOGGLES = [
  { name: 'bold', ext: Bold, extra: [], toggle: (e: Editor) => e.commands.toggleBold(), html: '<strong>', icon: 'Bold', tooltip: 'editor.bold.tooltip', shortcut: ['Mod', 'B'] },
  { name: 'italic', ext: Italic, extra: [], toggle: (e: Editor) => e.commands.toggleItalic(), html: '<em>', icon: 'Italic', tooltip: 'editor.italic.tooltip', shortcut: ['Mod', 'I'] },
  { name: 'strike', ext: Strike, extra: [], toggle: (e: Editor) => e.commands.toggleStrike(), html: '<s>', icon: 'Strikethrough', tooltip: 'editor.strike.tooltip', shortcut: ['Mod', 'Shift', 'S'] },
  { name: 'underline', ext: Underline, extra: [], toggle: (e: Editor) => e.commands.toggleUnderline(), html: '<u>', icon: 'Underline', tooltip: 'editor.underline.tooltip', shortcut: ['Mod', 'U'] },
  { name: 'code', ext: Code, extra: [], toggle: (e: Editor) => e.commands.toggleCode(), html: '<code>', icon: 'Code', tooltip: 'editor.code.tooltip', shortcut: ['Mod', 'E'] },
  { name: 'codeBlock', ext: CodeBlock, extra: [], toggle: (e: Editor) => e.commands.toggleCodeBlock(), html: '<pre>', icon: 'Code2', tooltip: 'editor.codeBlock.tooltip', shortcut: ['Mod', 'Alt', 'C'] },
  { name: 'blockquote', ext: Blockquote, extra: [], toggle: (e: Editor) => e.commands.toggleBlockquote(), html: '<blockquote>', icon: 'Quote', tooltip: 'editor.blockquote.tooltip', shortcut: ['Mod', 'Shift', 'B'] },
  { name: 'bulletList', ext: BulletList, extra: [ListItem], toggle: (e: Editor) => e.commands.toggleBulletList(), html: '<ul>', icon: 'List', tooltip: 'editor.bulletList.tooltip', shortcut: ['Mod', 'Shift', '8'] },
  { name: 'orderedList', ext: OrderedList, extra: [ListItem], toggle: (e: Editor) => e.commands.toggleOrderedList(), html: '<ol>', icon: 'ListOrdered', tooltip: 'editor.orderedList.tooltip', shortcut: ['Mod', 'Shift', '7'] },
];

describe.each(TOGGLES)('$name', ({ name, ext, extra, toggle, html, icon, tooltip, shortcut }) => {
  it('toggles on the selection and reports itself active', () => {
    const editor = createEditor([...extra, ext]);
    editor.commands.selectAll();
    expect(editor.isActive(name)).toBe(false);
    toggle(editor);
    expect(editor.isActive(name)).toBe(true);
    expect(editor.getHTML()).toContain(html);
  });

  it('exposes a Pattern A toggle button whose action does the same', () => {
    const editor = createEditor([...extra, ext]);
    const props = buttonProps(editor, name);
    expect(props.icon).toBe(icon);
    expect(props.tooltip).toBe(tooltip);
    expect(props.shortcutKeys).toEqual(shortcut);
    expect(props.toggle).toBe(true);

    editor.commands.selectAll();
    expect(props.isActive?.()).toBe(false);
    props.action?.();
    expect(props.isActive?.()).toBe(true);
  });
});

describe('horizontalRule', () => {
  it('inserts a rule from its button, with no active state', () => {
    const editor = createEditor([HorizontalRule]);
    const props = buttonProps(editor, 'horizontalRule');
    expect(props.icon).toBe('Minus');
    expect(props.tooltip).toBe('editor.horizontalRule.tooltip');
    // A rule is an insert, not a toggle: there is no "cursor inside a rule".
    expect(props.isActive).toBeUndefined();
    expect(props.toggle).toBeUndefined();

    props.action?.();
    expect(editor.getHTML()).toContain('<hr');
  });
});

describe('blockquote', () => {
  it('turns "> " at the start of a paragraph into a blockquote', () => {
    const editor = createEditor([Blockquote], '<p></p>');
    editor.commands.focus();
    editor.commands.insertContent('>');
    const from = editor.state.selection.from;
    editor.view.someProp('handleTextInput', (f) =>
      f(editor.view, from, from, ' ', () => editor.view.state.tr)
    );
    expect(editor.getHTML()).toContain('<blockquote>');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run src/components/editor/extensions/formatting.test.ts`
Expected: FAIL, `./formatting` cannot be resolved.

- [ ] **Step 3: Write `formatting.ts`**

Create `src/components/editor/extensions/formatting.ts`:

```ts
import { Blockquote as TiptapBlockquote } from '@tiptap/extension-blockquote';
import { Bold as TiptapBold } from '@tiptap/extension-bold';
import { Code as TiptapCode } from '@tiptap/extension-code';
import { CodeBlock as TiptapCodeBlock } from '@tiptap/extension-code-block';
import { HorizontalRule as TiptapHorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Italic as TiptapItalic } from '@tiptap/extension-italic';
import {
  BulletList as TiptapBulletList,
  OrderedList as TiptapOrderedList,
} from '@tiptap/extension-list';
import { Strike as TiptapStrike } from '@tiptap/extension-strike';
import { Underline as TiptapUnderline } from '@tiptap/extension-underline';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { toggleWholeList } from './list-toggle';
import { withButton } from './withButton';

// The marks and blocks whose whole contribution is one toggle button. An extension with more
// than its declaration (a node view, a plugin, its own behaviour) keeps a folder of its own.

export const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    shortcutKeys: ['Mod', 'B'],
    icon: 'Bold',
    tooltip: t('editor.bold.tooltip'),
    toggle: true,
  },
}));

export const Italic = withButton(TiptapItalic, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleItalic(),
    isActive: () => editor.isActive('italic'),
    shortcutKeys: ['Mod', 'I'],
    icon: 'Italic',
    tooltip: t('editor.italic.tooltip'),
    toggle: true,
  },
}));

export const Strike = withButton(TiptapStrike, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleStrike(),
    isActive: () => editor.isActive('strike'),
    shortcutKeys: ['Mod', 'Shift', 'S'],
    icon: 'Strikethrough',
    tooltip: t('editor.strike.tooltip'),
    toggle: true,
  },
}));

export const Underline = withButton(TiptapUnderline, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleUnderline(),
    isActive: () => editor.isActive('underline'),
    shortcutKeys: ['Mod', 'U'],
    icon: 'Underline',
    tooltip: t('editor.underline.tooltip'),
    toggle: true,
  },
}));

export const Code = withButton(TiptapCode, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleCode(),
    isActive: () => editor.isActive('code'),
    shortcutKeys: ['Mod', 'E'],
    icon: 'Code',
    tooltip: t('editor.code.tooltip'),
    toggle: true,
  },
}));

/** Plain, not the lowlight variant: highlighting would pull in a grammar bundle for a block
 *  that mostly holds a command or a snippet verbatim. */
export const CodeBlock = withButton(TiptapCodeBlock, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleCodeBlock(),
    isActive: () => editor.isActive('codeBlock'),
    shortcutKeys: ['Mod', 'Alt', 'C'],
    icon: 'Code2',
    tooltip: t('editor.codeBlock.tooltip'),
    toggle: true,
  },
}));

export const Blockquote = withButton(TiptapBlockquote, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBlockquote(),
    isActive: () => editor.isActive('blockquote'),
    shortcutKeys: ['Mod', 'Shift', 'B'],
    icon: 'Quote',
    tooltip: t('editor.blockquote.tooltip'),
    toggle: true,
  },
}));

/** An insert, not a toggle, so the button has no active state. */
export const HorizontalRule = withButton(TiptapHorizontalRule, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.setHorizontalRule(),
    icon: 'Minus',
    tooltip: t('editor.horizontalRule.tooltip'),
  },
}));

export const BulletList = withButton(TiptapBulletList, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => toggleWholeList(editor, (chain) => chain.toggleBulletList()),
    isActive: () => editor.isActive('bulletList'),
    shortcutKeys: ['Mod', 'Shift', '8'],
    icon: 'List',
    tooltip: t('editor.bulletList.tooltip'),
    toggle: true,
  },
}));

export const OrderedList = withButton(TiptapOrderedList, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => toggleWholeList(editor, (chain) => chain.toggleOrderedList()),
    isActive: () => editor.isActive('orderedList'),
    shortcutKeys: ['Mod', 'Shift', '7'],
    icon: 'ListOrdered',
    tooltip: t('editor.orderedList.tooltip'),
    toggle: true,
  },
}));
```

- [ ] **Step 4: Run the new test to verify it passes**

Run: `pnpm vitest run src/components/editor/extensions/formatting.test.ts`
Expected: PASS, 20 tests (9 rows times 2, plus 2).

- [ ] **Step 5: Repoint `build.ts` and delete the ten folders**

In `src/components/editor/extensions/build.ts`, delete the ten imports from `./Blockquote`, `./Bold`, `./BulletList`, `./Code`, `./CodeBlock`, `./HorizontalRule`, `./Italic`, `./OrderedList`, `./Strike`, `./Underline` and add one:

```ts
import {
  Blockquote,
  Bold,
  BulletList,
  Code,
  CodeBlock,
  HorizontalRule,
  Italic,
  OrderedList,
  Strike,
  Underline,
} from './formatting';
```

The order of the `return [...]` list does not change. Then delete the folders with git, so the deletion is staged as a deletion rather than left as untracked noise:

```bash
cd src/components/editor/extensions
git rm -rq Bold Italic Strike Underline Code CodeBlock Blockquote HorizontalRule BulletList OrderedList
```

(This is the one index-changing git command this task may run.)

- [ ] **Step 6: TaskList, Heading, TextAlign and History on the helper, in their folders**

Replace the contents of `src/components/editor/extensions/TaskList/TaskList.ts` with:

```ts
import { TaskList as TiptapTaskList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { toggleWholeList } from '../list-toggle';
import { withButton } from '../withButton';

export const TaskList = withButton(TiptapTaskList, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => toggleWholeList(editor, (chain) => chain.toggleTaskList()),
    isActive: () => editor.isActive('taskList'),
    icon: 'ListTodo',
    shortcutKeys: ['Mod', 'Shift', '9'],
    tooltip: t('editor.taskList.tooltip'),
    toggle: true,
  },
}));
```

Replace the contents of `src/components/editor/extensions/Heading/Heading.ts` with:

```ts
import { Heading as TiptapHeading } from '@tiptap/extension-heading';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';

const HEADING_LEVELS = [1, 2, 3] as const;

export const Heading = withButton(TiptapHeading, ({ editor, t }) =>
  HEADING_LEVELS.map((level) => ({
    component: ActionButton,
    componentProps: {
      action: () => editor.chain().focus().toggleHeading({ level }).run(),
      isActive: () => editor.isActive('heading', { level }),
      shortcutKeys: ['Mod', 'Alt', String(level)],
      icon: `Heading${level}`,
      // The key the registry labels this leaf with, so there is one string to translate.
      // It must exist: the bar rebuilds per keystroke, so a missing key warns per keystroke.
      tooltip: t(`editor.heading.h${level}`),
      toggle: true,
    },
  }))
);
```

Replace the contents of `src/components/editor/extensions/TextAlign/TextAlign.ts` with:

```ts
import { TextAlign as TiptapTextAlign } from '@tiptap/extension-text-align';
import type { IconName } from '@/components/icons';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';

const ALIGNMENTS = ['left', 'center', 'right'] as const;
type Alignment = (typeof ALIGNMENTS)[number];

const ICONS: Record<Alignment, IconName> = {
  left: 'AlignLeft',
  center: 'AlignCenter',
  right: 'AlignRight',
};

/** Hints for upstream's existing bindings; nothing new is bound here. */
const SHORTCUTS: Record<Alignment, string[]> = {
  left: ['Mod', 'Shift', 'L'],
  center: ['Mod', 'Shift', 'E'],
  right: ['Mod', 'Shift', 'R'],
};

/** `justify` is left out: it reads badly at note width. Without `types` naming the blocks
 *  that carry the attribute, the commands silently no-op. */
export const TextAlign = withButton(
  TiptapTextAlign,
  ({ editor, t }) =>
    ALIGNMENTS.map((alignment) => ({
      component: ActionButton,
      componentProps: {
        action: () => editor.chain().focus().toggleTextAlign(alignment).run(),
        isActive: () => editor.isActive({ textAlign: alignment }),
        icon: ICONS[alignment],
        shortcutKeys: SHORTCUTS[alignment],
        tooltip: t(`editor.textAlign.${alignment}`),
        toggle: true,
      },
    })),
  { types: ['heading', 'paragraph'], alignments: [...ALIGNMENTS] }
);
```

Replace the contents of `src/components/editor/extensions/history/History.ts` with:

```ts
import { History as TiptapHistory } from '@tiptap/extension-history';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import { withButton } from '../withButton';

interface HistoryItem {
  command: 'undo' | 'redo';
  icon: 'Undo2' | 'Redo2';
  shortcutKeys: string[];
}

const HISTORY_ITEMS: HistoryItem[] = [
  { command: 'undo', icon: 'Undo2', shortcutKeys: ['Mod', 'Z'] },
  { command: 'redo', icon: 'Redo2', shortcutKeys: ['Mod', 'Shift', 'Z'] },
];

export const History = withButton(
  TiptapHistory,
  ({ editor, t }) =>
    HISTORY_ITEMS.map(({ command, icon, shortcutKeys }) => ({
      component: ActionButton,
      componentProps: {
        action: () => {
          const chain = editor.chain().focus();
          if (command === 'undo') chain.undo().run();
          else chain.redo().run();
        },
        shortcutKeys,
        disabled: command === 'undo' ? !editor.can().undo() : !editor.can().redo(),
        icon,
        tooltip: t(`editor.${command}`),
      },
    })),
  { depth: 100, newGroupDelay: 500 }
);
```

- [ ] **Step 7: Repoint the four tests' casts**

The four folders' tests imported a per-file options interface that no longer exists. In each, replace the type import and the cast:

- `TaskList/TaskList.test.ts`: `import { TaskList, type TaskListExtensionOptions } from './TaskList';` becomes `import type { ButtonOption } from '../button-types';` plus `import { TaskList } from './TaskList';`, and `(ext.options as TaskListExtensionOptions).button({ editor, t }).componentProps` becomes `(ext.options as ButtonOption<ButtonView>).button({ editor, t }).componentProps` with `ButtonView` added to the type import.
- `Heading/Heading.test.ts`: `import { Heading, type HeadingExtensionOptions } from './Heading';` becomes `import type { ButtonOption, ButtonView } from '../button-types';` plus `import { Heading } from './Heading';`, and `(ext.options as HeadingExtensionOptions).button({ editor, t })` becomes `(ext.options as ButtonOption<ButtonView[]>).button({ editor, t })`.
- `TextAlign/TextAlign.test.ts`: the same shape as Heading (an array), whatever the current cast's name is; keep every assertion.
- `history/History.test.ts`: `import type { HistoryOptions } from './History';` goes; add `import type { ButtonOption, ButtonView } from '../button-types';` and cast `(extension.options as ButtonOption<ButtonView[]>).button({ editor, t })`. Leave `history/attachment-undo.test.ts` alone unless it imports the removed type.

Keep every assertion in those four files as it is.

- [ ] **Step 8: Run the editor suite, the typecheck and Biome**

Run: `pnpm vitest run src/components/editor`
Expected: PASS. The registry, shortcuts and slash-menu suites are in this directory and must be green without edits: they resolve buttons by extension name through the live editor, and the names are unchanged.

Run: `pnpm exec tsc -b --noEmit` and `pnpm check:ci`
Expected: no output and clean (run `pnpm check` first if the import order needs sorting).

Run: `grep -rn "extensions/\(Bold\|Italic\|Strike\|Underline\|Code\|CodeBlock\|Blockquote\|HorizontalRule\|BulletList\|OrderedList\)/" src e2e --include='*.ts' --include='*.tsx'`
Expected: no output.

- [ ] **Step 9: Commit**

Stop and ask souki to commit:

```
refactor(editor): the ten one-button extensions are declarations in formatting.ts with one table test
```

---

### Task 3: A `variant` is a prop, not a wrapper component

**Files:**
- Modify: `src/components/editor/extensions/Color/Color.ts`
- Modify: `src/components/editor/extensions/Highlight/Highlight.ts`
- Modify: `src/components/editor/extensions/FontFamily/FontFamily.ts`
- Modify: `src/components/editor/extensions/FontSize/FontSize.ts`
- Modify: `src/components/editor/extensions/Link/Link.ts`
- Delete: `Color/TextColorButton.tsx`, `Highlight/HighlightButton.tsx`, `FontFamily/FontFamilyButton.tsx`, `FontSize/FontSizeButton.tsx`
- Test: `Color/Color.test.ts`, `Highlight/Highlight.test.ts`, `FontFamily/FontFamily.test.ts`, `FontSize/FontSize.test.ts`, `Link/Link.test.ts` (existing, must stay green; they assert the component is a function and the tooltip and editor props)

**Interfaces:**
- Consumes: generic `ButtonView<C>` from Task 1.
- Produces: `Color`'s button yields `ButtonView<typeof EditorColorPickerButton>` with `variant: 'text'`; `Highlight` the same with `variant: 'highlight'` and its shortcut; `FontFamily` and `FontSize` yield `ButtonView<typeof EditorTextStyleSelect>` with `variant: 'fontFamily'` / `'fontSize'`; `Link` yields `ButtonView<typeof LinkButton>`. The local `XButtonView` interfaces are gone. `EditorColorPickerButton` and `EditorTextStyleSelect` are unchanged.

- [ ] **Step 1: Run the five tests to see them green before the change**

Run: `pnpm vitest run src/components/editor/extensions/Color src/components/editor/extensions/Highlight src/components/editor/extensions/FontFamily src/components/editor/extensions/FontSize src/components/editor/extensions/Link`
Expected: PASS.

- [ ] **Step 2: Rewrite the five extensions**

Replace the contents of `Color/Color.ts` with:

```ts
import { type ColorOptions, Color as TiptapColor } from '@tiptap/extension-text-style';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorColorPickerButton } from '../EditorColorPickerButton';

export interface ColorExtensionOptions extends ColorOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorColorPickerButton>;
}

/** `TextStyle` must also be registered, or the color attribute does not exist. */
export const Color = TiptapColor.extend<ColorExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorColorPickerButton> => ({
        component: EditorColorPickerButton,
        componentProps: { editor, tooltip: t('editor.textColor.tooltip'), variant: 'text' },
      }),
    } as unknown as ColorExtensionOptions;
  },
});
```

In `Highlight/Highlight.ts`: delete `import type { ComponentProps } from 'react';` and `import { HighlightButton } from './HighlightButton';`, add `import { EditorColorPickerButton } from '../EditorColorPickerButton';`, change the `ButtonContext` import to `import type { ButtonContext, ButtonView } from '../button-types';`, delete the `HighlightButtonView` interface, and make the options and the button:

```ts
export interface HighlightExtensionOptions extends BackgroundColorOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorColorPickerButton>;
}
```

```ts
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorColorPickerButton> => ({
        component: EditorColorPickerButton,
        componentProps: {
          editor,
          tooltip: t('editor.highlight.tooltip'),
          shortcutKeys: ['Mod', 'Shift', 'H'],
          variant: 'highlight',
        },
      }),
```

Everything else in that file (the shortcut colour, `addKeyboardShortcuts`) stays.

Replace the contents of `FontFamily/FontFamily.ts` with:

```ts
import {
  type FontFamilyOptions,
  FontFamily as TiptapFontFamily,
} from '@tiptap/extension-text-style';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorTextStyleSelect } from '../EditorTextStyleSelect';

export interface FontFamilyExtensionOptions extends FontFamilyOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorTextStyleSelect>;
}

/** `TextStyle` must also be registered, or the fontFamily attribute does not exist. */
export const FontFamily = TiptapFontFamily.extend<FontFamilyExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorTextStyleSelect> => ({
        component: EditorTextStyleSelect,
        componentProps: { editor, t, tooltip: t('editor.fontFamily.tooltip'), variant: 'fontFamily' },
      }),
    } as unknown as FontFamilyExtensionOptions;
  },
});
```

Replace the contents of `FontSize/FontSize.ts` with:

```ts
import { type FontSizeOptions, FontSize as TiptapFontSize } from '@tiptap/extension-text-style';
import type { ButtonContext, ButtonView } from '../button-types';
import { EditorTextStyleSelect } from '../EditorTextStyleSelect';

export interface FontSizeExtensionOptions extends FontSizeOptions {
  button: (context: ButtonContext) => ButtonView<typeof EditorTextStyleSelect>;
}

/** `TextStyle` must also be registered, or the fontSize attribute does not exist. */
export const FontSize = TiptapFontSize.extend<FontSizeExtensionOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }: ButtonContext): ButtonView<typeof EditorTextStyleSelect> => ({
        component: EditorTextStyleSelect,
        componentProps: { editor, t, tooltip: t('editor.fontSize.tooltip'), variant: 'fontSize' },
      }),
    } as unknown as FontSizeExtensionOptions;
  },
});
```

In `Link/Link.ts`: delete `import type { ComponentProps } from 'react';`, change the button-types import to `import type { ButtonContext, ButtonView, TFunction } from '../button-types';`, delete the `LinkButtonView` interface, and make the options

```ts
export interface LinkExtensionOptions extends LinkOptions {
  button: (context: ButtonContext) => ButtonView<typeof LinkButton>;
}
```

In `addOptions`, annotate the button arrow as `button: ({ editor, t: translate }: ButtonContext): ButtonView<typeof LinkButton> => ({` so its props are checked despite the `as unknown as` cast (the same annotation is on the four extensions above). Everything else in `Link.ts` stays.

- [ ] **Step 3: Delete the four wrappers**

```bash
cd src/components/editor/extensions
git rm -q Color/TextColorButton.tsx Highlight/HighlightButton.tsx FontFamily/FontFamilyButton.tsx FontSize/FontSizeButton.tsx
```

Run: `grep -rn "TextColorButton\|HighlightButton\|FontFamilyButton\|FontSizeButton" src e2e --include='*.ts' --include='*.tsx'`
Expected: no output. If a test or a doc-string still names one, that is a finding for the report, not a reason to keep the file.

- [ ] **Step 4: Run the tests, the typecheck and Biome**

Run: `pnpm vitest run src/components/editor` then `pnpm exec tsc -b --noEmit` and `pnpm check:ci`
Expected: PASS, no output, clean. The five tests assert `typeof result.component === 'function'`, which both shared components satisfy.

- [ ] **Step 5: Commit**

Stop and ask souki to commit:

```
refactor(editor): a colour or font variant is a prop in the extension's view, not a wrapper component
```

---

### Task 4: `useLatest`, and the microphone error toasts once

**Files:**
- Create: `src/hooks/useLatest.ts`
- Create: `src/hooks/useLatest.test.ts`
- Modify: `src/components/editor/editor.tsx` (the two ref-plus-getter triples and the `AudioRecorderHost` prop)
- Modify: `src/components/editor/extensions/Audio/AudioRecorderHost.tsx`
- Modify: `src/components/editor/extensions/Audio/AudioRecorderHost.test.tsx`

**Interfaces:**
- Produces: `useLatest<T>(value: T): () => T`, a getter whose identity never changes and whose result is the value from the latest render.
- `AudioRecorderHost` keeps its props (`editor`, `getDeps: () => AttachmentDeps`) but no longer re-runs its error effect when `getDeps` changes identity.

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useLatest.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLatest } from './useLatest.ts';

describe('useLatest', () => {
  it('returns one getter for the life of the component, answering with the latest value', () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 1 },
    });
    const getter = result.current;
    expect(getter()).toBe(1);

    rerender({ value: 2 });
    expect(result.current).toBe(getter);
    expect(getter()).toBe(2);
  });
});
```

Run: `pnpm vitest run src/hooks/useLatest.test.ts`
Expected: FAIL, `./useLatest.ts` cannot be resolved.

- [ ] **Step 2: Write the hook**

Create `src/hooks/useLatest.ts`:

```ts
import { useRef } from 'react';

/**
 * A stable getter over the latest value, for callbacks built once that must see the current
 * render (the editor's extensions are built on mount and read live deps through this).
 */
export function useLatest<T>(value: T): () => T {
  const ref = useRef(value);
  // Written after commit: React's ref rule forbids touching a ref during render.
  useLayoutEffect(() => {
    ref.current = value;
  });
  return useCallback(() => ref.current, []);
}
```

Run: `pnpm vitest run src/hooks/useLatest.test.ts`
Expected: PASS.

- [ ] **Step 3: Write the failing host test**

In `src/components/editor/extensions/Audio/AudioRecorderHost.test.tsx`, add after the `vi.mock('./RecordingWaveform', ...)` line:

```ts
vi.mock('sonner', () => ({ toast: vi.fn() }));
```

add `import { toast } from 'sonner';` with the other imports, reset it in `beforeEach` with `vi.mocked(toast).mockClear();` and `(recorder as { error: string | null }).error = null;`, and add this case inside the `describe`:

```ts
  it('toasts a recorder error once, however often the deps getter changes identity', () => {
    const { editor } = makeEditor();
    recorder.status = 'error';
    (recorder as { error: string | null }).error = 'failed';
    const { rerender } = render(<AudioRecorderHost editor={editor} getDeps={getDeps} />);
    expect(toast).toHaveBeenCalledTimes(1);

    // A parent that passes a fresh arrow function each render must not re-fire the toast.
    rerender(<AudioRecorderHost editor={editor} getDeps={() => getDeps()} />);
    rerender(<AudioRecorderHost editor={editor} getDeps={() => getDeps()} />);

    expect(toast).toHaveBeenCalledTimes(1);
  });
```

Run: `pnpm vitest run src/components/editor/extensions/Audio/AudioRecorderHost.test.tsx`
Expected: the new case FAILS with `toast` called 3 times: the effect lists `getDeps` as a dependency, so every new identity re-runs it. That is the bug the survey found in a browser-equivalent test.

- [ ] **Step 4: Fix the host**

In `src/components/editor/extensions/Audio/AudioRecorderHost.tsx`, add `import { useLatest } from '@/hooks/useLatest.ts';`, then inside the component replace

```ts
  useEffect(() => {
    if (rec.status === 'error') {
      toast(getDeps().t(ERROR_KEY[rec.error ?? 'failed'] ?? ERROR_KEY.failed));
    }
  }, [rec.status, rec.error, getDeps]);
```

with

```ts
  // Read through a stable getter: a parent handing in a new `getDeps` each render must not
  // re-run this effect, or one error toasts on every keystroke.
  const deps = useLatest(getDeps());
  useEffect(() => {
    if (rec.status === 'error') {
      toast(deps().t(ERROR_KEY[rec.error ?? 'failed'] ?? ERROR_KEY.failed));
    }
  }, [rec.status, rec.error, deps]);
```

and in `onStop` change `const deps = getDeps();` to `const d = deps();` and the following uses of `deps.` in that function to `d.`.

Run: `pnpm vitest run src/components/editor/extensions/Audio/AudioRecorderHost.test.tsx`
Expected: PASS, all cases including the new one.

- [ ] **Step 5: Fold the editor's triples onto the hook**

In `src/components/editor/editor.tsx`, add `import { useLatest } from '@/hooks/useLatest.ts';`. Replace

```ts
  // useEditor builds the extensions once, so they must reach the *current* deps
  // through a stable getter over a ref, not the first-render closure.
  const attachmentDepsRef = useRef(attachmentDeps);
  attachmentDepsRef.current = attachmentDeps;
  const getAttachmentDeps = useRef(() => attachmentDepsRef.current).current;

  // Same reason: the checklist FLIP plugin must see reduced motion as it is when a
  // box is ticked. It is a hard killswitch (DESIGN.md Motion).
  const animateChecklistRef = useRef(!reducedMotion);
  animateChecklistRef.current = !reducedMotion;
  const getAnimateChecklist = useRef(() => animateChecklistRef.current).current;
```

with

```ts
  // useEditor builds the extensions once, so they must reach the *current* deps
  // through a stable getter, not the first-render closure.
  const getAttachmentDeps = useLatest(attachmentDeps);
  // Same reason: the checklist FLIP plugin must see reduced motion as it is when a
  // box is ticked. It is a hard killswitch (DESIGN.md Motion).
  const getAnimateChecklist = useLatest(!reducedMotion);
```

Then replace every remaining `attachmentDepsRef.current` in the file with `getAttachmentDeps()` (three in `editorProps`: `handlePaste` twice, `handleDrop` once) and change the host line to

```tsx
          <AudioRecorderHost editor={editor} getDeps={getAttachmentDeps} />
```

Run: `grep -n "attachmentDepsRef\|animateChecklistRef" src/components/editor/editor.tsx`
Expected: no output. If `useRef` is now unused in the import, Biome will say; remove it only if so (the file still uses `useRef` elsewhere).

- [ ] **Step 5b: Keep ESLint and Biome in agreement**

The pre-commit hook runs ESLint (`pnpm lint`) as well as Biome. ESLint's `react-hooks/refs` forbids reading or writing a ref during render, which is why the hook writes in a layout effect and returns a `useCallback` getter, and its `exhaustive-deps` cannot see that a custom hook's result is stable, so the getters are listed in every dependency array that reads them (`[getAttachmentDeps, getAnimateChecklist, t]` for the extensions memo, `[getAttachmentDeps]` for `editorProps`, and appended to the intent effect and `handleExcalidrawSave`). Do not declare `useLatest` stable in `biome.json`: Biome would then reject those same entries.

- [ ] **Step 6: Run the editor suite, the typecheck and Biome**

Run: `pnpm vitest run src/components/editor src/hooks/useLatest.test.ts` then `pnpm exec tsc -b --noEmit` and `pnpm check:ci`
Expected: PASS, no output, clean. `editor.test.tsx`'s "Editor content syncing" suite is the guard that the extensions still see live deps.

- [ ] **Step 7: Commit**

Stop and ask souki to commit:

```
fix(editor): useLatest for the once-built extensions; a microphone error toasts once
```

---

### Task 5: Docs follow the code, then every gate

**Files:**
- Modify: `src/components/editor/CLAUDE.md`
- Modify: `CLAUDE.md` (the Editor section and the Key conventions line)
- Modify: `PLAN.md` (M6 slice 2)
- Modify: `src/components/editor/PLAN.md` (two pointers to the deleted `Bold/` folder)
- Modify: `docs/adr/0004-canonical-editor-toolbar-pattern.md` (one pointer, history kept)

- [ ] **Step 1: `src/components/editor/CLAUDE.md`**

In the Structure list, replace the bullet that begins `- \`extensions/<Name>/\` — one folder per editing capability.` with:

```
- `extensions/formatting.ts` holds the one-button marks and blocks (Bold, Italic, Strike, Underline, Code, CodeBlock, Blockquote, HorizontalRule, BulletList, OrderedList) as declarations through `withButton`; `extensions/<Name>/` is a folder for an extension that has more than its declaration (a node view, a plugin, a coordinator, its own behaviour test), with `<Name>.ts` and an `index.ts` re-export.
```

In the `editor.tsx` bullet, change `every live value reaches the built extensions through a stable getter over a ref` to `every live value from a render reaches the built extensions through \`useLatest\`, a stable getter over a ref (the editor itself arrives through \`editorRef\`, which an effect sets once it exists)`, and in the same line replace the em dash before `so a consumer` with a plain dash.

Replace the heading `## Canonical pattern (Pattern A — target state)` and its code block (through the closing fence) with:

```
## Canonical pattern (Pattern A)

The common case is the upstream TipTap extension plus a `button` option, built by `withButton` (`extensions/withButton.ts`), which does the `.extend()` and the one cast:

```ts
export const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    icon: 'Bold',                       // string key into icons.ts
    shortcutKeys: ['Mod', 'B'],
    tooltip: t('editor.bold.tooltip'),  // i18n
    toggle: true,
  },
}));
```

A third argument carries other upstream defaults (TextAlign's `types`). An extension whose button is not an `ActionButton` (a colour picker, a font select, the link picker) still calls `.extend()` itself and types its option as `ButtonView<typeof ThatComponent>`; the attachment nodes get their button from `createAttachmentNode`, typed `AnyButtonView`; `ButtonView` (`button-types.ts`) is generic over the component and defaults to `ActionButton`.
```

Keep the three bullets that follow (`icon` is a string key; a `button` may return an array; tooltips through `t`).

Change the heading `## Current state (mismatch to fix in M1)` to `## Current state`, and in its first bullet replace the span from `**Wrapped extensions following Pattern A, each with a headless test:**` up to and including `\`extensions/build.ts\` registers all of them, \`history\` included.` with:

```
**Every toolbar extension follows Pattern A.** The ten one-button marks and blocks are declarations in `extensions/formatting.ts` with one table-driven test; `TaskList`, `Heading` (H1-H3 buttons, see below), `TextAlign`, and `history` use the same `withButton` in their folders; `Mathematics` (LaTeX, see below) keeps its own `.extend()` and factory around an `ActionButton`; `Color`/`Highlight`/`FontFamily`/`FontSize` (text styling, see below) and `Link` yield their own components. `extensions/build.ts` registers all of them, `history` included.
```

In the Text styling bullets: change `use thin Pattern A adapters over \`extensions/EditorColorPickerButton.tsx\`` to `yield \`extensions/EditorColorPickerButton.tsx\` with their \`variant\``, change `use thin Pattern A adapters over \`extensions/EditorTextStyleSelect.tsx\`` to `yield \`extensions/EditorTextStyleSelect.tsx\` with their \`variant\``, and delete the sentence `Both live in their own \`FontSection\`.`

In Testing extensions, change `\`extensions/Bold/Bold.test.ts\` is the canonical template.` to `\`extensions/formatting.test.ts\` is the canonical template: one table, one row per extension, plus a case for anything only one of them does.`

Three more lines in the same file, found during execution: in the intro paragraph, change `brings the code in line with it` to `brought the code in line with it`; under `## Current state`, delete the line `Pattern A is partly adopted:` and the blank line after it; replace the closing line that begins `When editing here, follow Pattern A for new work and migrate the above` with `When editing here, follow Pattern A: a new toolbar button is a \`withButton\` declaration (or a \`ButtonView<typeof X>\` option for a custom component), never a toolbar-side array.`

- [ ] **Step 2: Root `CLAUDE.md`**

In the Editor section, replace everything from the line `Each editor extension lives in its own folder under \`src/components/editor/extensions/<ExtensionName>/\`. The pattern is:` through the end of the `> **Canonical vs. legacy.** ...` blockquote with:

```
Most toolbar extensions are the upstream TipTap extension plus an `ActionButton` `button` option, built by `withButton` (`src/components/editor/extensions/withButton.ts`); a custom component types its option `ButtonView<typeof X>`:

```ts
export const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: { action, isActive, icon: 'Bold', tooltip: t('editor.bold.tooltip'), shortcutKeys: ['Mod', 'B'], toggle: true },
}));
```

The one-button marks and blocks are declarations in `extensions/formatting.ts`; an extension with more than its declaration (a node view, a plugin, a coordinator) has a folder `extensions/<Name>/` with `<Name>.ts` and an `index.ts` re-export.
The `icon` prop is a **string key** resolved via `src/components/icons/icons.ts`, which maps names to Lucide icon components. When adding a new icon for a toolbar button, add it to that registry.

`ActionButton` (`src/components/ui/ActionButton.tsx`) is the shared toolbar button: wraps a Radix Toggle/Button with Tooltip and resolves the icon string from the registry.
Pattern A (extension-owned buttons, [ADR 0004](./docs/adr/0004-canonical-editor-toolbar-pattern.md)) is the only pattern; the toolbar itself is the registry in `toolbar/` ([ADR 0011](./docs/adr/0011-toolbar-items-and-families.md)).
See [`src/components/editor/CLAUDE.md`](./src/components/editor/CLAUDE.md).
```

In Key conventions, replace `- **New TipTap extensions**: Follow the per-folder pattern with \`ExtensionName.ts\` + \`index.ts\`. Add the button factory with \`ActionButton\` as the component.` with:

```
- **New TipTap extensions**: `withButton(Upstream, ctx => view)` for an `ActionButton`, a `ButtonView<typeof X>` option for a custom component; a one-button mark or block is a declaration in `extensions/formatting.ts`, anything with more than its declaration gets a folder with `<Name>.ts` + `index.ts`.
```

- [ ] **Step 2b: Pointers to the deleted `Bold/` folder**

Both files are records of earlier decisions, so change only the dead paths, nothing else.

`src/components/editor/PLAN.md`: in the headless-tests blockquote, change `See \`extensions/Bold/Bold.test.ts\` for the template.` to `See \`extensions/formatting.test.ts\` for the template.`; in section 3's first bullet, change `(model on \`extensions/Bold/Bold.ts\` and \`extensions/history/History.ts\`)` to `(model on \`extensions/formatting.ts\` and \`extensions/history/History.ts\`)` and `as \`Tiptap<X>.extend()\`` to `as \`withButton(Tiptap<X>, ...)\``; in section 4's Styling line, change `\`TextColorButton\` popover` to `\`EditorColorPickerButton\` with \`variant: 'text'\``, `\`HighlightButton\`, same panel` to `\`EditorColorPickerButton\` with \`variant: 'highlight'\`, same panel`, and delete `, own \`FontSection\``, and replace that line's em dash with a plain dash.

`docs/adr/0004-canonical-editor-toolbar-pattern.md`: in the Pattern A bullet, change `Used by \`extensions/Bold/Bold.ts\` and \`extensions/history/History.ts\`.` to `Used by \`extensions/Bold/Bold.ts\` and \`extensions/history/History.ts\` at the time; since M6 slice 2 the one-button extensions are declarations in \`extensions/formatting.ts\` through \`withButton\`.`; in the two bullet titles replace the em dash with a plain dash (`**Pattern A - extension-owned button.**`, `**Pattern B - centralized toolbar array.**`).

- [ ] **Step 3: `PLAN.md`**

Mark M6 slice 2 `✅` and append one `   Deviations:` line (three-space indent) after its text:

```
   Deviations: ten extensions moved to `formatting.ts`, not eleven: `TaskList` keeps its folder because `ChecklistFlip` lives there, and uses `withButton` in place; `Clear` is untouched (an `Extension.create` with its own shortcut, not a wrapper); the `useLatest` getter also guards `AudioRecorderHost` itself, so the toast fix holds whatever a parent passes; nine test files outside the plan's lists imported from the deleted folders and had only their import lines repointed; `useLatest` folds two of the three ref-plus-getter triples, since `editorRef` is assigned from the editor's lifecycle rather than read from a render and stays a plain ref; `EditorColorPickerButton.test.tsx` and `EditorTextStyleSelect.test.tsx` now render the shared component with an explicit `variant` because the wrappers they rendered are gone; `Mathematics` stays on its own `.extend()` because `createMathematics` extends it again with `getEditor`; `useLatest` writes its ref in a layout effect and hands out a `useCallback` getter, because ESLint's `react-hooks/refs` forbids ref access during render, and the getters sit in dependency arrays because `exhaustive-deps` cannot see that a custom hook's result is stable.
```

Append these bullets at the end of the M6 **Tickets** list (found during the whole-branch review):

```
- `AnyButtonView` checks nothing about props; making `AttachmentNodeConfig` generic over its component would let `createAttachmentNode` check `componentProps`.
- `withButton`'s `options: object` does not check upstream option names, so a misspelt `types` in TextAlign compiles; typing it as `Partial` of the upstream's options would close that.
- `toolbar/registry.ts` types every leaf as an `ActionButton` view though twelve yield another component; the only typed read is the optional `isActive`.
- Color, Highlight, FontFamily, FontSize and Mathematics are candidates for `withButton` (an overload for custom components, a factory for Mathematics), and the four near-identical text-style tests for one table.
- `SyncProvider.tsx` keeps three latest-value refs written in effects; candidates for `useLatest` once the effect timing is checked.
- `AudioRecorderHost` snapshots `getDeps()` at its own render; `useLatest(getDeps)` read as `deps()()` would read at use time if the host is ever memoised.
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
Expected: all green, no new warnings, no flaky retries. The e2e run matters: the editor toolbar and the slash menu resolve every moved button through the live editor, and `e2e/editor-focus.spec.ts` and `e2e/checklist.spec.ts` exercise them.

- [ ] **Step 5: Commit**

Stop and ask souki to commit:

```
docs(editor): Pattern A through withButton; a folder is for more than a declaration
```

---

## Not in this plan

- Pinning the registry's icons to the extensions' icons by test (the survey found none drifted; a later docs-and-tests pass may add it).
- Moving `Color`, `Highlight`, `FontFamily`, `FontSize` and `Link` onto `withButton`: the helper types `ActionButton` views only, and an overload for custom components is an abstraction with no third caller yet.
- `src/types.ts` (`ButtonViewReturnComponentProps`), which `ActionButton` imports for two field types; folding it into `button-types.ts` would make `ui/` import from `editor/`.
- The slash menu's and the registry's per-render button resolution cost (survey, section B, "Button factories run several times per render"): unmeasured, and not a duplication.
