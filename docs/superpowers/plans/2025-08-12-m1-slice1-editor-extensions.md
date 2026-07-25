# M1 Slice 1 — Editor Extensions & Test Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unblock the build, stand up the Vitest + Playwright test foundation, build the Pattern A toolbar renderer, and ship each editor extension (marks → blocks/lists → styling) test-first, one extension per commit.

**Architecture:** Each TipTap extension owns its toolbar button via a `button` option (Pattern A, [ADR 0004](../../adr/0004-canonical-editor-toolbar-pattern.md)). A pure `collectToolbarButtons(editor, t)` function gathers every extension's button config; a thin `ExtensionToolbar` component renders them. `editor.tsx` registers the wrapped extensions and renders `ExtensionToolbar`, retiring the legacy Pattern B `FormatSection`/`ListSection`.

**Tech Stack:** React 19, TipTap v3, Vitest + React Testing Library + `fake-indexeddb`, Playwright, i18next, Biome.

**Methodology:** Pragmatic TDD (red → green → refactor) per [ADR 0003](../../adr/0003-testing-stack-vitest-and-playwright.md). Each extension lands with its contract test in the same commit. Live-test in the running app (`pnpm dev`) after each phase.

**Out of scope (deferred to the M3 media plan):** `Image`, `Video`, `Attachment`, `Excalidraw`, and the `FontFamily`/`FontSize` toolbar buttons (they need select UI). Those stub folders are left untouched here.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types.ts` | Add `ToolbarButtonConfig`, `ButtonFactory`, `WithButtonOption` contract types |
| `src/components/icons/icons.ts` | Typed string→Lucide registry; expand to all toolbar icons |
| `src/components/editor/menus/toolbar.ts` | **New.** Pure `collectToolbarButtons(editor, t)` |
| `src/components/editor/menus/ExtensionToolbar.tsx` | **New.** Renders the collected button configs |
| `src/components/ui/ActionButton.tsx` | Add `aria-label` from tooltip (a11y + testability) |
| `src/components/editor/extensions/<Name>/<Name>.ts` | One wrapped extension each (Italic, Strike, …) |
| `public/locales/{en,cs}/translation.json` | i18n keys for tooltips |
| `vitest.config.ts`, `src/test/setup.ts` | Vitest config + jest-dom setup |
| `playwright.config.ts`, `e2e/editor.spec.ts` | Playwright config + editor smoke |
| `src/components/editor/editor.tsx` | Register wrapped extensions; render `ExtensionToolbar` |

---

## Phase 0 — Unblock the build

### Task 0.1: Fix dependencies

**Files:**
- Modify: `package.json` (deps)

- [ ] **Step 1: Remove the unused dep and add the two missing TipTap extensions**

Run:
```bash
pnpm remove next-themes
pnpm add @tiptap/extension-link @tiptap/extension-placeholder
```

- [ ] **Step 2: Pin the new extensions to the repo's TipTap version**

The new packages resolve to a newer minor (3.27.0) than the rest of TipTap (3.4.4). Pin them to avoid version skew:
```bash
pnpm add @tiptap/extension-link@3.4.4 @tiptap/extension-placeholder@3.4.4
```

- [ ] **Step 3: Verify the build — and fix the fallout the original assumption missed**

Run: `pnpm build`

Reality (the plan's "8 errors all from link/placeholder" assumption was wrong):
- Removing `next-themes` **broke `src/components/ui/sonner.tsx`**, which imported `useTheme` from it. Fix: repoint to the custom provider — `import { useTheme } from '@/context/themeProvider.tsx';` (same `{ theme }` shape).
- `src/components/noteCreation/NoteCreateMain.tsx` was an **orphaned WIP file** (no importers) with 6 deeper errors using the pre–Pattern A approach (`BubbleMenu`/`FloatingMenu` from `@tiptap/react`, default `TextStyle` import, broken Attachment command typing). **Decision: deleted it** — the real note-creation UI is built in M2 on the canonical `Editor`.

After both fixes, `pnpm build` exits 0.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/ui/sonner.tsx
git rm src/components/noteCreation/NoteCreateMain.tsx  # already removed; stages the deletion
git commit -m "[FIX] Add TipTap link/placeholder; fix sonner theme import; drop orphaned NoteCreateMain"
```

---

## Phase 1 — Test foundation

### Task 1.1: Install test tooling

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Vitest, RTL, and Playwright**

Run:
```bash
pnpm add -D vitest @vitest/ui jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @playwright/test
pnpm exec playwright install chromium
```

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[ADD] Vitest + RTL + Playwright test dependencies"
```

### Task 1.2: Configure Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 3: Add scripts to `package.json`**

Add these entries to the `"scripts"` object:
```json
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test"
```

- [ ] **Step 4: Create a sanity test at `src/test/sanity.test.ts`**

```ts
import { describe, expect, it } from 'vitest';

describe('test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 5: Run it**

Run: `pnpm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/test/setup.ts src/test/sanity.test.ts package.json
git commit -m "[ADD] Vitest config, jest-dom setup, test scripts"
```

### Task 1.3: Configure Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/smoke.spec.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Create `e2e/smoke.spec.ts`**

```ts
import { expect, test } from '@playwright/test';

test('app boots and renders the editor', async ({ page }) => {
  await page.goto('/');
  // The editor's contenteditable surface is present.
  await expect(page.locator('.ProseMirror')).toBeVisible();
});
```

- [ ] **Step 3: Ignore Playwright artifacts**

Append to `.gitignore`:
```
/test-results/
/playwright-report/
/playwright/.cache/
```

- [ ] **Step 4: Run the e2e smoke**

Run: `pnpm test:e2e`
Expected: PASS (1 test). Playwright starts the dev server, loads the page, finds `.ProseMirror`.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/smoke.spec.ts .gitignore
git commit -m "[ADD] Playwright config and app-boot smoke test"
```

---

## Phase 2 — Toolbar infrastructure (Pattern A renderer)

### Task 2.1: Define the button-config contract types

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add the contract types**

Add to `src/types.ts` (keep existing exports):
```ts
import type { Editor as CoreEditor } from '@tiptap/core';
import type React from 'react';

/** A single toolbar button a TipTap extension contributes via its `button` option. */
export interface ToolbarButtonConfig {
  // biome-ignore lint/suspicious/noExplicitAny: button props vary per component (ActionButton, picker, …)
  component: React.ComponentType<any>;
  componentProps: Record<string, unknown>;
}

export type ButtonFactoryContext = {
  editor: CoreEditor;
  t: (key: string) => string;
};

/** Factory an extension returns from its `button` option. May yield one or many buttons. */
export type ButtonFactory = (
  ctx: ButtonFactoryContext
) => ToolbarButtonConfig | ToolbarButtonConfig[];

/** Mixin for extension Options that expose a toolbar button. */
export interface WithButtonOption {
  button: ButtonFactory;
}
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "[ADD] Toolbar button-config contract types (WithButtonOption)"
```

### Task 2.2: Type and expand the icon registry

**Files:**
- Modify: `src/components/icons/icons.ts`

- [ ] **Step 1: Replace the `as any` registry with a typed, expanded one**

```ts
import {
  Bold,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  type LucideIcon,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react';

export const icons: Record<string, LucideIcon> = {
  Bold,
  Italic,
  Strike: Strikethrough,
  Underline,
  Clear: RemoveFormatting,
  Heading1,
  Heading2,
  Heading3,
  BulletList: List,
  OrderedList: ListOrdered,
  TaskList: ListChecks,
  Highlight: Highlighter,
};
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/icons/icons.ts
git commit -m "[CHANGE] Type the icon registry and add toolbar icons"
```

### Task 2.3: Add `aria-label` to ActionButton

**Files:**
- Modify: `src/components/ui/ActionButton.tsx:62-77`

- [ ] **Step 1: Pass the tooltip as the accessible name**

In the `<Comp ...>` element, add `aria-label={tooltip}` alongside the existing props:
```tsx
          <Comp
            ref={ref}
            onClick={action}
            disabled={disabled || loading}
            data-state={isActive?.() ? 'on' : 'off'}
            aria-label={tooltip}
            aria-pressed={isActive?.() ?? undefined}
            size="sm"
            className={cn('flex h-8 w-8 items-center justify-center p-0', className)}
            {...rest}
          >
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ActionButton.tsx
git commit -m "[CHANGE] Give ActionButton an accessible name from its tooltip"
```

### Task 2.4: Build `collectToolbarButtons` (test-first)

**Files:**
- Create: `src/components/editor/menus/toolbar.ts`
- Test: `src/components/editor/menus/toolbar.test.ts`

- [ ] **Step 1: Write the failing test**

`src/components/editor/menus/toolbar.test.ts`:
```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { Bold } from '@/components/editor/extensions/Bold';
import { collectToolbarButtons } from '@/components/editor/menus/toolbar';

describe('collectToolbarButtons', () => {
  it('collects one button config per extension exposing a button option', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, Bold] });
    const buttons = collectToolbarButtons(editor, (k) => k);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].componentProps.icon).toBe('Bold');
    editor.destroy();
  });

  it('flattens array-returning button factories (e.g. undo/redo)', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, Bold] });
    const flat = collectToolbarButtons(editor, (k) => k);
    expect(Array.isArray(flat)).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test src/components/editor/menus/toolbar.test.ts`
Expected: FAIL — `collectToolbarButtons` is not defined.

- [ ] **Step 3: Implement `src/components/editor/menus/toolbar.ts`**

```ts
import type { Editor } from '@tiptap/core';
import type { ButtonFactory, ToolbarButtonConfig } from '@/types.ts';

type ExtensionWithButton = { options: { button: ButtonFactory } };

function hasButton(ext: { options?: unknown }): ext is ExtensionWithButton {
  return typeof (ext.options as { button?: unknown })?.button === 'function';
}

/** Gather the toolbar button configs every registered extension contributes. */
export function collectToolbarButtons(
  editor: Editor,
  t: (key: string) => string
): ToolbarButtonConfig[] {
  return editor.extensionManager.extensions.filter(hasButton).flatMap((ext) => {
    const result = ext.options.button({ editor, t });
    return Array.isArray(result) ? result : [result];
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test src/components/editor/menus/toolbar.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/menus/toolbar.ts src/components/editor/menus/toolbar.test.ts
git commit -m "[ADD] collectToolbarButtons: gather Pattern A buttons from extensions"
```

### Task 2.5: Build the `ExtensionToolbar` component

**Files:**
- Create: `src/components/editor/menus/ExtensionToolbar.tsx`

- [ ] **Step 1: Implement the component**

```tsx
import type { Editor } from '@tiptap/react';
import { useTranslation } from 'react-i18next';
import { collectToolbarButtons } from '@/components/editor/menus/toolbar.ts';

interface ExtensionToolbarProps {
  editor: Editor;
}

export function ExtensionToolbar({ editor }: ExtensionToolbarProps) {
  const { t } = useTranslation();
  const buttons = collectToolbarButtons(editor, t);

  return (
    <div
      className="flex flex-wrap items-center gap-1"
      role="toolbar"
      aria-label={t('editor.toolbar')}
    >
      {buttons.map((btn, index) => {
        const Component = btn.component;
        const key = `${(btn.componentProps.icon as string) ?? 'btn'}-${index}`;
        return <Component key={key} {...btn.componentProps} />;
      })}
    </div>
  );
}

export default ExtensionToolbar;
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/menus/ExtensionToolbar.tsx
git commit -m "[ADD] ExtensionToolbar component rendering Pattern A buttons"
```

### Task 2.6: Add i18n tooltip keys

**Files:**
- Modify: `public/locales/en/translation.json`
- Modify: `public/locales/cs/translation.json`

- [ ] **Step 1: Write `public/locales/en/translation.json`**

(The file is currently empty — replace its whole content.)
```json
{
  "editor": {
    "toolbar": "Formatting toolbar",
    "bold": { "tooltip": "Bold" },
    "italic": { "tooltip": "Italic" },
    "strike": { "tooltip": "Strikethrough" },
    "underline": { "tooltip": "Underline" },
    "clear": { "tooltip": "Clear formatting" },
    "heading": { "h1": "Heading 1", "h2": "Heading 2", "h3": "Heading 3" },
    "bulletList": { "tooltip": "Bullet list" },
    "orderedList": { "tooltip": "Ordered list" },
    "taskList": { "tooltip": "Checklist" },
    "color": { "tooltip": "Text color" },
    "highlight": { "tooltip": "Highlight" },
    "undo": "Undo",
    "redo": "Redo"
  }
}
```

- [ ] **Step 2: Write `public/locales/cs/translation.json`**

```json
{
  "editor": {
    "toolbar": "Panel formátování",
    "bold": { "tooltip": "Tučné" },
    "italic": { "tooltip": "Kurzíva" },
    "strike": { "tooltip": "Přeškrtnuté" },
    "underline": { "tooltip": "Podtržené" },
    "clear": { "tooltip": "Vymazat formátování" },
    "heading": { "h1": "Nadpis 1", "h2": "Nadpis 2", "h3": "Nadpis 3" },
    "bulletList": { "tooltip": "Odrážkový seznam" },
    "orderedList": { "tooltip": "Číslovaný seznam" },
    "taskList": { "tooltip": "Seznam úkolů" },
    "color": { "tooltip": "Barva textu" },
    "highlight": { "tooltip": "Zvýraznění" },
    "undo": "Zpět",
    "redo": "Znovu"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add public/locales/en/translation.json public/locales/cs/translation.json
git commit -m "[ADD] Editor toolbar i18n keys (en, cs)"
```

---

## Phase 3 — Marks

> Pattern for every extension task below: write the contract test → run it red → write the wrapped extension → run it green → commit. Each test instantiates a headless TipTap `Editor` with just the document scaffold + the extension under test, sets content, selects all, fires the button's `action`, and asserts the rendered HTML and `isActive`.

### Task 3.1: Bold — add the missing contract test, refactor to shared type

**Files:**
- Modify: `src/components/editor/extensions/Bold/Bold.ts`
- Test: `src/components/editor/extensions/Bold/Bold.test.ts`

- [ ] **Step 1: Write the failing test `Bold/Bold.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { Bold } from './Bold';
import type { ToolbarButtonConfig } from '@/types.ts';

function makeEditor() {
  return new Editor({ extensions: [Document, Paragraph, Text, Bold] });
}

describe('Bold extension', () => {
  it('exposes a toolbar button that toggles bold on the selection', () => {
    const editor = makeEditor();
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'bold');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<strong>');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    expect(cfg.componentProps.icon).toBe('Bold');
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test src/components/editor/extensions/Bold/Bold.test.ts`
Expected: PASS (Bold already implements the button). If it fails because `ext.options.button` typing differs, proceed to Step 3 which standardizes the type.

- [ ] **Step 3: Refactor `Bold/Bold.ts` to the shared `WithButtonOption` type (DRY)**

```ts
import { type BoldOptions, Bold as TiptapBold } from '@tiptap/extension-bold';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const Bold = TiptapBold.extend<BoldOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleBold().run(),
          isActive: () => editor.isActive('bold'),
          disabled: false,
          shortcutKeys: ['Mod', 'B'],
          icon: 'Bold',
          tooltip: t('editor.bold.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run the test green + type-check**

Run: `pnpm test src/components/editor/extensions/Bold/Bold.test.ts && pnpm exec tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Bold/Bold.ts src/components/editor/extensions/Bold/Bold.test.ts
git commit -m "[CHANGE] Bold: standardize on WithButtonOption + add contract test"
```

### Task 3.2: Italic

**Files:**
- Modify: `src/components/editor/extensions/Italic/Italic.ts` (currently empty)
- Test: `src/components/editor/extensions/Italic/Italic.test.ts`

- [ ] **Step 1: Write the failing test `Italic/Italic.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { Italic } from './Italic';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('Italic extension', () => {
  it('exposes a toolbar button that toggles italic', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, Italic] });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'italic');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<em>');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/Italic/Italic.test.ts`
Expected: FAIL — `Italic` is not exported (file empty).

- [ ] **Step 3: Implement `Italic/Italic.ts`**

```ts
import { type ItalicOptions, Italic as TiptapItalic } from '@tiptap/extension-italic';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const Italic = TiptapItalic.extend<ItalicOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleItalic().run(),
          isActive: () => editor.isActive('italic'),
          disabled: false,
          shortcutKeys: ['Mod', 'I'],
          icon: 'Italic',
          tooltip: t('editor.italic.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/Italic/Italic.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Italic/
git commit -m "[ADD] Italic extension (Pattern A) + contract test"
```

### Task 3.3: Strike

**Files:**
- Modify: `src/components/editor/extensions/Strike/Strike.ts` (currently empty)
- Test: `src/components/editor/extensions/Strike/Strike.test.ts`

- [ ] **Step 1: Write the failing test `Strike/Strike.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { Strike } from './Strike';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('Strike extension', () => {
  it('exposes a toolbar button that toggles strikethrough', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, Strike] });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'strike');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<s>');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/Strike/Strike.test.ts`
Expected: FAIL — `Strike` not exported.

- [ ] **Step 3: Implement `Strike/Strike.ts`**

```ts
import { type StrikeOptions, Strike as TiptapStrike } from '@tiptap/extension-strike';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const Strike = TiptapStrike.extend<StrikeOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleStrike().run(),
          isActive: () => editor.isActive('strike'),
          disabled: false,
          shortcutKeys: ['Mod', 'Shift', 'S'],
          icon: 'Strike',
          tooltip: t('editor.strike.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/Strike/Strike.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Strike/
git commit -m "[ADD] Strike extension (Pattern A) + contract test"
```

### Task 3.4: Underline

**Files:**
- Modify: `src/components/editor/extensions/TextUnderline/TextUnderline.ts` (currently empty)
- Test: `src/components/editor/extensions/TextUnderline/TextUnderline.test.ts`

- [ ] **Step 1: Write the failing test `TextUnderline/TextUnderline.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { TextUnderline } from './TextUnderline';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('TextUnderline extension', () => {
  it('exposes a toolbar button that toggles underline', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, TextUnderline] });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'underline');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<u>');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/TextUnderline/TextUnderline.test.ts`
Expected: FAIL — `TextUnderline` not exported.

- [ ] **Step 3: Implement `TextUnderline/TextUnderline.ts`**

```ts
import { type UnderlineOptions, Underline as TiptapUnderline } from '@tiptap/extension-underline';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const TextUnderline = TiptapUnderline.extend<UnderlineOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleUnderline().run(),
          isActive: () => editor.isActive('underline'),
          disabled: false,
          shortcutKeys: ['Mod', 'U'],
          icon: 'Underline',
          tooltip: t('editor.underline.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/TextUnderline/TextUnderline.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/TextUnderline/
git commit -m "[ADD] Underline extension (Pattern A) + contract test"
```

### Task 3.5: Clear formatting

> Clear is not a TipTap extension of its own — it's a command on the editor. Implement it as a standalone TipTap `Extension` whose only job is to contribute a toolbar button (no schema). This keeps the button discoverable by `collectToolbarButtons`.

**Files:**
- Modify: `src/components/editor/extensions/Clear/Clear.ts` (currently empty)
- Test: `src/components/editor/extensions/Clear/Clear.test.ts`

- [ ] **Step 1: Write the failing test `Clear/Clear.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { Clear } from './Clear';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('Clear extension', () => {
  it('exposes a toolbar button that clears marks from the selection', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, Bold, Clear] });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'clearFormatting');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p><strong>hello</strong></p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).not.toContain('<strong>');
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/Clear/Clear.test.ts`
Expected: FAIL — `Clear` not exported.

- [ ] **Step 3: Implement `Clear/Clear.ts`**

```ts
import { Extension } from '@tiptap/core';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const Clear = Extension.create<WithButtonOption>({
  name: 'clearFormatting',
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
          isActive: () => false,
          disabled: false,
          shortcutKeys: ['Mod', '\\'],
          icon: 'Clear',
          tooltip: t('editor.clear.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/Clear/Clear.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Clear/
git commit -m "[ADD] Clear-formatting extension (Pattern A) + contract test"
```

### Task 3.6: Live-test the marks

- [ ] **Step 1: Wire the marks into the editor temporarily and run the app**

This is validated end-to-end in Phase 6 (Task 6.1) when `editor.tsx` switches to the wrapped extensions + `ExtensionToolbar`. For now, run the full unit suite:

Run: `pnpm test`
Expected: all mark tests + infra tests PASS.

---

## Phase 4 — Blocks & lists

### Task 4.1: Install the Heading extension package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install `@tiptap/extension-heading`** (StarterKit bundles Heading but does not export it standalone)

Run: `pnpm add @tiptap/extension-heading`

- [ ] **Step 2: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "[ADD] @tiptap/extension-heading dependency"
```

### Task 4.2: Heading (H1/H2/H3 — array-returning button)

**Files:**
- Modify: `src/components/editor/extensions/Heading/Heading.ts` (currently empty)
- Test: `src/components/editor/extensions/Heading/Heading.test.ts`

- [ ] **Step 1: Write the failing test `Heading/Heading.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { Heading } from './Heading';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('Heading extension', () => {
  it('exposes three buttons (H1/H2/H3) and toggling H2 produces an <h2>', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, Heading] });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'heading');
    const cfgs = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig[];
    expect(cfgs).toHaveLength(3);
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfgs[1].componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<h2>');
    expect((cfgs[1].componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/Heading/Heading.test.ts`
Expected: FAIL — `Heading` not exported.

- [ ] **Step 3: Implement `Heading/Heading.ts`**

```ts
import { type HeadingOptions, Heading as TiptapHeading } from '@tiptap/extension-heading';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

const LEVELS = [1, 2, 3] as const;

export const Heading = TiptapHeading.extend<HeadingOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      levels: [1, 2, 3],
      button: ({ editor, t }) =>
        LEVELS.map((level) => ({
          component: ActionButton,
          componentProps: {
            action: () => editor.chain().focus().toggleHeading({ level }).run(),
            isActive: () => editor.isActive('heading', { level }),
            disabled: false,
            shortcutKeys: ['Mod', 'Alt', String(level)],
            icon: `Heading${level}`,
            tooltip: t(`editor.heading.h${level}`),
          },
        })),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/Heading/Heading.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/Heading/
git commit -m "[ADD] Heading extension (H1/H2/H3, Pattern A) + contract test"
```

### Task 4.3: BulletList

**Files:**
- Modify: `src/components/editor/extensions/BulletList/BulletList.ts` (currently empty)
- Test: `src/components/editor/extensions/BulletList/BulletList.test.ts`

- [ ] **Step 1: Write the failing test `BulletList/BulletList.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { BulletList } from './BulletList';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('BulletList extension', () => {
  it('exposes a toolbar button that toggles a bullet list', () => {
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, ListItem, BulletList],
    });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'bulletList');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<ul>');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/BulletList/BulletList.test.ts`
Expected: FAIL — `BulletList` not exported.

- [ ] **Step 3: Implement `BulletList/BulletList.ts`**

```ts
import { type BulletListOptions, BulletList as TiptapBulletList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const BulletList = TiptapBulletList.extend<BulletListOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleBulletList().run(),
          isActive: () => editor.isActive('bulletList'),
          disabled: false,
          shortcutKeys: ['Mod', 'Shift', '8'],
          icon: 'BulletList',
          tooltip: t('editor.bulletList.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/BulletList/BulletList.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/BulletList/
git commit -m "[ADD] BulletList extension (Pattern A) + contract test"
```

### Task 4.4: OrderedList

**Files:**
- Modify: `src/components/editor/extensions/OrderedList/OrderedList.ts` (currently empty)
- Test: `src/components/editor/extensions/OrderedList/OrderedList.test.ts`

- [ ] **Step 1: Write the failing test `OrderedList/OrderedList.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { ListItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { OrderedList } from './OrderedList';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('OrderedList extension', () => {
  it('exposes a toolbar button that toggles an ordered list', () => {
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, ListItem, OrderedList],
    });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'orderedList');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<ol>');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/OrderedList/OrderedList.test.ts`
Expected: FAIL — `OrderedList` not exported.

- [ ] **Step 3: Implement `OrderedList/OrderedList.ts`**

```ts
import { type OrderedListOptions, OrderedList as TiptapOrderedList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const OrderedList = TiptapOrderedList.extend<OrderedListOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleOrderedList().run(),
          isActive: () => editor.isActive('orderedList'),
          disabled: false,
          shortcutKeys: ['Mod', 'Shift', '7'],
          icon: 'OrderedList',
          tooltip: t('editor.orderedList.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/OrderedList/OrderedList.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/OrderedList/
git commit -m "[ADD] OrderedList extension (Pattern A) + contract test"
```

### Task 4.5: ListItem (structural — no button, just re-export)

> `ListItem` is a child node with no toolbar button. It only needs a clean re-export so `editor.tsx` imports it consistently from the extension folder.

**Files:**
- Modify: `src/components/editor/extensions/ListItem/ListItem.ts` (currently empty)

- [ ] **Step 1: Implement `ListItem/ListItem.ts`**

```ts
export { ListItem } from '@tiptap/extension-list';
```

- [ ] **Step 2: Type-check**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/extensions/ListItem/
git commit -m "[ADD] ListItem re-export from extension folder"
```

### Task 4.6: TaskList (with TaskItem)

**Files:**
- Modify: `src/components/editor/extensions/TaskList/TaskList.ts` (currently empty)
- Test: `src/components/editor/extensions/TaskList/TaskList.test.ts`

- [ ] **Step 1: Write the failing test `TaskList/TaskList.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { TaskList } from './TaskList';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('TaskList extension', () => {
  it('exposes a toolbar button that toggles a checklist', () => {
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, TaskItem, TaskList],
    });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'taskList');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('data-type="taskList"');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 2: Run it (red)**

Run: `pnpm test src/components/editor/extensions/TaskList/TaskList.test.ts`
Expected: FAIL — `TaskList` not exported.

- [ ] **Step 3: Implement `TaskList/TaskList.ts`**

```ts
import { type TaskListOptions, TaskList as TiptapTaskList } from '@tiptap/extension-list';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const TaskList = TiptapTaskList.extend<TaskListOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleTaskList().run(),
          isActive: () => editor.isActive('taskList'),
          disabled: false,
          shortcutKeys: ['Mod', 'Shift', '9'],
          icon: 'TaskList',
          tooltip: t('editor.taskList.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 4: Run it (green)**

Run: `pnpm test src/components/editor/extensions/TaskList/TaskList.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/editor/extensions/TaskList/
git commit -m "[ADD] TaskList extension (Pattern A) + contract test"
```

---

## Phase 5 — Styling

### Task 5.1: Consolidate the color extension folders

> Current mess: `Color/Color.ts` + `Color/index.ts` are empty stubs; `text-color/text-color.ts` is empty yet `text-color/index.ts` re-exports it; `text-color/TextColor.ts` is a redundant custom `textColor` mark (the app actually uses `Color` from `@tiptap/extension-text-style`); `text-color/TextColorPickerButton.tsx` is the real custom picker. Consolidate to a single `text-color/` folder that wraps text-style's `Color` with a `button` returning the existing picker.

**Files:**
- Delete: `src/components/editor/extensions/Color/` (whole folder)
- Delete: `src/components/editor/extensions/text-color/text-color.ts`
- Delete: `src/components/editor/extensions/text-color/TextColor.ts`
- Create: `src/components/editor/extensions/text-color/Color.ts`
- Modify: `src/components/editor/extensions/text-color/index.ts`
- Modify: `src/components/editor/extensions/text-color/TextColorPickerButton.tsx` (default tooltip via i18n — optional, see step)
- Test: `src/components/editor/extensions/text-color/Color.test.ts`

- [ ] **Step 1: Delete the dead files/folder**

Run:
```bash
git rm -r src/components/editor/extensions/Color
git rm src/components/editor/extensions/text-color/text-color.ts src/components/editor/extensions/text-color/TextColor.ts
```

- [ ] **Step 2: Write the failing test `text-color/Color.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { describe, expect, it } from 'vitest';
import { Color } from './Color';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('Color extension', () => {
  it('exposes a picker button and applies a text color', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, TextStyle, Color] });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'color');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    expect(cfg.componentProps.editor).toBe(editor);
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    editor.chain().focus().setColor('#ef4444').run();
    expect(editor.getHTML()).toContain('color: #ef4444');
    editor.destroy();
  });
});
```

- [ ] **Step 3: Run it (red)**

Run: `pnpm test src/components/editor/extensions/text-color/Color.test.ts`
Expected: FAIL — `./Color` does not exist.

- [ ] **Step 4: Create `text-color/Color.ts`**

```ts
import { type ColorOptions, Color as TiptapColor } from '@tiptap/extension-text-style';
import { TextColorPickerButton } from '@/components/editor/extensions/text-color/TextColorPickerButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const Color = TiptapColor.extend<ColorOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor }) => ({
        component: TextColorPickerButton,
        componentProps: { editor },
      }),
    };
  },
});
```

- [ ] **Step 5: Replace `text-color/index.ts`**

```ts
export * from './Color';
export { TextColorPickerButton } from './TextColorPickerButton';
```

- [ ] **Step 6: Run it (green) + type-check**

Run: `pnpm test src/components/editor/extensions/text-color/Color.test.ts && pnpm exec tsc -b --noEmit`
Expected: PASS. (If `tsc` flags the now-unused `TextColor.ts` import anywhere, grep for `TextColor` references and remove them — there should be none outside the deleted files.)

- [ ] **Step 7: Commit**

```bash
git add src/components/editor/extensions/text-color/ src/components/editor/extensions/Color
git commit -m "[CHANGE] Consolidate color extension: wrap text-style Color with picker button"
```

### Task 5.2: Install + implement Highlight

**Files:**
- Modify: `package.json`
- Modify: `src/components/editor/extensions/Highlight/Highlight.ts` (currently empty)
- Test: `src/components/editor/extensions/Highlight/Highlight.test.ts`

- [ ] **Step 1: Install the package**

Run: `pnpm add @tiptap/extension-highlight`

- [ ] **Step 2: Write the failing test `Highlight/Highlight.test.ts`**

```ts
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { Highlight } from './Highlight';
import type { ToolbarButtonConfig } from '@/types.ts';

describe('Highlight extension', () => {
  it('exposes a toolbar button that toggles highlight', () => {
    const editor = new Editor({ extensions: [Document, Paragraph, Text, Highlight] });
    const ext = editor.extensionManager.extensions.find((e) => e.name === 'highlight');
    const cfg = ext?.options.button({ editor, t: (k: string) => k }) as ToolbarButtonConfig;
    editor.commands.setContent('<p>hello</p>');
    editor.commands.selectAll();
    (cfg.componentProps.action as () => void)();
    expect(editor.getHTML()).toContain('<mark>');
    expect((cfg.componentProps.isActive as () => boolean)()).toBe(true);
    editor.destroy();
  });
});
```

- [ ] **Step 3: Run it (red)**

Run: `pnpm test src/components/editor/extensions/Highlight/Highlight.test.ts`
Expected: FAIL — `Highlight` not exported.

- [ ] **Step 4: Implement `Highlight/Highlight.ts`**

```ts
import { type HighlightOptions, Highlight as TiptapHighlight } from '@tiptap/extension-highlight';
import { ActionButton } from '@/components/ui/ActionButton.tsx';
import type { WithButtonOption } from '@/types.ts';

export const Highlight = TiptapHighlight.extend<HighlightOptions & WithButtonOption>({
  addOptions() {
    return {
      ...this.parent?.(),
      button: ({ editor, t }) => ({
        component: ActionButton,
        componentProps: {
          action: () => editor.chain().focus().toggleHighlight().run(),
          isActive: () => editor.isActive('highlight'),
          disabled: false,
          shortcutKeys: ['Mod', 'Shift', 'H'],
          icon: 'Highlight',
          tooltip: t('editor.highlight.tooltip'),
        },
      }),
    };
  },
});
```

- [ ] **Step 5: Run it (green)**

Run: `pnpm test src/components/editor/extensions/Highlight/Highlight.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml src/components/editor/extensions/Highlight/
git commit -m "[ADD] Highlight extension (Pattern A) + contract test"
```

---

## Phase 6 — Wire the editor, retire Pattern B, full e2e

### Task 6.1: Register wrapped extensions and render ExtensionToolbar

**Files:**
- Modify: `src/components/editor/editor.tsx`

- [ ] **Step 1: Replace the editor's extension list and toolbar**

Replace the entire contents of `src/components/editor/editor.tsx` with:
```tsx
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { TaskItem } from '@tiptap/extension-list';
import { EditorContent, useEditor } from '@tiptap/react';
import type React from 'react';
import { useEffect } from 'react';
import { Bold } from '@/components/editor/extensions/Bold';
import { BulletList } from '@/components/editor/extensions/BulletList';
import { Clear } from '@/components/editor/extensions/Clear';
import { Heading } from '@/components/editor/extensions/Heading';
import { Highlight } from '@/components/editor/extensions/Highlight';
import { Italic } from '@/components/editor/extensions/Italic';
import { ListItem } from '@/components/editor/extensions/ListItem/ListItem.ts';
import { OrderedList } from '@/components/editor/extensions/OrderedList';
import { Strike } from '@/components/editor/extensions/Strike';
import { TaskList } from '@/components/editor/extensions/TaskList';
import { Color } from '@/components/editor/extensions/text-color';
import { TextUnderline } from '@/components/editor/extensions/TextUnderline';
import { History } from '@/components/editor/extensions/history';
import { ExtensionToolbar } from '@/components/editor/menus/ExtensionToolbar.tsx';

type EditorProps = {
  content?: string;
  editable?: boolean;
  onUpdate?: (content: string) => void;
};

export const Editor: React.FC<EditorProps> = ({ content, editable, onUpdate }) => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      History,
      Bold,
      Italic,
      Strike,
      TextUnderline,
      Clear,
      Heading,
      ListItem,
      BulletList,
      OrderedList,
      TaskItem,
      TaskList,
      TextStyle,
      Color,
      Highlight,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
    shouldRerenderOnTransaction: true,
    immediatelyRender: true,
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content ?? '');
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative rounded-xl border p-4">
      {editable && <ExtensionToolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="prose prose-sm min-h-[150px] max-w-none focus:outline-none"
      />
    </div>
  );
};
```

> Note: `History` is already a Pattern A extension (`extensions/history`). Its button factory uses `t('editor.undo')` / `t('editor.redo')` — both keys were added in Task 2.6.

- [ ] **Step 2: Type-check + run the app**

Run: `pnpm exec tsc -b --noEmit`
Expected: PASS.

Run: `pnpm dev` and open the app. **Live-test:** the toolbar shows undo/redo, bold, italic, strike, underline, clear, H1–H3, bullet/ordered/task lists, the color picker, and highlight. Select text and click each — formatting applies and active state toggles. Tooltips show the translated labels.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/editor.tsx
git commit -m "[CHANGE] editor.tsx: register wrapped extensions, render ExtensionToolbar"
```

### Task 6.2: Remove the legacy Pattern B toolbars

> `FormatSection.tsx` / `ListSection.tsx` (and their `formatActions` arrays with inline Lucide JSX) are no longer rendered. Remove them and the now-unused `TextColorPickerButton` direct import from `editor.tsx` (it is now reached via the `Color` extension's button).

**Files:**
- Delete: `src/components/editor/menus/toolbars/FormatSection.tsx`
- Delete: `src/components/editor/menus/toolbars/ListSection.tsx`

- [ ] **Step 1: Confirm nothing else imports them**

Run: `grep -rn "FormatSection\|ListSection" src/`
Expected: no matches outside the two files themselves.

- [ ] **Step 2: Delete the files**

Run: `git rm src/components/editor/menus/toolbars/FormatSection.tsx src/components/editor/menus/toolbars/ListSection.tsx`

- [ ] **Step 3: Type-check + full unit suite + lint**

Run: `pnpm exec tsc -b --noEmit && pnpm test && pnpm check:ci`
Expected: all PASS (lint may emit warnings; 0 errors).

- [ ] **Step 4: Commit**

```bash
git add -A src/components/editor/menus/toolbars
git commit -m "[REMOVE] Legacy Pattern B FormatSection/ListSection toolbars"
```

### Task 6.3: End-to-end editor toolbar test

**Files:**
- Create: `e2e/editor.spec.ts`

- [ ] **Step 1: Write the e2e test**

```ts
import { expect, test } from '@playwright/test';

test('bold toolbar button formats selected text', async ({ page }) => {
  await page.goto('/');
  const editor = page.locator('.ProseMirror');
  await expect(editor).toBeVisible();

  // Replace content with a known word, select it.
  await editor.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('hello');
  await page.keyboard.press('ControlOrMeta+a');

  // Click the Bold button (accessible name comes from its tooltip).
  await page.getByRole('button', { name: 'Bold' }).click();

  await expect(editor.locator('strong')).toHaveText('hello');
});
```

- [ ] **Step 2: Run it**

Run: `pnpm test:e2e`
Expected: PASS (both `smoke.spec.ts` and `editor.spec.ts`).

- [ ] **Step 3: Commit**

```bash
git add e2e/editor.spec.ts
git commit -m "[ADD] E2E test: Bold toolbar button formats selected text"
```

### Task 6.4: Enable the test jobs in CI

**Files:**
- Modify: `.gitlab-ci.yml`

- [ ] **Step 1: Flip `test:unit` and `test:e2e` from `allow_failure: true` to enforced**

In `.gitlab-ci.yml`, locate the `test:unit` and `test:e2e` jobs (added in M0 with `allow_failure: true` because no suites existed). Remove the `allow_failure: true` line from each so the suites now gate the pipeline. Ensure `test:unit` runs `pnpm test` and `test:e2e` runs `pnpm exec playwright install --with-deps chromium && pnpm test:e2e`.

- [ ] **Step 2: Commit**

```bash
git add .gitlab-ci.yml
git commit -m "[CHANGE] CI: enforce Vitest + Playwright suites (drop allow_failure)"
```

### Task 6.5: Update docs to reflect completed M1 editor work

**Files:**
- Modify: `src/components/editor/CLAUDE.md`
- Modify: `src/components/editor/PLAN.md`

- [ ] **Step 1: Update `src/components/editor/CLAUDE.md`**

In the "Current state (mismatch to fix in M1)" section, replace it with a note that `editor.tsx` now registers the wrapped `extensions/*` versions and renders `ExtensionToolbar` (which consumes each extension's `button` option via `collectToolbarButtons`); Pattern B `FormatSection`/`ListSection` have been removed. Note that `Image`/`Video`/`Attachment`/`Excalidraw` and `FontFamily`/`FontSize` buttons remain stubs for the M3 media plan.

- [ ] **Step 2: Update `src/components/editor/PLAN.md`**

Check off completed items (test tooling, Pattern A standardization, marks/lists/styling extensions, toolbar migration, color/folder consolidation). Leave media + Excalidraw + FontFamily/FontSize as the remaining M3 work.

- [ ] **Step 3: Commit**

```bash
git add src/components/editor/CLAUDE.md src/components/editor/PLAN.md
git commit -m "[DOC] Mark M1 editor extension work complete; note M3 remainder"
```

---

## Verification (end-to-end)

1. `pnpm build` — clean typecheck + production build (Phase 0 fixed the 8 errors).
2. `pnpm test` — all unit/contract tests pass: `collectToolbarButtons`, and one contract test per extension (Bold, Italic, Strike, Underline, Clear, Heading, BulletList, OrderedList, TaskList, Color, Highlight).
3. `pnpm test:e2e` — app boots; the Bold toolbar button formats selected text in the live editor.
4. `pnpm check:ci` — Biome passes (0 errors).
5. `pnpm dev` manual pass — every toolbar button toggles its format with correct active state and translated tooltip; undo/redo work; the color picker applies colors; highlight works.
6. CI pipeline (`.gitlab-ci.yml`) runs `quality → test → build → publish` with the test suites now enforced.

---

## Self-review notes

- **Spec coverage:** This plan covers the spec's Phase 0 (deps) and M1 (test foundation + editor extensions). The spec's M2/M3/M4 UX items (optimistic UI, FAB, masonry, soft-delete, media, export/import, etc.) are intentionally **out of scope** here and get their own plans.
- **Type consistency:** `WithButtonOption`, `ButtonFactory`, `ToolbarButtonConfig` are defined in Task 2.1 and used unchanged in every extension and in `collectToolbarButtons`. `collectToolbarButtons(editor, t)` signature is stable across Tasks 2.4, 2.5, and 6.1.
- **Icon keys** used in extensions (`Bold`, `Italic`, `Strike`, `Underline`, `Clear`, `Heading1/2/3`, `BulletList`, `OrderedList`, `TaskList`, `Highlight`) all exist in the registry from Task 2.2. Color uses its own `Baseline` icon inside `TextColorPickerButton`, not the registry.
- **Deferred (explicit):** `FontFamily`, `FontSize` toolbar buttons (need select UI) and all media/Excalidraw extensions — these belong to the M3 media plan.
