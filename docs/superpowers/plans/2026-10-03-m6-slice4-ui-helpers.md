# M6 slice 4: UI helpers - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The UI's repeated small mechanisms each live once: an effect that awaits, an action that toasts, a dialog that hands on a link, the backup export, a Settings row bound to a Preference, the Intent an open carries, the byte and date formatters, and the keyboard-glyph table.

**Architecture:** Every helper is a function or a hook in the codebase's existing style (ADR 0022), none owns more than the part its copies shared. `useAsyncEffect(effect, deps)` owns the cancel flag the nine effects kept by hand and nothing else, so the sites keep writing their own state; Biome learns its deps array so the callers stay checked. `useAction()` owns the busy flag and the success and failure toasts of a user-started call, with `act` able to answer `false` to back out quietly and `failure` able to pick a key from the error; `LinkDialog` is the one dialog that shows a link with Copy and Done. `exportBackup(store, suffix)` is the one picker-then-zip-then-write flow, answering an outcome so each of its three callers can say what it wants. `PreferenceSwitch` and `PreferenceSegmented` bind a Settings row to a Preference key, with the option lists exported from the schema that validates them. `Intent` (`src/lib/intent.ts`) is one discriminated union carried from the Starts table and the Card through `useOpenNote`, `NotesView`, `NoteEditorDialog` and `Editor`, spent when the open ends, which fixes a Start replaying on Forward; the picker hook owns the picker-versus-direct branch. `src/lib/format.ts` holds the locale-aware formatters, with the app language passed in from `i18n.language`, which fixes Settings dates ignoring the chosen language; `src/utils/platform.ts` becomes `src/lib/shortcut-keys.ts` and `src/utils/` goes.

**Tech Stack:**
- React 19, TypeScript 6; TanStack Router (`router.subscribe('onResolved', …)`); Radix Switch and ToggleGroup through the vendored shadcn wrappers; sonner; i18next (`useTranslation().i18n.language`); `Intl.NumberFormat`, `Intl.DateTimeFormat`;
- Vitest with Testing Library (`renderHook`, `renderRoute`), Playwright; Biome and ESLint (`pnpm lint`, run by the pre-commit hook);
- pnpm, Node 24.

**Spec:** `PLAN.md`, milestone M6, slice 4; style: `docs/adr/0022-interfaces-and-closures-not-classes.md`; glossary: `CONTEXT.md` (**Intent**, **Start**, **Preference**); evidence: `docs/superpowers/plans/2026-10-02-refactor-survey.md` (sections C and D) and the four evidence files in this slice's `.superpowers/sdd/2026-10-03-m6-slice4-ui-helpers/` workspace (gitignored; a reviewer may ask for them).

## Global Constraints

- pnpm only, never npm or yarn; Node 24.
- Plain dash, never an em dash; in long Markdown one sentence per line.
- Comments are short, plain and high level: why, a decision (link the ADR) or a trap; never narrate the next line, never explain styling (`CLAUDE.md` hard rule). Agents get context from the `.md` files, so no comment briefs an agent.
- ADR 0022: helper functions, hooks and tables, never classes; a helper earns its place with three call sites or a second implementation.
- ADR 0014 stands: which Note is open is the URL's; the Intent stays in React state and is spent with the gesture, so a reload, Back or Forward never repeats it.
- Lint rules that shape every hook here (ESLint `eslint-plugin-react-hooks` 7, React Compiler rules): no `setState` synchronously in an effect body (`react-hooks/set-state-in-effect`, an error; state is set in a promise continuation, a subscription callback or a handler), no ref read or write during render (`react-hooks/refs`), `@typescript-eslint/no-floating-promises` (write `void promise` in handlers).
- Biome's `useExhaustiveDependencies` is the dependency gate; a `biome-ignore` for it is allowed only inside a hook that passes the caller's deps on, directly above a single-line call (a comment in between makes the suppression miss).
- i18n keys that tests read through identity `t` mocks are never renamed; new strings land in `public/locales/en/translation.json` and `public/locales/cs/translation.json` together (`src/i18n.test.ts` gates both bundles).
- Files stay under 500 lines.
- Test first: write the failing test, run it to see it fail, then the code, then run it to see it pass. Biome forbids `export` in test files.
- Near-identical tests collapse into one table-driven test rather than a copy per unit; behaviour specific to one unit keeps its own case.
- `src/contract/index.ts` is vendored and never edited; `src/routeTree.gen.ts` is generated and never edited.
- Gates for every task: `pnpm check:ci`, `pnpm lint` (no new warnings; four pre-existing ones remain after Task 1 clears `useLive`'s two), `pnpm exec tsc -b --noEmit`, the named vitest runs; the last task adds `pnpm build`, `pnpm test`, `pnpm test:e2e`.
- Never commit, push or switch branches without asking.
  souki makes every commit; a "Commit" step means stop and ask souki to commit, with the suggested message, from a clean index.

## Review Focus

1. Forward after closing a Start must reopen the saved Note plain: today `NotesView` never clears the gesture, so Forward onto the same `?note=` re-fires the capture and opens the Note as a blank draft over its saved row (pinned in Task 5: the Playwright case in `e2e/capture.spec.ts` and the Forward case in `NotesView.openNote.test.tsx`).
2. A Settings load (Devices, Members, Shares) that answers after the section unmounted or the account changed must not write into the newer render (pinned in Task 1's `useAsyncEffect.test.ts`, "tells a run its answer is stale").
3. A second tap on Stop sharing or Remove while the first is in flight must not send a second request; today the two Stop buttons have no busy state and a double tap 404s (pinned in Task 2: `useAction.test.ts` busy case and the Stop button's `disabled={busy}` in `ShareButton.test.tsx`).
4. The safety copy before an import: a cancelled picker abandons the import, a failed write stops before the wipe, and an unconfirmed download proceeds, all exactly as today (pinned in Task 3: `export-backup.test.ts` outcomes and the unchanged import cases in `BackupSection.test.tsx`).
5. A Czech UI on an English browser must show Czech dates and a decimal comma in Settings; today the three date formatters are module constants with no locale (pinned in Task 6: the `cs` rows of `format.test.ts` and the `DevicesSection` case with `i18n.language: 'cs'`).

---

### Task 1: `useAsyncEffect`, the cancel flag written once

**Files:**
- Create: `src/hooks/useAsyncEffect.ts`, `src/hooks/useAsyncEffect.test.ts`
- Modify: `biome.json` (the `correctness` rule block), `eslint.config.mjs` (one override block)
- Modify: `src/components/notes/ShareButton.tsx`, `src/components/settings/DevicesSection.tsx`, `src/components/settings/MembersSection.tsx`, `src/components/settings/SharesSection.tsx`, `src/context/AccountProvider.tsx`, `src/pages/pair.tsx`, `src/pages/share.tsx`, `src/components/settings/SyncStatusSection.tsx`, `src/components/notes/NoteEditorDialog.tsx`

**Interfaces:**
- Produces: `useAsyncEffect(effect: (alive: () => boolean) => void | Promise<void>, deps: DependencyList): void`. `alive()` is true until the deps change or the component unmounts. Failure handling is the caller's: the hook never catches.
- Consumes: nothing from other tasks.
- Not folded (ruled): `AccountProvider`'s second effect is event-driven (its request starts from `online` and `visibilitychange` listeners, and its cleanup removes them), so it stays a `useEffect`; it shares the new `apply` callback with the first effect instead. `SyncProvider`, `TourProvider` (slice 6) and `CardMedia`'s poster backfill are lifecycles and loops, not loads, and stay.

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useAsyncEffect.test.ts`:

```ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsyncEffect } from './useAsyncEffect.ts';

/** A promise the test settles by hand, so an answer can land after the deps moved on. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useAsyncEffect', () => {
  it('runs the effect alive, again when the deps change, and not when they stay', () => {
    const seen: [number, boolean][] = [];
    const { rerender } = renderHook(
      ({ id }) =>
        useAsyncEffect(
          (alive) => {
            seen.push([id, alive()]);
          },
          [id]
        ),
      { initialProps: { id: 1 } }
    );

    rerender({ id: 2 });
    // same deps, so no new run
    rerender({ id: 2 });

    expect(seen).toEqual([
      [1, true],
      [2, true],
    ]);
  });

  it('tells a run its answer is stale once the deps changed, and only that run', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const answers: [string, boolean][] = [];
    const { rerender } = renderHook(
      ({ job }: { job: Promise<string> }) =>
        useAsyncEffect(
          async (alive) => {
            answers.push([await job, alive()]);
          },
          [job]
        ),
      { initialProps: { job: first.promise } }
    );

    rerender({ job: second.promise });
    first.resolve('old');
    second.resolve('new');

    await vi.waitFor(() => expect(answers).toHaveLength(2));
    expect(answers).toEqual([
      ['old', false],
      ['new', true],
    ]);
  });

  it('tells a run its answer is stale after unmount', () => {
    let alive: (() => boolean) | undefined;
    const { unmount } = renderHook(() =>
      useAsyncEffect((guard) => {
        alive = guard;
      }, [])
    );

    expect(alive?.()).toBe(true);
    unmount();
    expect(alive?.()).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/hooks/useAsyncEffect.test.ts`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useAsyncEffect.ts`:

```ts
import { type DependencyList, useEffect } from 'react';

type AsyncEffect = (alive: () => boolean) => void | Promise<void>;

function start(effect: AsyncEffect): () => void {
  let live = true;
  void effect(() => live);
  return () => {
    live = false;
  };
}

/**
 * An effect that awaits. `alive()` is true until the deps change or the component unmounts, so a
 * late answer never writes into a newer render. What a failure means stays the caller's.
 * Set state only after an await: the effect lint rules cannot see into this closure.
 */
export function useAsyncEffect(effect: AsyncEffect, deps: DependencyList): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's, by contract
  useEffect(() => start(effect), deps);
}
```

The call stays on one line under the suppression: Biome reports the missing literal at the `deps` argument, and the suppression covers only the line that follows it (verified with a probe on 2026-10-03; a comment between the two made it miss).

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run src/hooks/useAsyncEffect.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Teach both linters the hook**

In `biome.json`, inside `linter.rules`, add a `correctness` block beside `a11y`, `suspicious` and `style` (Biome checks only the hooks it knows; this keeps every caller's deps array an error-level gate):

```json
"correctness": {
  "useExhaustiveDependencies": {
    "level": "error",
    "options": {
      "hooks": [{ "name": "useAsyncEffect", "closureIndex": 0, "dependenciesIndex": 1 }]
    }
  }
},
```

Run `pnpm check` afterwards so Biome formats its own config; `pnpm check:ci` on the untouched repo stays at zero errors with this option (verified 2026-10-03).

In `eslint.config.mjs`, after the `reactHooks.configs.flat['recommended-latest']` block, add:

```js
  // Hooks that pass the caller's deps array on, by contract: the rule cannot read it. Biome checks
  // the callers of `useAsyncEffect` instead (biome.json).
  {
    files: ['src/hooks/useAsyncEffect.ts', 'src/data/useLive.ts'],
    rules: { 'react-hooks/exhaustive-deps': 'off' },
  },
```

Why not ESLint's `additionalHooks` for `useAsyncEffect`: it then treats the callback as an effect and warns "Effect callbacks are synchronous" on every `async (alive) => …` caller (probed), which defeats the hook. Including `useLive` clears two of the six pre-existing warnings; four remain.

Probe the gate once: in `src/pages/share.tsx` (after Step 6) drop `token` from the deps array, run `pnpm check:ci`, expect an error naming `token`, restore it.

- [ ] **Step 6: Fold the nine sites**

Each site: import `useAsyncEffect` from `@/hooks/useAsyncEffect.ts`, replace the effect, drop `useEffect` from the React import where nothing else uses it, and run `pnpm check` to let Biome reflow. Deps arrays stay what they were unless noted.

`src/components/notes/ShareButton.tsx`, the share lookup (today lines 42-52):

```tsx
  useAsyncEffect(
    async (alive) => {
      if (!signedIn || !noteId) return;
      // An unanswered read shows as unshared; the next tap tells the truth.
      const all = await service.shares().catch(() => null);
      if (alive() && all) setShare(all.find((s) => s.noteId === noteId) ?? null);
    },
    [signedIn, service, noteId]
  );
```

`src/components/settings/DevicesSection.tsx`, `load` and the effect (today lines 23-45). `load` keeps serving `remove`, which calls it with no guard:

```tsx
  const load = useCallback(
    async (alive: () => boolean = () => true) => {
      if (!service) return;
      try {
        const found = await service.devices();
        if (alive()) setDevices(found);
      } catch {
        if (alive()) toast.error(t('account.errors.unknown'));
      }
    },
    [service, t]
  );

  // Once per signed-in session: another Device's pairing shows up on the next visit.
  const accountId = session?.accountId;
  useAsyncEffect(
    (alive) => {
      if (accountId) return load(alive);
    },
    [accountId, load]
  );
```

`src/components/settings/MembersSection.tsx`, the effect (today lines 110-120):

```tsx
  useAsyncEffect(
    async (alive) => {
      if (!isOwner || !service) return;
      try {
        const found = await service.accounts();
        if (alive()) setMembers(found);
      } catch {
        if (alive()) toast.error(t('account.errors.unknown'));
      }
    },
    [isOwner, service, t]
  );
```

`src/components/settings/SharesSection.tsx`, the effect (today lines 30-39); `load` is unchanged:

```tsx
  useAsyncEffect(
    async (alive) => {
      if (!accountId) return;
      try {
        const found = await load();
        if (alive() && found) setRows(found);
      } catch {
        if (alive()) toast.error(t('account.errors.unknown'));
      }
    },
    [accountId, load, t]
  );
```

`src/context/AccountProvider.tsx`, both effects (today lines 48-90). Add `useCallback` to the React import; `Session` is already imported as a type:

```tsx
  // What the server said about this Device, applied the same way whichever ask it answers.
  const apply = useCallback((found: Session | null) => {
    setSessionState(found);
    setStatus(found ? 'signed-in' : 'signed-out');
  }, []);

  useAsyncEffect(
    async (alive) => {
      if (!service) return;
      try {
        const found = await service.session();
        if (alive()) apply(found);
      } catch {
        if (alive()) setStatus('unavailable');
      }
    },
    [service, apply]
  );

  // An app opened offline (or before the server was up) asks again when the
  // network or the page comes back, so it starts syncing without a restart.
  // Only while nothing has answered: a signed-in Device is not re-asked.
  useEffect(() => {
    if (!service || status !== 'unavailable') return;
    let current = true;
    const retry = () => {
      if (document.visibilityState === 'hidden') return;
      service
        .session()
        .then((found) => current && apply(found))
        .catch(() => {});
    };
    window.addEventListener('online', retry);
    document.addEventListener('visibilitychange', retry);
    return () => {
      current = false;
      window.removeEventListener('online', retry);
      document.removeEventListener('visibilitychange', retry);
    };
  }, [service, status, apply]);
```

`src/pages/pair.tsx`, the effect (today lines 29-39):

```tsx
  useAsyncEffect(
    async (alive) => {
      if (!code || !service) return;
      try {
        const needed = await service.setupNeeded();
        if (alive()) setMode(needed ? 'owner' : 'device');
      } catch {
        if (alive()) setMode('unreachable');
      }
    },
    [code, service]
  );
```

`src/pages/share.tsx`, the effect (today lines 22-33):

```tsx
  useAsyncEffect(
    async (alive) => {
      try {
        const found = await fetchSharedNote(token);
        if (alive()) {
          setState(found === 'gone' ? { status: 'gone' } : { status: 'shown', shared: found });
        }
      } catch {
        if (alive()) setState({ status: 'failed' });
      }
    },
    [token]
  );
```

`src/components/settings/SyncStatusSection.tsx`, `useStorage` (today lines 23-37). As today, a rejected `persisted()` is not caught (ticketed, see Task 7):

```tsx
/** What the browser says about keeping this Device's data; `null` where it cannot say. */
function useStorage(): Storage | null {
  const [storage, setStorage] = useState<Storage | null>(null);
  useAsyncEffect(async (alive) => {
    const manager = navigator.storage;
    if (!manager?.persisted) return;
    const [persisted, estimate] = await Promise.all([manager.persisted(), manager.estimate?.()]);
    if (alive()) setStorage({ persisted, usage: estimate?.usage });
  }, []);
  return storage;
}
```

`src/components/notes/NoteEditorDialog.tsx`, the load effect (today lines 125-146); `useEffect` stays imported for the autosave timer:

```tsx
  // Load an existing note's content once on mount (not via a live query).
  useAsyncEffect(
    async (alive) => {
      if (!noteId) return;
      const n = await store.notes.get(noteId);
      if (!alive()) return;
      if (n) {
        setHeader(n.header ?? '');
        setBody(n.body ?? '');
        setColor(n.color);
        setReminder(reminderOf(n));
        setPinnedAt(n.pinnedAt);
        setState(n.state);
        return;
      }
      // Not a blank editor: typing into it would silently recreate the note under the dead id.
      onNoteMissing?.();
    },
    [noteId, onNoteMissing, store]
  );
```

- [ ] **Step 7: Run the sites' tests and the gates**

Run:
```bash
pnpm vitest run src/hooks/useAsyncEffect.test.ts src/components/notes/ShareButton.test.tsx src/components/settings/AccountSection.test.tsx src/context/AccountProvider.test.tsx src/pages/pair.test.tsx src/pages/share.test.tsx src/context/SyncProvider.test.tsx src/components/notes/NoteEditorDialog.test.tsx src/components/notes/NoteEditorDialog.realEditor.test.tsx
pnpm check:ci
pnpm lint
pnpm exec tsc -b --noEmit
```
Expected: all green; `pnpm lint` reports four warnings (`useLive`'s two are gone), no errors. `grep -rn "let current = true\|let active = true" src --include=*.tsx --include=*.ts` finds only `AccountProvider.tsx` (effect B) and `CardMedia.tsx`; `SyncProvider.tsx` and `TourProvider.tsx` name their flag `cancelled` and stay out of scope.

- [ ] **Step 8: Commit**

Stop and ask souki to commit:

```
refactor(hooks): useAsyncEffect owns the cancel flag of nine awaiting effects
```

---

### Task 2: `useAction` for the user's remote calls, and one `LinkDialog`

**Files:**
- Create: `src/hooks/useAction.ts`, `src/hooks/useAction.test.ts`
- Create: `src/components/ui/LinkDialog.tsx`, `src/components/ui/LinkDialog.test.tsx`
- Modify: `src/components/notes/ShareButton.tsx`, `src/components/notes/ShareButton.test.tsx`, `src/components/settings/SharesSection.tsx`, `src/components/settings/DevicesSection.tsx`, `src/components/account/SignOutButton.tsx`, `src/components/account/PairingLinkButton.tsx`

**Interfaces:**
- Produces: `useAction(): { busy: boolean; run: (act: () => Promise<boolean | void>, keys?: { success?: string; failure?: string | ((error: unknown) => string) }) => Promise<boolean> }`. `run` toasts `t(keys.success)` when `act` resolves unless it answered `false` (it backed out), toasts `t(failure)` when it throws (`'account.errors.unknown'` by default, or the key the function picks from the error), holds `busy` for the duration, and answers whether `act` finished.
- Produces: `LinkDialog({ open, onOpenChange, title, description, link, children?, actions? })`: the Share Link and both Pairing Links' dialog, with the code block, Copy (disabled until `link` is set) and Done; `link: string | null`, null showing the "making a link" wait; `children` render above the link, `actions` before Copy.
- Consumes: `useAsyncEffect` (Task 1) already in the touched files.
- Fixed by construction: the two Stop sharing buttons gain `busy` (today a double tap sends a second `revokeShare`, which 404s); "Save a backup" in Task 3 gains it the same way.
- Not folded (ruled): `AccountForm.submit` and `ResetPasswordButton.submit` render their failure inline through `accountErrorKey`, which is a different contract; the sync loop's toasts are notifications, not actions.

- [ ] **Step 1: Write the failing hook test**

Create `src/hooks/useAction.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAction } from './useAction.ts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAction', () => {
  it('toasts the success key once the act resolves, and says it finished', async () => {
    const { result } = renderHook(() => useAction());
    let finished: boolean | undefined;

    await act(async () => {
      finished = await result.current.run(async () => {}, { success: 'done' });
    });

    expect(finished).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('done');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says nothing when the act backed out with false', async () => {
    const { result } = renderHook(() => useAction());

    await act(async () => {
      await result.current.run(async () => false, { success: 'done' });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toasts the generic failure by default, and the key picked from the error when given one', async () => {
    const { result } = renderHook(() => useAction());
    const boom = new Error('boom');
    let finished: boolean | undefined;

    await act(async () => {
      finished = await result.current.run(async () => {
        throw boom;
      });
    });

    expect(finished).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('account.errors.unknown');

    const failure = vi.fn(() => 'picked');
    await act(async () => {
      await result.current.run(
        async () => {
          throw boom;
        },
        { failure }
      );
    });

    expect(failure).toHaveBeenCalledWith(boom);
    expect(toast.error).toHaveBeenLastCalledWith('picked');
  });

  it('is busy while the act runs and idle after', async () => {
    const { result } = renderHook(() => useAction());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let running!: Promise<boolean>;

    act(() => {
      running = result.current.run(() => gate);
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      release();
      await running;
    });
    expect(result.current.busy).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/hooks/useAction.test.ts`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useAction.ts`:

```ts
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

type Keys = {
  /** Toasted when `act` resolves, unless it answered `false` to say it backed out. */
  success?: string;
  /** Toasted when `act` throws; a function picks the key from the error. */
  failure?: string | ((error: unknown) => string);
};

/**
 * One thing the user asked for that takes a while: `busy` while it runs, a toast when it ends.
 * `run` answers whether `act` finished, so a caller can undo what it set up before the call.
 */
export function useAction(): {
  busy: boolean;
  run: (act: () => Promise<boolean | void>, keys?: Keys) => Promise<boolean>;
} {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (act: () => Promise<boolean | void>, keys: Keys = {}) => {
      setBusy(true);
      try {
        const outcome = await act();
        if (keys.success && outcome !== false) toast.success(t(keys.success));
        return true;
      } catch (error) {
        const failure = keys.failure ?? 'account.errors.unknown';
        toast.error(t(typeof failure === 'function' ? failure(error) : failure));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [t]
  );

  return { busy, run };
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run src/hooks/useAction.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing dialog test**

Create `src/components/ui/LinkDialog.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkDialog } from './LinkDialog.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const LINK = 'https://notes.example/share/abc';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LinkDialog', () => {
  it('shows the link above its extras, copies it, and closes from Done', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const onOpenChange = vi.fn();
    render(
      <LinkDialog
        open
        onOpenChange={onOpenChange}
        title="Title"
        description="Why"
        link={LINK}
        actions={<button type="button">extra</button>}
      >
        <p>above</p>
      </LinkDialog>
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(LINK);
    expect(screen.getByText('above')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'extra' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'account.qr.copy' }));
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(toast.success).toHaveBeenCalledWith('account.qr.copied');

    await user.click(screen.getByRole('button', { name: 'account.qr.done' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('waits visibly while the link is still being made, with Copy disabled', () => {
    render(<LinkDialog open onOpenChange={vi.fn()} title="Title" description="Why" link={null} />);

    expect(screen.getByText('account.qr.making')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'account.qr.copy' })).toBeDisabled();
  });
});
```

- [ ] **Step 6: Run it to see it fail**

Run: `pnpm vitest run src/components/ui/LinkDialog.test.tsx`
Expected: FAIL, the module does not exist.

- [ ] **Step 7: Write the dialog**

Create `src/components/ui/LinkDialog.tsx`:

```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';

/**
 * A link to hand on: the Share Link and both Pairing Links. `link` is null while the server is
 * still minting it. `children` sit above the link (a QR and its captions), `actions` before Copy.
 */
export function LinkDialog({
  open,
  onOpenChange,
  title,
  description,
  link,
  children,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  link: string | null;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation();

  const copy = async () => {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    toast.success(t('account.qr.copied'));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {link ? (
          <div className="flex flex-col gap-3">
            {children}
            <code className="select-all break-all rounded-md border bg-muted px-2 py-1 text-xs">
              {link}
            </code>
          </div>
        ) : (
          <p className="flex h-56 items-center justify-center gap-2 text-muted-foreground text-sm">
            <Spinner />
            {t('account.qr.making')}
          </p>
        )}
        <DialogFooter>
          {actions}
          <Button variant="outline" disabled={!link} onClick={() => void copy()}>
            {t('account.qr.copy')}
          </Button>
          <Button onClick={() => onOpenChange(false)}>{t('account.qr.done')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Run the dialog test to see it pass**

Run: `pnpm vitest run src/components/ui/LinkDialog.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 9: Add the failing Stop case to `ShareButton.test.tsx`**

In the `ShareButton` describe, after `mints, shows and copies the link, then stops sharing`, add a case that uses the file's own helpers (`signedIn(...)`, the fake `server`, the mocked `toast`):

```tsx
  it('reports a stop the server refused and keeps the link, with the button held while it runs', async () => {
    const { server } = await signedIn();
    await userEvent.click(await screen.findByRole('button', { name: 'share.action' }));
    const stop = await screen.findByRole('button', { name: 'share.stop' });

    server.state.broken = true;
    await userEvent.click(stop);

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('account.errors.unknown'));
    expect(server.shares).toHaveLength(1);
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(stop).not.toBeDisabled();
  });
```

If `signedIn()` does not return the server in that file, read how the existing tests reach `server.shares` and use the same handle; the assertions stay as written. This case passes on today's code too: it pins the failure path that `useAction` takes over in Step 10 (no test drove a remote action to fail before), so run `pnpm vitest run src/components/notes/ShareButton.test.tsx` and expect PASS now and after the fold.

- [ ] **Step 10: Fold the six sites**

`src/components/notes/ShareButton.tsx`. Imports: drop `toast` and the six `Dialog*` names, add `useAction` from `@/hooks/useAction.ts` and `LinkDialog` from `@/components/ui/LinkDialog.tsx`; `ProblemError`, `shareLink`, `Button` stay. Keep the component's props and the trigger `<button>` exactly as they are. Above the component:

```tsx
/** The server has not seen this Note yet: a fresh draft, or edits still queued. */
const unsynced = (error: unknown) => error instanceof ProblemError && error.status === 404;
```

Inside, replace the `busy` state with `const { busy, run } = useAction();`, and `mint`, `stop`, `link`, `copy` and the dialog with:

```tsx
  const mint = () =>
    run(
      async () => {
        const id = await ensureNoteId();
        let minted: Share;
        try {
          minted = await service.share(id);
        } catch (error) {
          if (!unsynced(error)) throw error;
          await syncNow();
          minted = await service.share(id);
        }
        setShare(minted);
        setOpen(true);
      },
      { failure: (error) => (unsynced(error) ? 'share.notSynced' : 'account.errors.unknown') }
    );

  const stop = async () => {
    if (!share) return;
    await run(
      async () => {
        await service.revokeShare(share.id);
        setShare(null);
        setOpen(false);
      },
      { success: 'share.stopped' }
    );
  };

  const link = share ? shareLink(window.location.origin, share.token) : null;
```

and, after the trigger button:

```tsx
      <LinkDialog
        open={open}
        onOpenChange={setOpen}
        title={t('share.title')}
        description={t('share.description')}
        link={link}
        actions={
          <Button variant="outline" disabled={busy} onClick={() => void stop()}>
            {t('share.stop')}
          </Button>
        }
      />
```

`src/components/settings/SharesSection.tsx`. Drop `toast`; add `useAction`. Replace `stop`:

```tsx
  const { busy, run } = useAction();

  const stop = (share: Share) =>
    run(
      async () => {
        await service.revokeShare(share.id);
        setRows((all) => all.filter((r) => r.id !== share.id));
      },
      { success: 'share.stopped' }
    );
```

The row's Stop button gets `disabled={busy}`; its `onClick={() => void stop(row)}` stays. `toast` stays imported only if the Task 1 effect still uses it (it does).

`src/components/settings/DevicesSection.tsx`. Add `useAction`; `toast` stays for `load`. Replace `remove`:

```tsx
  const { run } = useAction();

  const remove = async (device: Device) => {
    await run(() => service.revokeDevice(device.id), { success: 'account.devices.removed' });
    await load();
  };
```

`src/components/account/SignOutButton.tsx`. Drop `toast` and the `busy` state; add `useAction`. Replace `erase`:

```tsx
  const { busy, run } = useAction();

  const erase = async () => {
    if (!service) return;
    await run(
      async () => {
        // Asked again at the last moment: an edit may have landed since the dialog opened.
        const owed = await store.sync.dirty();
        if (Object.values(owed).some((rows) => rows.length > 0)) {
          setDialog('blocked');
          return false;
        }
        await service.signOut();
        await sync.stop();
        await store.clear();
        setSession(null);
      },
      { success: 'account.section.signedOut' }
    );
  };
```

`saveBackup` keeps its `toast` calls until Task 3 replaces it, so `toast` stays imported in this task.

`src/components/account/PairingLinkButton.tsx`. Drop `toast` and the six `Dialog*` names and `Spinner`; add `useAction` and `LinkDialog`. `PairingQr` is unchanged. Replace `show`, `copy` and the JSX:

```tsx
  const { run } = useAction();

  const show = async () => {
    if (!service) return;
    setLink(null);
    setOpen(true);
    const made = await run(
      async () => {
        const { code } = await (kind === 'device'
          ? service.createDeviceCode()
          : service.createInvite());
        setLink(pairingLink(window.location.origin, code));
      },
      { failure: 'account.qr.failed' }
    );
    if (!made) setOpen(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => void show()}>
        {label}
      </Button>
      <LinkDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description={t(
          kind === 'device' ? 'account.qr.deviceDescription' : 'account.qr.inviteDescription'
        )}
        link={link}
      >
        {link && (
          <>
            <PairingQr value={link} label={label} />
            <p className="text-muted-foreground text-sm">{t('account.qr.expires')}</p>
            <p className="text-sm">{t('account.qr.orOpen')}</p>
          </>
        )}
      </LinkDialog>
    </>
  );
```

- [ ] **Step 11: Run the sites' tests and the gates**

Run:
```bash
pnpm vitest run src/hooks/useAction.test.ts src/components/ui/LinkDialog.test.tsx src/components/notes/ShareButton.test.tsx src/components/settings/AccountSection.test.tsx
pnpm check:ci
pnpm lint
pnpm exec tsc -b --noEmit
```
Expected: all green, four ESLint warnings. `grep -rn "toast.error(t('account.errors.unknown'))" src --include=*.tsx` finds only the three load-time catches from Task 1 (Devices `load`, Members, Shares).

- [ ] **Step 12: Commit**

Stop and ask souki to commit:

```
refactor(ui): useAction brackets the user's remote calls, LinkDialog hands on a link
```

---

### Task 3: One `exportBackup` for the three export flows

**Files:**
- Create: `src/lib/export-backup.ts`, `src/lib/export-backup.test.ts`
- Modify: `src/components/settings/BackupSection.tsx`, `src/components/account/SignOutButton.tsx`, `src/components/settings/AccountSection.test.tsx`

**Interfaces:**
- Produces: `exportBackup(store: LocalStore, suffix = ''): Promise<'cancelled' | 'saved' | 'unconfirmed'>` and the type `ExportOutcome`. Destination first (`requestSaveTarget(backupFilename(suffix))`), then `buildBackupZip(store)`, then the write; `cancelled` is the picker's `null`, `unconfirmed` the anchor fallback. A failed build or write throws.
- Consumes: `useAction` (Task 2).
- Why its own module and not `backup.ts`: `BackupSection.test.tsx` mocks `@/lib/backup.ts` partially (`buildBackupZip`, `requestSaveTarget`, …) and asserts the call order through those mocks; a function inside `backup.ts` would call the real neighbours, so the module sits beside `hand-off.ts` and imports from `./backup.ts`, which the mock covers.
- Harmless changes: the Export button and the import confirm show busy from the click on, the save dialog included (today busy began after the picker closed); "Save a backup" in the blocked sign-out dialog disables while it runs and shares `busy` with Sign out.
- Kept as today (ticketed): an unconfirmed safety copy (Firefox, Safari) lets the restore proceed.

- [ ] **Step 1: Write the failing lib test**

Create `src/lib/export-backup.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalStore } from '@/data/LocalStore.ts';
import type { SaveTarget } from '@/lib/backup.ts';
import { exportBackup } from './export-backup.ts';

const backup = vi.hoisted(() => ({
  buildBackupZip: vi.fn(),
  requestSaveTarget: vi.fn(),
}));

vi.mock('@/lib/backup.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/backup.ts')>()),
  ...backup,
}));

const store = {} as LocalStore;
const zip = new Blob(['zip']);

function target(confirmed: boolean): SaveTarget & { write: ReturnType<typeof vi.fn> } {
  return { confirmed, write: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  backup.buildBackupZip.mockResolvedValue(zip);
});

describe('exportBackup', () => {
  it('asks where the file goes before building it, and names it with the suffix', async () => {
    backup.requestSaveTarget.mockResolvedValue(target(true));

    await exportBackup(store, '-before-import');

    expect(backup.requestSaveTarget.mock.invocationCallOrder[0]).toBeLessThan(
      backup.buildBackupZip.mock.invocationCallOrder[0]
    );
    expect(backup.requestSaveTarget.mock.calls[0][0]).toMatch(/^ruflo-backup-.*-before-import\.zip$/);
  });

  it.each([
    ['a chosen destination', target(true), 'saved'],
    ['the anchor fallback', target(false), 'unconfirmed'],
  ])('writes the zip to %s and says so', async (_name, chosen, outcome) => {
    backup.requestSaveTarget.mockResolvedValue(chosen);

    expect(await exportBackup(store)).toBe(outcome);
    expect(chosen.write).toHaveBeenCalledWith(zip);
  });

  it('builds nothing when the picker was cancelled', async () => {
    backup.requestSaveTarget.mockResolvedValue(null);

    expect(await exportBackup(store)).toBe('cancelled');
    expect(backup.buildBackupZip).not.toHaveBeenCalled();
  });

  it('lets a failed build through, so a caller restoring on top of it stops', async () => {
    const chosen = target(true);
    backup.requestSaveTarget.mockResolvedValue(chosen);
    backup.buildBackupZip.mockRejectedValue(new Error('out of memory'));

    await expect(exportBackup(store)).rejects.toThrow('out of memory');
    expect(chosen.write).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm vitest run src/lib/export-backup.test.ts`
Expected: FAIL, the module does not exist.

- [ ] **Step 3: Write the module**

Create `src/lib/export-backup.ts`:

```ts
import type { LocalStore } from '@/data/LocalStore.ts';
import { backupFilename, buildBackupZip, requestSaveTarget } from './backup.ts';

export type ExportOutcome = 'cancelled' | 'saved' | 'unconfirmed';

/**
 * The one export flow: destination first (the picker needs the click's user activation), then
 * the zip, then the write. `unconfirmed` is the anchor fallback, where nobody can say the file
 * landed. A failed build or write throws, so a caller restoring on top of it stops before the wipe.
 */
export async function exportBackup(store: LocalStore, suffix = ''): Promise<ExportOutcome> {
  const target = await requestSaveTarget(backupFilename(suffix));
  if (!target) return 'cancelled';
  await target.write(await buildBackupZip(store));
  return target.confirmed ? 'saved' : 'unconfirmed';
}
```

- [ ] **Step 4: Run the test to see it pass**

Run: `pnpm vitest run src/lib/export-backup.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Add the failing "Save a backup" case to `AccountSection.test.tsx`**

The blocked dialog's "Save a backup" has no test. At the top of the file, beside the other mocks:

```tsx
const exportBackup = vi.hoisted(() => vi.fn());
vi.mock('@/lib/export-backup.ts', () => ({ exportBackup }));
```

and in the describe that holds `refuses to sign out while a change is still owed, offering a way out`, add:

```tsx
  it('saves a backup from the blocked dialog through the one export flow', async () => {
    exportBackup.mockResolvedValue('saved');
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    await testStore.notes.add({
      id: crypto.randomUUID(),
      state: 'active',
      createdAt: T0,
      updatedAt: T0,
    });
    mount(server);
    await signIn('ada', 'correct horse');
    await userEvent.click(await screen.findByRole('button', { name: 'account.section.signOut' }));

    await userEvent.click(
      await screen.findByRole('button', { name: 'account.section.saveBackup' })
    );

    await waitFor(() => expect(exportBackup).toHaveBeenCalledTimes(1));
    expect(exportBackup).toHaveBeenCalledWith(testStore);
  });
```

Run: `pnpm vitest run src/components/settings/AccountSection.test.tsx`
Expected: the new case FAILS (`exportBackup` never called: the button still runs its own copy).

- [ ] **Step 6: Fold the three flows**

`src/components/settings/BackupSection.tsx`. Imports: `backupFilename`, `buildBackupZip` and `requestSaveTarget` go; add `exportBackup` from `@/lib/export-backup.ts` and `useAction` from `@/hooks/useAction.ts`; `toast` stays for `toast.info`. The `Busy` type and `busy` state go. Replace the three handlers:

```tsx
  const exporting = useAction();
  const importing = useAction();
  const busy = exporting.busy || importing.busy;

  const handleExport = () =>
    exporting.run(async () => (await exportBackup(store)) === 'saved', {
      success: 'settings.backup.exported',
      failure: 'settings.backup.error.unknown',
    });

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Clear the input so picking the same file twice still fires a change.
    event.target.value = '';
    if (!file) return;
    void importing.run(
      async () => {
        const parsed = await parseBackupZip(new Uint8Array(await file.arrayBuffer()));
        setBackupFirst(true);
        setPending(parsed);
      },
      { failure: errorKey }
    );
  };

  const confirmRestore = () => {
    const backup = pending;
    if (!backup) return;
    setPending(null);
    void importing.run(
      async () => {
        // Backing out of the safety copy backs out of the import: restoring anyway would destroy
        // exactly the data the user just declined to lose. A failed copy throws before the wipe.
        if (backupFirst && (await exportBackup(store, '-before-import')) === 'cancelled') {
          toast.info(t('settings.backup.importCancelled'));
          return false;
        }
        await restoreBackup(store, backup);
      },
      { success: 'settings.backup.imported', failure: errorKey }
    );
  };
```

In the JSX: both buttons `disabled={busy}`; the export button shows the spinner and `settings.backup.exporting` on `exporting.busy`, the import button on `importing.busy`; `onClick={() => void handleExport()}` and `onConfirm={confirmRestore}` (`handleFile` and `confirmRestore` now return void).

`src/components/account/SignOutButton.tsx`. Imports: `backupFilename`, `buildBackupZip`, `requestSaveTarget` and `toast` go; add `exportBackup`. Replace `saveBackup`, sharing Task 2's `run`:

```tsx
  const saveBackup = () =>
    run(async () => (await exportBackup(store)) === 'saved', {
      success: 'settings.backup.exported',
      failure: 'settings.backup.error.unknown',
    });
```

The blocked dialog's button becomes `<Button variant="outline" disabled={busy} onClick={() => void saveBackup()}>`.

- [ ] **Step 7: Run the tests and the gates**

Run:
```bash
pnpm vitest run src/lib/export-backup.test.ts src/components/settings/BackupSection.test.tsx src/components/settings/AccountSection.test.tsx src/lib/saveTarget.test.ts
pnpm check:ci
pnpm lint
pnpm exec tsc -b --noEmit
```
Expected: all green; every case in `BackupSection.test.tsx` passes unchanged (its mocks of `@/lib/backup.ts` still see the calls through `export-backup.ts`). `grep -rn "requestSaveTarget\|buildBackupZip" src --include=*.tsx` finds no component.

- [ ] **Step 8: Commit**

Stop and ask souki to commit:

```
refactor(backup): one exportBackup flow behind the three export buttons
```

---

### Task 4: Settings rows bound to a Preference key

**Files:**
- Modify: `src/context/PreferencesProvider.tsx` (three option lists, read by the schema)
- Modify: `src/components/settings/SettingsSection.tsx` (`PreferenceSwitch`, `PreferenceSegmented`; `SwitchSetting` goes)
- Create: `src/components/settings/SettingsSection.test.tsx`
- Modify: `src/components/settings/AppearanceSection.tsx`, `src/components/settings/AppearanceSection.test.tsx`, `src/components/settings/QuickCaptureSection.tsx`, `src/components/settings/SyncStatusSection.tsx`

**Interfaces:**
- Produces: `DENSITY_OPTIONS`, `REDUCED_MOTION_OPTIONS`, `NOTE_BUTTON_ALIGNMENT_OPTIONS` (readonly tuples the Zod enums are built from, so a value added to the schema reaches the row), `PreferenceSwitch({ pref, keys })` for a boolean Preference and `PreferenceSegmented({ pref, options, keys })` for a string-valued one. `keys` is the i18n base: `<keys>.label`, `<keys>.description`, and for a segmented row `<keys>.<value>`; passed explicitly because `keepEverything` lives under `sync.` and the alignment under `settings.quickCapture.alignment`.
- Consumes: nothing from other tasks.
- Keeps: `SettingsSection`, `SettingsRow`, `SegmentedSetting` (Theme is not a Preference: `useTheme` owns it under its own storage key, and `settings.test.tsx` pins that the Preferences blob never gains a `theme`).
- Not folded (ruled): the Language `Select`, the quick-capture list (per-row `disabled`, interpolated names, whole-array writes) and the toolbar editor are not key-bound rows. The Radix empty-value guard that `SortMenu` and `ToolbarLayoutEditor` repeat is outside Settings (ticketed).

- [ ] **Step 1: Export the option lists**

In `src/context/PreferencesProvider.tsx`, after `PREFERENCES_VERSION`:

```ts
/** The choices a segmented Settings row offers, in display order; the schema validates the same lists. */
export const NOTE_BUTTON_ALIGNMENT_OPTIONS = ['left', 'right'] as const;
export const DENSITY_OPTIONS = ['comfortable', 'compact'] as const;
export const REDUCED_MOTION_OPTIONS = ['system', 'always', 'never'] as const;
```

and in the schema: `noteButtonAlignment: z.enum(NOTE_BUTTON_ALIGNMENT_OPTIONS).default('right')`, `density: z.enum(DENSITY_OPTIONS).default('comfortable')`, `reducedMotion: z.enum(REDUCED_MOTION_OPTIONS).default('system')`. The field comments stay.

Run: `pnpm vitest run src/context/PreferencesProvider.test.tsx`
Expected: PASS unchanged.

- [ ] **Step 2: Write the failing table test for the two rows**

Create `src/components/settings/SettingsSection.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DENSITY_OPTIONS,
  NOTE_BUTTON_ALIGNMENT_OPTIONS,
  PREFERENCES_STORAGE_KEY,
  type Preferences,
  PreferencesProvider,
  REDUCED_MOTION_OPTIONS,
} from '@/context/PreferencesProvider.tsx';
import { PreferenceSegmented, PreferenceSwitch } from './SettingsSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const wrapper = ({ children }: { children: ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

function stored(): Preferences {
  const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
  if (!raw) throw new Error('nothing written yet');
  return JSON.parse(raw) as Preferences;
}

afterEach(() => {
  localStorage.clear();
});

describe('PreferenceSwitch', () => {
  it.each([
    ['colorBlind', 'settings.colorBlind', false],
    ['sinkCheckedItems', 'settings.sinkCheckedItems', true],
    ['keepEverything', 'sync.keepEverything', false],
  ] as const)('%s starts at its default, says why, and writes the flip', async (pref, keys, initial) => {
    render(<PreferenceSwitch pref={pref} keys={keys} />, { wrapper });
    const control = screen.getByRole('switch', { name: `${keys}.label` });
    expect(control).toHaveAttribute('aria-checked', String(initial));
    expect(screen.getByText(`${keys}.description`)).toBeInTheDocument();

    await userEvent.click(control);

    expect(stored()[pref]).toBe(!initial);
  });
});

describe('PreferenceSegmented', () => {
  it.each([
    ['density', DENSITY_OPTIONS, 'settings.density', 'comfortable', 'compact'],
    ['reducedMotion', REDUCED_MOTION_OPTIONS, 'settings.reducedMotion', 'system', 'always'],
    [
      'noteButtonAlignment',
      NOTE_BUTTON_ALIGNMENT_OPTIONS,
      'settings.quickCapture.alignment',
      'right',
      'left',
    ],
  ] as const)(
    '%s offers every value, starts at its default and writes a choice',
    async (pref, options, keys, initial, next) => {
      render(<PreferenceSegmented pref={pref} options={options} keys={keys} />, { wrapper });
      const group = screen.getByRole('radiogroup', { name: `${keys}.label` });
      expect(within(group).getAllByRole('radio')).toHaveLength(options.length);
      expect(screen.getByRole('radio', { name: `${keys}.${initial}` })).toBeChecked();
      expect(screen.getByText(`${keys}.description`)).toBeInTheDocument();

      await userEvent.click(screen.getByRole('radio', { name: `${keys}.${next}` }));

      expect(stored()[pref]).toBe(next);
    }
  );

  it('keeps the current value when the active option is pressed again', async () => {
    // Radix clears a single ToggleGroup on a repeat press, and a setting must never be empty.
    render(
      <PreferenceSegmented pref="density" options={DENSITY_OPTIONS} keys="settings.density" />,
      { wrapper }
    );

    await userEvent.click(screen.getByRole('radio', { name: 'settings.density.comfortable' }));

    expect(screen.getByRole('radio', { name: 'settings.density.comfortable' })).toBeChecked();
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm vitest run src/components/settings/SettingsSection.test.tsx`
Expected: FAIL, the components are not exported.

- [ ] **Step 4: Write the two rows**

In `src/components/settings/SettingsSection.tsx`, add the imports and the two components, and delete `SwitchSetting` (its three users become `PreferenceSwitch` in Step 5). The file keeps `SettingsSection`, `SettingsRow` and `SegmentedSetting` as they are:

```tsx
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/components/ui/switch.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import {
  type PreferenceKey,
  type Preferences,
  usePreferences,
} from '@/context/PreferencesProvider.tsx';
```

```tsx
/** The Preference keys whose value is a `T`: a switch binds a boolean, a segmented row a string. */
type PreferenceOf<T> = {
  [K in PreferenceKey]: Preferences[K] extends T ? K : never;
}[PreferenceKey];

/**
 * A switch bound to a boolean Preference. `keys` is the i18n base: `<keys>.label` and
 * `<keys>.description`. `touch-reach`, not `touch-target`: a switch keeps its own shape (the 44px
 * Touch Rule).
 */
export function PreferenceSwitch({ pref, keys }: { pref: PreferenceOf<boolean>; keys: string }) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const label = t(`${keys}.label`);

  return (
    <SettingsRow label={label} description={t(`${keys}.description`)}>
      <Switch
        className="touch-reach"
        checked={preferences[pref]}
        onCheckedChange={(next) => void setPreference(pref, next)}
        aria-label={label}
      />
    </SettingsRow>
  );
}

/** A segmented row bound to a Preference with a fixed set of values; each option is `<keys>.<value>`. */
export function PreferenceSegmented<K extends PreferenceOf<string>>({
  pref,
  options,
  keys,
}: {
  pref: K;
  options: readonly Preferences[K][];
  keys: string;
}) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();

  return (
    <SegmentedSetting
      label={t(`${keys}.label`)}
      description={t(`${keys}.description`)}
      value={preferences[pref]}
      options={options.map((option) => ({ value: option, label: t(`${keys}.${option}`) }))}
      onChange={(next) => void setPreference(pref, next)}
    />
  );
}
```

These generics typecheck as written, and `pref="density"` on a switch, `pref="onboardingSeenAt"` on a segmented row and an option outside the enum are compile errors (probed with `tsc` on 2026-10-03).

- [ ] **Step 5: Run the table test to see it pass, then fold the rows**

Run: `pnpm vitest run src/components/settings/SettingsSection.test.tsx`
Expected: PASS, 7 tests.

Replace `src/components/settings/AppearanceSection.tsx` with:

```tsx
import { useTranslation } from 'react-i18next';
import { DENSITY_OPTIONS, REDUCED_MOTION_OPTIONS } from '@/context/PreferencesProvider.tsx';
import { type Theme, useTheme } from '@/context/themeProvider.tsx';
import {
  PreferenceSegmented,
  PreferenceSwitch,
  SegmentedSetting,
  SettingsSection,
} from './SettingsSection.tsx';

const THEMES: Theme[] = ['system', 'light', 'dark'];

export function AppearanceSection() {
  const { t } = useTranslation();

  return (
    <SettingsSection title={t('settings.appearance.title')}>
      <ThemeSetting />
      {/* One control carries both rhythm and type size, as DESIGN.md specifies compact; the
          values live in `globals.css` under `:root[data-density="compact"]`. */}
      <PreferenceSegmented pref="density" options={DENSITY_OPTIONS} keys="settings.density" />
      <PreferenceSwitch pref="colorBlind" keys="settings.colorBlind" />
      {/* Three states, not a switch: `system` follows the OS, and either explicit choice
          overrides it in both directions. */}
      <PreferenceSegmented
        pref="reducedMotion"
        options={REDUCED_MOTION_OPTIONS}
        keys="settings.reducedMotion"
      />
      <PreferenceSwitch pref="sinkCheckedItems" keys="settings.sinkCheckedItems" />
    </SettingsSection>
  );
}

/** Not a Preference: `ThemeProvider` keeps the theme under its own storage key (CLAUDE.md, Theming). */
function ThemeSetting() {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  return (
    <SegmentedSetting
      label={t('settings.theme.label')}
      value={theme}
      options={THEMES.map((option) => ({ value: option, label: t(`settings.theme.${option}`) }))}
      onChange={setTheme}
    />
  );
}

export default AppearanceSection;
```

In `src/components/settings/QuickCaptureSection.tsx`: import `NOTE_BUTTON_ALIGNMENT_OPTIONS` and `PreferenceSegmented`, drop the `ALIGNMENTS` constant and the `Preferences` type import, and replace the `SegmentedSetting` block with:

```tsx
        <PreferenceSegmented
          pref="noteButtonAlignment"
          options={NOTE_BUTTON_ALIGNMENT_OPTIONS}
          keys="settings.quickCapture.alignment"
        />
```

In `src/components/settings/SyncStatusSection.tsx`: import `PreferenceSwitch` in place of `SwitchSetting`, drop the `usePreferences` import and the `const { preferences, setPreference } = usePreferences();` line (nothing else read them), and replace the last row with:

```tsx
        {active && <PreferenceSwitch pref="keepEverything" keys="sync.keepEverything" />}
```

- [ ] **Step 6: Trim `AppearanceSection.test.tsx` to the section's own contract**

The per-row describes (`density`, `reduced motion`, `colour-blind palette`, `sink checked items`) are now the table in `SettingsSection.test.tsx`. Delete them, keep the file's mocks, `wrapper`, `storedPrefs`, `afterEach` and the `writes each setting without disturbing its neighbours` case verbatim, and add before it:

```tsx
  it('carries the theme, density, colour-blind, motion and sinking rows, in that order', async () => {
    render(<AppearanceSection />, { wrapper });

    const groups = await screen.findAllByRole('radiogroup');
    expect(groups.map((group) => group.getAttribute('aria-label'))).toEqual([
      'settings.theme.label',
      'settings.density.label',
      'settings.reducedMotion.label',
    ]);
    expect(screen.getAllByRole('switch').map((s) => s.getAttribute('aria-label'))).toEqual([
      'settings.colorBlind.label',
      'settings.sinkCheckedItems.label',
    ]);
  });
```

- [ ] **Step 7: Run the tests and the gates**

Run:
```bash
pnpm vitest run src/components/settings src/pages/settings.test.tsx src/routes/routes.test.tsx src/context/PreferencesProvider.test.tsx src/components/DocumentPreferences.test.tsx src/lib/tour
pnpm check:ci
pnpm lint
pnpm exec tsc -b --noEmit
```
Expected: all green. `grep -rn "SwitchSetting" src` finds nothing; `grep -rn "z.enum(\[" src/context/PreferencesProvider.tsx` finds nothing.

- [ ] **Step 8: Commit**

Stop and ask souki to commit:

```
refactor(settings): PreferenceSwitch and PreferenceSegmented bind a row to its key
```

---

### Task 5: One `Intent` from the Start or the Card to the Editor

**Files:**
- Create: `src/lib/intent.ts`, `src/components/notes/useStartPicker.test.tsx`
- Modify: `src/hooks/useOpenNote.ts`, `src/components/notes/NotesView.tsx`, `src/components/notes/NoteEditorDialog.tsx`, `src/components/editor/editor.tsx`, `src/components/notes/quickCaptureActions.ts`, `src/components/notes/useStartPicker.tsx`, `src/components/notes/DesktopCaptureBar.tsx`, `src/components/notes/QuickCaptureBar.tsx`, `src/components/cards/NoteCard.tsx`, `src/components/cards/CardMedia.tsx`, `src/components/NoteContent.tsx`, `src/components/notes/NoteFeed.tsx`
- Modify tests: `src/components/editor/editor.test.tsx`, `src/components/notes/NoteEditorDialog.test.tsx`, `src/components/notes/DesktopCaptureBar.test.tsx`, `src/components/notes/QuickCaptureBar.test.tsx`, `src/components/notes/NotesView.openNote.test.tsx`, `src/components/cards/NoteCard.test.tsx`, `src/routes/routes.test.tsx`, `src/components/layout.test.tsx`, `src/components/nav/BackButton.test.tsx`, `e2e/capture.spec.ts`

**Interfaces:**
- Produces: `Intent` in `src/lib/intent.ts`, a union by kind: `checklist`, `record`, `draw`, `files` (with `files: File[]`), `play`. `useOpenNote()` gains `opened: OpenedNote | null` (`{ id, isDraft, intent? }`, the gesture behind the open Note, null for a cold load, a shared link or Forward) and `openNote(id: string | null, intent?: Intent)` (`null` mints a draft id). `NoteEditorDialog` and `Editor` take one `intent?: Intent` prop. `QuickCaptureAction` carries `intent?: Intent` and `picker?: StartPicker` instead of `editing: NoteOpenRequest`. `useStartPicker(onStart: (intent?: Intent) => void)` returns `{ input, start(action) }`, where `start` owns the picker-versus-direct branch. Cards call `onSelect(id, intent?)`; the audio chip passes `{ kind: 'play' }`.
- Gone: `NoteOpenRequest`, `OpenIntent`, `CaptureKind`, the props `initialBody`, `autoplayFirstAudio`, `initialCapture`, `initialFiles`, the `{ autoplayFirstAudio?: boolean }` option bags on the Card path.
- Fixed by construction (Review Focus 1): the gesture is spent when the open ends. Today `NotesView` never clears it, so Forward onto the same `?note=` re-fires a capture and reopens a saved draft as blank. The clearing is a router subscription (`router.subscribe('onResolved', …)`), because a `setState` in an effect body is a lint error and a reset during render would race the navigation.
- The Tour is out of this path: `TourStage.openNote` navigates directly and must not be rerouted through `useOpenNote`.

- [ ] **Step 1: Write the failing end-to-end case**

In `e2e/capture.spec.ts`, import `closeNote` beside `skipTour` and `startNote`, and add inside `capture starts`:

```ts
  test('Forward after closing a Start reopens the saved note plain', async ({ page }) => {
    await startNote(page, 'Checklist');
    await page.locator('.tiptap').click();
    await page.keyboard.type('Milk');
    await closeNote(page);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.goForward();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // The saved item, not the Start's empty seed: the note did not reopen as a blank draft.
    await expect(dialog.getByText('Milk')).toBeVisible();
  });
```

Run: `pnpm exec playwright test e2e/capture.spec.ts -g "Forward"`
Expected: FAIL at both breakpoints (the dialog reopens with the empty checklist seed).

- [ ] **Step 2: Write the failing unit cases**

`src/components/notes/NotesView.openNote.test.tsx`: in the `NoteEditorDialog` mock, replace `initialCapture` with `intent` (typed `{ kind: string } | undefined`) and `data-capture={initialCapture ?? ''}` with `data-intent={intent?.kind ?? ''}`; delete the stale `EMPTY_CHECKLIST_BODY` line from the mock. In `does not carry a capture intent into a link`, assert `data-intent`. Then add:

```tsx
  // A gesture is spent with its open: Forward onto the same note must not record again, nor
  // show the Start's blank draft over a note saved meanwhile (CONTEXT.md "Intent").
  it('does not replay a Start when the note is reopened by going forward', async () => {
    const router = renderRoute('/');
    await userEvent.click(await screen.findByRole('button', { name: 'notes.capture.audio' }));
    const opened = await editor();
    expect(opened).toHaveAttribute('data-intent', 'record');
    const id = opened.getAttribute('data-draft-id');

    await userEvent.click(screen.getByRole('button', { name: 'close-editor' }));
    await waitFor(noEditor);
    router.history.forward();

    const reopened = await editor();
    expect(reopened).toHaveAttribute('data-intent', '');
    expect(reopened).toHaveAttribute('data-note-id', id);
  });
```

Create `src/components/notes/useStartPicker.test.tsx` (the picker contract, today an identical `it.each` in both bar tests):

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Intent } from '@/lib/intent.ts';
import { QUICK_CAPTURE_ACTIONS } from './quickCaptureActions.ts';
import { useStartPicker } from './useStartPicker.tsx';

/** The hook under a bar with one button per Start, as both real bars render it. */
function Bar({ onStart }: { onStart: (intent?: Intent) => void }) {
  const picker = useStartPicker(onStart);
  return (
    <>
      {QUICK_CAPTURE_ACTIONS.map((action) => (
        <button key={action.key} type="button" onClick={() => picker.start(action)}>
          {action.key}
        </button>
      ))}
      {picker.input}
    </>
  );
}

describe('useStartPicker', () => {
  it.each([
    ['text', undefined],
    ['checklist', { kind: 'checklist' }],
    ['audio', { kind: 'record' }],
    ['drawing', { kind: 'draw' }],
  ])('hands a %s Start straight on with its Intent, never through the picker', async (key, intent) => {
    const onStart = vi.fn();
    render(<Bar onStart={onStart} />);
    const click = vi.spyOn(screen.getByTestId('start-picker'), 'click');

    await userEvent.click(screen.getByRole('button', { name: key }));

    expect(onStart).toHaveBeenCalledWith(intent);
    expect(click).not.toHaveBeenCalled();
  });

  it.each([
    ['picture', 'image/*', null],
    ['camera', 'image/*', 'environment'],
  ])('%s opens the picker inside the tap and starts with the chosen files', async (key, accept, capture) => {
    // The tap's user activation is the only thing that can open a picker, and it does not
    // survive the route change to the editor, so the files, not the request, are what travel.
    const onStart = vi.fn();
    render(<Bar onStart={onStart} />);
    const input = screen.getByTestId('start-picker') as HTMLInputElement;
    const click = vi.spyOn(input, 'click');

    await userEvent.click(screen.getByRole('button', { name: key }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(input.accept).toBe(accept);
    expect(input.getAttribute('capture')).toBe(capture);
    expect(onStart).not.toHaveBeenCalled();

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await userEvent.upload(input, file);

    expect(onStart).toHaveBeenCalledWith({ kind: 'files', files: [file] });
  });
});
```

Update the other tests to the new shapes:

- `src/components/editor/editor.test.tsx`: every `autoplayFirstAudio` prop becomes `intent={{ kind: 'play' }}`; `initialCapture="audio"` becomes `intent={{ kind: 'record' }}`; `initialCapture="drawing"` becomes `intent={{ kind: 'draw' }}`; both `initialFiles={files}` become `intent={{ kind: 'files', files }}` (the rerender passes a fresh object on purpose: the insert must still happen once).
- `src/components/notes/NoteEditorDialog.test.tsx`: the two `initialBody={EMPTY_CHECKLIST_BODY}` become `intent={{ kind: 'checklist' }}`; the `EMPTY_CHECKLIST_BODY` import stays for the `toHaveValue` assertion.
- `src/components/notes/DesktopCaptureBar.test.tsx`: `expect(onStart).toHaveBeenCalledWith({ id: null })` becomes `toHaveBeenCalledWith()`; the picker `it.each` becomes one case for `picture` only (the hook test owns the contract), expecting `{ kind: 'files', files: [file] }`.
- `src/components/notes/QuickCaptureBar.test.tsx`: the `opens the editor in the %s state` rows become `['text', undefined]`, `['checklist', { kind: 'checklist' }]`, `['audio', { kind: 'record' }]`, `['drawing', { kind: 'draw' }]`; drop the `EMPTY_CHECKLIST_BODY` import; the picker `it.each` becomes one `picture` case expecting `{ kind: 'files', files: [file] }`.
- `src/components/cards/NoteCard.test.tsx`: `toHaveBeenCalledWith(note.id, { autoplayFirstAudio: true })` becomes `toHaveBeenCalledWith(note.id, { kind: 'play' })`.
- `src/routes/routes.test.tsx`, `src/components/layout.test.tsx`, `src/components/nav/BackButton.test.tsx`: delete the dead `EMPTY_CHECKLIST_BODY: ''` line from each `NoteEditorDialog` mock.

Run: `pnpm vitest run src/components/notes src/components/editor/editor.test.tsx src/components/cards/NoteCard.test.tsx`
Expected: FAIL (the new types and props do not exist yet).

- [ ] **Step 3: The type and the hook**

Create `src/lib/intent.ts`:

```ts
/**
 * The one-shot half of opening a Note (CONTEXT.md "Intent"): what the Editor does as it opens,
 * beyond showing the Note. A gesture carries at most one, in React state and never in the URL
 * (ADR 0014); `useOpenNote` spends it when the open ends.
 */
export type Intent =
  | { kind: 'checklist' }
  | { kind: 'record' }
  | { kind: 'draw' }
  | { kind: 'files'; files: File[] }
  | { kind: 'play' };
```

Replace `src/hooks/useOpenNote.ts` with:

```ts
import { useCanGoBack, useNavigate, useRouter, useSearch } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import type { Intent } from '@/lib/intent.ts';
import type { NoteSearchParams } from '@/lib/note-search-params.ts';
import { mintId } from '@/lib/rows.ts';

/** The gesture behind the open Note; a draft's id is minted here, before any row exists. */
export type OpenedNote = { id: string; isDraft: boolean; intent?: Intent };

/**
 * Which note is open, kept in the URL so the platform back button closes it
 * ([ADR 0014](../../docs/adr/0014-the-open-note-lives-in-the-url.md)); how it was opened stays
 * here, in state, so a reload cannot repeat it.
 */
export function useOpenNote() {
  const { note } = useSearch({ strict: false }) as NoteSearchParams;
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [opened, setOpened] = useState<OpenedNote | null>(null);

  // A gesture lasts one open. The router is the record of the open ending, whichever way it did
  // (Done, Back, a dead id), so Forward onto the same note opens it plain.
  useEffect(
    () =>
      router.subscribe('onResolved', ({ toLocation }) => {
        if (!(toLocation.search as NoteSearchParams).note) setOpened(null);
      }),
    [router]
  );

  /**
   * Opening is navigation: it pushes, so back closes the note. `null` starts a draft, whose id is
   * minted now rather than on first save, so the URL never swaps under a typing user (ADR 0014).
   */
  const openNote = useCallback(
    (id: string | null, intent?: Intent) => {
      const target = id ?? mintId();
      setOpened({ id: target, isDraft: id === null, intent });
      void navigate({ to: '.', search: (prev: NoteSearchParams) => ({ ...prev, note: target }) });
    },
    [navigate]
  );

  const closeNote = useCallback(() => {
    // Pop the entry opening the note pushed, so the editor leaves no trace in
    // history. Replacing instead would leave two identical feed entries
    // stacked, and the user's *next* back press would appear to do nothing.
    if (canGoBack) {
      router.history.back();
      return;
    }
    // Nothing to pop: the note was opened cold, from a shared link or a reload.
    // Clearing the param in place is the only way back to the feed that does
    // not leave the app entirely.
    void navigate({
      to: '.',
      search: (prev: NoteSearchParams) => ({ ...prev, note: undefined }),
      replace: true,
    });
  }, [canGoBack, navigate, router]);

  /**
   * Drops a `note` that points at nothing, without touching history. Reachable: closing an empty
   * draft purges it, so going forward or reloading a stale tab lands on a missing note.
   */
  const dismissMissingNote = useCallback(() => {
    void navigate({
      to: '.',
      search: (prev: NoteSearchParams) => ({ ...prev, note: undefined }),
      replace: true,
    });
  }, [navigate]);

  return {
    openNoteId: note ?? null,
    // A cold load, a shared link or Forward has no gesture behind it.
    opened: opened?.id === note ? opened : null,
    openNote,
    closeNote,
    dismissMissingNote,
  };
}
```

`router.subscribe('onResolved', …)` returns the unsubscribe function and `toLocation.search` is the parsed search (compiled with `tsc` on 2026-10-03). If the cast reads awkwardly, `toLocation.search` may be typed through `NoteSearchParams` the same way `useSearch` is above.

- [ ] **Step 4: The Starts table and the picker**

Replace the types and the table in `src/components/notes/quickCaptureActions.ts` (imports: `Intent` from `@/lib/intent.ts` replaces `NoteOpenRequest` and `EMPTY_CHECKLIST_BODY`):

```ts
export type QuickCaptureAction = {
  key: QuickCaptureActionKey;
  Icon: LucideIcon;
  labelKey: string;
  /** What the Editor does as the draft opens; a picker Start's Intent is the files it chose. */
  intent?: Intent;
  picker?: StartPicker;
};

/**
 * Plain text first, media after (CLAUDE.md, Nav shell). `picture` keeps its key although it is
 * labelled "Image": stored dial orders are written in keys.
 */
export const QUICK_CAPTURE_ACTIONS: QuickCaptureAction[] = [
  { key: 'text', Icon: SquarePen, labelKey: 'notes.capture.text' },
  {
    key: 'checklist',
    Icon: ListChecks,
    labelKey: 'notes.capture.checklist',
    intent: { kind: 'checklist' },
  },
  { key: 'audio', Icon: Mic, labelKey: 'notes.capture.audio', intent: { kind: 'record' } },
  { key: 'drawing', Icon: PencilRuler, labelKey: 'notes.capture.drawing', intent: { kind: 'draw' } },
  {
    key: 'picture',
    Icon: Image,
    labelKey: 'notes.capture.picture',
    picker: { accept: ATTACHMENT_SPECS.image.accept ?? '' },
  },
  {
    key: 'camera',
    Icon: Camera,
    labelKey: 'notes.capture.camera',
    picker: { accept: ATTACHMENT_SPECS.image.accept ?? '', capture: 'environment' },
  },
];
```

`StartPicker` and `QuickCaptureActionKey` are unchanged. Replace `src/components/notes/useStartPicker.tsx` with:

```tsx
import { type ReactNode, useRef } from 'react';
import type { QuickCaptureAction } from '@/components/notes/quickCaptureActions.ts';
import type { Intent } from '@/lib/intent.ts';

/**
 * Begins a Start. A picker Start opens the OS picker synchronously inside the tap, the only moment
 * a browser lets it open (CLAUDE.md, Nav shell), and the chosen files become the Intent; any other
 * Start is handed straight on. Both capture bars use it, so a Start behaves the same in each.
 */
export function useStartPicker(onStart: (intent?: Intent) => void): {
  input: ReactNode;
  start: (action: QuickCaptureAction) => void;
} {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingRef = useRef<QuickCaptureAction | null>(null);

  const start = (action: QuickCaptureAction) => {
    if (!action.picker) {
      onStart(action.intent);
      return;
    }
    const input = inputRef.current;
    if (!input) return;
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
        if (files.length && action) onStart({ kind: 'files', files });
      }}
    />
  );

  return { input, start };
}
```

In `src/components/notes/DesktopCaptureBar.tsx`: the prop becomes `onStart: (intent?: Intent) => void` (import `Intent`, drop `NoteOpenRequest`); the text field's `onClick={() => onStart({ id: null })}` becomes `onClick={() => onStart()}`; each icon's `onClick={() => (action.picker ? picker.open(action) : onStart(action.editing))}` becomes `onClick={() => picker.start(action)}`. In `src/components/notes/QuickCaptureBar.tsx`: the same prop type, and the button's handler becomes:

```tsx
                  onClick={() => {
                    setOpen(false);
                    picker.start(action);
                  }}
```

The `data-tour` and `data-tour-toggle` attributes in both bars stay exactly where they are.

- [ ] **Step 5: The view, the dialog and the Editor**

`src/components/notes/NotesView.tsx`: delete `NoteOpenRequest`, `OpenIntent`, the `intent` state, `start` and `active`; drop the `useState`, `mintId` and `CaptureKind` imports and add `import type { Intent } from '@/lib/intent.ts';`. The body becomes:

```tsx
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const { openNoteId, opened, openNote, closeNote, dismissMissingNote } = useOpenNote();
  // A Start begins a draft, a Card opens its Note; either may carry an Intent.
  const start = (intent?: Intent) => openNote(null, intent);
```

with `<DesktopCaptureBar onStart={start} />`, `<NoteContent scope={scope} onSelect={openNote} />`, `<QuickCaptureBar onStart={start} />`, and the dialog:

```tsx
          <NoteEditorDialog
            // Stable for the life of an open, so this key cannot remount the editor mid-edit.
            key={openNoteId}
            noteId={opened?.isDraft ? null : openNoteId}
            draftId={openNoteId}
            intent={opened?.intent}
            onClose={closeNote}
            onNoteMissing={dismissMissingNote}
          />
```

`src/components/notes/NoteEditorDialog.tsx`: in the props, replace `initialBody`, `autoplayFirstAudio`, `initialCapture` and `initialFiles` with one:

```ts
  /** What the Editor does as it opens, beyond showing the Note (CONTEXT.md "Intent"). */
  intent?: Intent;
```

Import `Intent` from `@/lib/intent.ts` and `EMPTY_CHECKLIST_BODY` from `@/components/notes/noteDrafts.ts`; drop `CaptureKind`. The seed and the focus rule become:

```tsx
  const [body, setBody] = useState(
    !noteId && intent?.kind === 'checklist' ? EMPTY_CHECKLIST_BODY : ''
  );
```

```tsx
  // A checklist draft opens focused in the body so the first item is ready.
  const focusBody = !noteId && intent?.kind === 'checklist';
```

and `<Editor … intent={intent} …>` replaces the three props.

`src/components/editor/editor.tsx`: in `EditorProps`, replace `autoplayFirstAudio`, `initialCapture` and `initialFiles` with `intent?: Intent` (same doc line as the dialog's), delete the `CaptureKind` type, import `Intent`, and replace the two effects (today lines 266-313):

```tsx
  // Autoplay fires at most once per editor. The audio coordinator handles either
  // load order, since the body and the blob are independent IndexedDB reads.
  const autoplay = intent?.kind === 'play';
  const autoplayScannedRef = useRef(false);
  useEffect(() => {
    if (!editor) return;
    // A microtask keeps setContent's node-view mount out of React's render and commit
    // phase, where TipTap's flushSync throws. The autoplay scan runs after it so it
    // sees the applied doc.
    queueMicrotask(() => {
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content ?? '');
      }
      if (autoplay && !autoplayScannedRef.current) {
        let firstAudioId: string | null = null;
        editor.state.doc.descendants((node) => {
          if (firstAudioId) return false;
          if (node.type.name === 'audioAttachment') {
            firstAudioId = node.attrs.attachmentId as string;
            return false;
          }
          return true;
        });
        // Latch only on a hit: an existing note's body lands through a later
        // setContent (it mounts as ''), so an empty first pass must not block it.
        if (firstAudioId) {
          autoplayScannedRef.current = true;
          editor.storage.audioAttachment.autoplay.requestAutoplay(firstAudioId);
        }
      }
    });
  }, [content, editor, autoplay]);

  // The Intent's one-shot act. A picker Start arrives as files, because the picker can only open
  // inside the tap that chose it (`useStartPicker`); a checklist is the dialog's body seed.
  const intentStartedRef = useRef(false);
  useEffect(() => {
    if (!editor || intentStartedRef.current) return;
    if (intent?.kind !== 'record' && intent?.kind !== 'draw' && intent?.kind !== 'files') return;
    intentStartedRef.current = true;
    if (intent.kind === 'record') editor.storage.audioAttachment.capture.requestRecording();
    else if (intent.kind === 'draw') openExcalidraw({});
    else void insertFiles('image', editor, intent.files, getAttachmentDeps());
  }, [editor, getAttachmentDeps, intent, openExcalidraw]);
```

- [ ] **Step 6: The Card path**

`src/components/cards/CardMedia.tsx`: `onOpen: (intent?: Intent) => void` (doc line stays), and the audio row's `onActivate={() => onOpen({ kind: 'play' })}`. `src/components/cards/NoteCard.tsx`: `onSelect: (id: string, intent?: Intent) => void`, and `select`:

```tsx
  const select = useCallback(
    (...rest: [intent?: Intent]) => {
      openRef.current?.focus({ preventScroll: true });
      onSelect(note.id, ...rest);
    },
    [note.id, onSelect]
  );
```

(the rest tuple keeps a plain open at exactly one argument, which `NoteCard.test.tsx` pins). `src/components/NoteContent.tsx` and `src/components/notes/NoteFeed.tsx`: `onSelect: (id: string, intent?: Intent) => void`. All four import `Intent` from `@/lib/intent.ts`.

- [ ] **Step 7: Run every touched test, then the end-to-end case**

Run:
```bash
pnpm vitest run src/components/notes src/components/editor/editor.test.tsx src/components/cards src/components/NoteContent.test.tsx src/routes/routes.test.tsx src/components/layout.test.tsx src/components/nav/BackButton.test.tsx src/hooks
pnpm exec playwright test e2e/capture.spec.ts e2e/checklist.spec.ts e2e/onboarding.spec.ts
pnpm check:ci
pnpm lint
pnpm exec tsc -b --noEmit
```
Expected: all green. `grep -rn "NoteOpenRequest\|OpenIntent\|CaptureKind\|initialCapture\|initialFiles\|autoplayFirstAudio\|initialBody" src e2e` finds nothing.

- [ ] **Step 8: Commit**

Stop and ask souki to commit:

```
refactor(notes): one Intent from a Start or a Card to the Editor, spent with its open
```

---

### Task 6: `lib/format.ts`, the app's language reaches every number and date; `shortcut-keys.ts`

**Files:**
- Rename: `src/lib/format-attachment.ts` → `src/lib/format.ts`, `src/lib/format-attachment.test.ts` → `src/lib/format.test.ts` (with `git mv`, so history follows)
- Rename: `src/utils/platform.ts` → `src/lib/shortcut-keys.ts`; create `src/lib/shortcut-keys.test.ts`; `src/utils/` is deleted
- Modify: `src/lib/reminder.ts`, `src/components/editor/extensions/attachments/deps.ts`, `src/components/editor/editor.tsx`, `src/components/editor/extensions/attachments/AttachmentNotDownloaded.tsx`, `src/components/cards/CardMedia.tsx`, `src/components/editor/extensions/Audio/AudioRecorderHost.tsx`, `src/components/editor/extensions/Audio/AudioNodeView.tsx` (import path), `src/components/settings/SyncStatusSection.tsx`, `src/components/settings/MembersSection.tsx`, `src/components/settings/DevicesSection.tsx`, `src/components/settings/ShortcutsSection.tsx`, `src/components/ui/ActionButton.tsx`, `src/components/searchInput.tsx`
- Modify tests: `src/components/settings/AccountSection.test.tsx` (the `cs` case and the mock), and the `react-i18next` mocks in `src/components/editor/editor.test.tsx`, `src/components/notes/NoteEditorDialog.realEditor.test.tsx`, `src/context/SyncProvider.test.tsx`, `src/pages/settings.test.tsx`, `src/routes/routes.test.tsx`, `src/lib/tour/targets.mounted.test.tsx`

**Interfaces:**
- Produces, in `src/lib/format.ts`: `formatBytes(bytes: number | undefined, locale: string): string | null` (the attachment rules as today, the number written by `Intl.NumberFormat(locale)`, the unit tokens `B kB MB GB` unchanged), `formatDate(iso: string, locale: string, options: Intl.DateTimeFormatOptions): string`, the presets `MEDIUM_DATE` (`{ dateStyle: 'medium' }`) and `MEDIUM_DATE_TIME` (`{ dateStyle: 'medium', timeStyle: 'short' }`), and the unchanged `formatDuration`, `formatElapsed`, `formatFileType`. `AttachmentDeps` gains `locale: string`. `src/lib/shortcut-keys.ts` exports `getShortcutKey` and `getShortcutKeys` unchanged.
- The locale is `useTranslation().i18n.language` (`'en'` or `'cs'`, the precedent being `ReminderChip`), read at render so a language switch shows at once; node views get it as `deps.locale`.
- Fixed by construction (Review Focus 5): the three Settings dates follow the app language. Harmless changes: an English UI on a British or Czech browser now shows US-style English dates in Settings, as the reminder chip already does; the Settings storage line uses the attachment formatter's rounding (`1.5 kB` for 1536 bytes where it said `2 kB`, `10 MB` for 10 MiB where it said `10.5 MB`) and keeps its floor of one kilobyte.
- Not folded (ruled): `lib/deviceName.ts` asks a different question (a Device name, where an iPad is not a Mac) and stays.

- [ ] **Step 1: Rename and write the failing formatter cases**

```bash
git mv src/lib/format-attachment.ts src/lib/format.ts
git mv src/lib/format-attachment.test.ts src/lib/format.test.ts
```

In `src/lib/format.test.ts`, change the import to `./format.ts` adding `formatDate`, `MEDIUM_DATE`, `MEDIUM_DATE_TIME`, and replace the `formatBytes` describe with the two below. The `formatDuration`, `formatElapsed` and `formatFileType` describes stay:

```ts
describe('formatBytes', () => {
  it.each([
    [0, 'en', '0 B'],
    [999, 'en', '999 B'],
    [1000, 'en', '1.0 kB'],
    [1536, 'cs', '1,5 kB'],
    [248_000, 'en', '248 kB'],
    [3_400_000, 'en', '3.4 MB'],
    [3_400_000, 'cs', '3,4 MB'],
    [999_999, 'en', '1000 kB'],
    [1_500_000_000, 'cs', '1,5 GB'],
  ])('%d bytes in %s is %s', (bytes, locale, expected) => {
    expect(formatBytes(bytes, locale)).toBe(expected);
  });

  it('returns null for an unknown size', () => {
    expect(formatBytes(undefined, 'en')).toBeNull();
  });
});

describe('formatDate', () => {
  // A fixed instant at noon UTC, read in UTC: the zone of the machine running this cannot move
  // the date. Pieces, not whole strings: ICU builds differ in the spaces around AM/PM.
  const AT = '2030-03-04T12:00:00.000Z';

  it.each([
    ['en', MEDIUM_DATE, /^Mar 4, 2030$/],
    ['cs', MEDIUM_DATE, /^4\. 3\. 2030$/],
    ['en', MEDIUM_DATE_TIME, /^Mar 4, 2030, 12:00/],
    ['cs', MEDIUM_DATE_TIME, /^4\. 3\. 2030 12:00/],
  ])('writes the date in %s', (locale, options, expected) => {
    expect(formatDate(AT, locale, { ...options, timeZone: 'UTC' })).toMatch(expected);
  });

  it('reads a zone-less wall-clock string as local time, the way a Reminder is stored', () => {
    expect(formatDate('2030-03-04T09:00', 'en', { hour: 'numeric', minute: '2-digit' })).toMatch(
      /^9:00/
    );
  });
});
```

Run: `pnpm vitest run src/lib/format.test.ts`
Expected: FAIL (`formatBytes` ignores the locale; `formatDate` does not exist).

- [ ] **Step 2: Write the formatters**

In `src/lib/format.ts`, replace `formatBytes` and add `formatDate` with its presets; `clock`, `formatDuration`, `formatElapsed`, `formatFileType` and the `UNITS` comment stay:

```ts
/**
 * A byte count at the largest unit that keeps it under four digits, the number written as `locale`
 * writes numbers (`3,4 MB` for a Czech reader); the unit tokens are the same in every language.
 */
export function formatBytes(bytes: number | undefined, locale: string): string | null {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return null;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < UNITS.length - 1) {
    value /= 1000;
    unit += 1;
  }
  // Whole bytes are never fractional; above that one decimal is enough to tell
  // 1.2 MB from 1.9 MB without implying precision we do not have.
  const digits = unit === 0 ? 0 : value < 10 ? 1 : 0;
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
    useGrouping: false,
  }).format(value);
  return `${number} ${UNITS[unit]}`;
}

/** `Mar 4, 2030` in en, `4. 3. 2030` in cs. */
export const MEDIUM_DATE: Intl.DateTimeFormatOptions = { dateStyle: 'medium' };
/** The date and the time of day: `Mar 4, 2030, 9:00 AM` in en, `4. 3. 2030 9:00` in cs. */
export const MEDIUM_DATE_TIME: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

/**
 * A date in the app's language, never the browser's: the two differ as soon as Settings switches
 * language. Built per call rather than kept as a module constant, so a switch shows at once.
 * `iso` may be an instant (`…Z`) or a Reminder's zone-less wall-clock string; `Date` reads both.
 */
export function formatDate(
  iso: string,
  locale: string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(locale, options).format(new Date(iso));
}
```

Run: `pnpm vitest run src/lib/format.test.ts`
Expected: PASS (all describes).

- [ ] **Step 3: Route the reminder chip through it**

In `src/lib/reminder.ts`, import `formatDate` from `./format.ts` and make `formatReminderTime` a call to it, keeping its JSDoc about the weekday:

```ts
const REMINDER_TIME: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
};

export function formatReminderTime(remindAt: string, locale: string): string {
  return formatDate(remindAt, locale, REMINDER_TIME);
}
```

Run: `pnpm vitest run src/lib/reminder.test.ts src/components/reminders`
Expected: PASS unchanged.

- [ ] **Step 4: The attachment callers**

`src/components/editor/extensions/attachments/deps.ts`: after `t: TFunction;` add:

```ts
  /** The app's language, for `Intl` (a size next to a filename). */
  locale: string;
```

`src/components/editor/editor.tsx`: `const { t, i18n } = useTranslation();` where `t` is taken today; in the `attachmentDeps` memo add `locale: i18n.language,` beside `t` and `i18n.language` to its dependency array. `src/components/editor/extensions/attachments/AttachmentNotDownloaded.tsx`: import from `@/lib/format.ts` and `const size = formatBytes(attachment.size, deps.locale);`. `src/components/cards/CardMedia.tsx`: import from `@/lib/format.ts`; in `FileRow`, `const { t, i18n } = useTranslation();` and `const size = formatBytes(row?.size, i18n.language);`. `AudioRecorderHost.tsx` and `AudioNodeView.tsx`: only the import path changes.

Tests that build `AttachmentDeps` behind `as unknown as` casts need no change: at runtime `deps.locale` is `undefined` there and `Intl` takes that as the default locale, so `FileNodeView.test.tsx`'s `/2\.4 MB/` still holds.

- [ ] **Step 5: The Settings dates, and the `cs` case**

`src/components/settings/AccountSection.test.tsx`: give the mock a language the test can switch, and add the Review Focus case:

```tsx
const language = vi.hoisted(() => ({ current: 'en' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string>) =>
      options ? `${key} ${Object.values(options).join(' ')}` : key,
    i18n: { language: language.current },
  }),
}));
```

with `language.current = 'en';` added to the file's `afterEach`, and in the describe that lists Devices:

```tsx
  it('writes the last-seen date in the app language, not the browser's', async () => {
    language.current = 'cs';
    const server = createFakeServer();
    server.seedOwner('ada', 'correct horse');
    mount(server);
    await signIn('ada', 'correct horse');

    await screen.findByText('Laptop');

    // A Czech medium date: day and month with a dot and a space, then the year.
    expect(
      screen.getByText(/^account\.devices\.lastSeen \d{1,2}\. \d{1,2}\. \d{4}/)
    ).toBeInTheDocument();
  });
```

Run: `pnpm vitest run src/components/settings/AccountSection.test.tsx -t "app language"`
Expected: FAIL (the date is formatted by the browser default, `Jan 1, 2026, …`).

Then the three sections. `src/components/settings/DevicesSection.tsx`: delete the module-level `lastSeen` formatter; `const { t, i18n } = useTranslation();`; import `formatDate, MEDIUM_DATE_TIME` from `@/lib/format.ts`; the description becomes `date: formatDate(device.lastSeenAt, i18n.language, MEDIUM_DATE_TIME)`. `src/components/settings/MembersSection.tsx`: delete `joined`; in `MembersSection`, `const { t, i18n } = useTranslation();`; `date: formatDate(member.createdAt, i18n.language, MEDIUM_DATE)`. `src/components/settings/SyncStatusSection.tsx`: delete lines 9-18 (`when`, `unit`, `kilobytes`, `megabytes`, `size`); `const { t, i18n } = useTranslation();`; import `formatBytes, formatDate, MEDIUM_DATE_TIME` from `@/lib/format.ts`; `time: formatDate(lastSyncedAt, i18n.language, MEDIUM_DATE_TIME)`; and the storage line, computed once above the JSX:

```tsx
  // A fresh library is tens of kilobytes; "0 B used" would read as "nothing is stored".
  const used =
    storage?.usage === undefined
      ? null
      : formatBytes(Math.max(storage.usage, 1000), i18n.language);
```

```tsx
            description={
              (storage.persisted ? t('sync.storage.persisted') : t('sync.storage.notPersisted')) +
              (used ? ` ${t('sync.storage.used', { size: used })}` : '')
            }
```

Extend the `useTranslation` mocks in `src/components/editor/editor.test.tsx`, `src/components/notes/NoteEditorDialog.realEditor.test.tsx`, `src/context/SyncProvider.test.tsx`, `src/pages/settings.test.tsx`, `src/routes/routes.test.tsx` and `src/lib/tour/targets.mounted.test.tsx` with `i18n: { language: 'en' }` beside their `t`. Any other test that then fails with `Cannot read properties of undefined (reading 'language')` gets the same one-line addition; list each in the report.

- [ ] **Step 6: Move the shortcut-key table and give it the test it never had**

```bash
git mv src/utils/platform.ts src/lib/shortcut-keys.ts
rmdir src/utils
```

Update the three imports to `@/lib/shortcut-keys.ts`: `src/components/settings/ShortcutsSection.tsx`, `src/components/ui/ActionButton.tsx`, `src/components/searchInput.tsx`. The module is unchanged otherwise. Create `src/lib/shortcut-keys.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15';
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const original = navigator.userAgent;

/** The table reads `navigator` once at import, so each case loads a fresh module. */
async function load(userAgent: string) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true });
  vi.resetModules();
  return import('./shortcut-keys.ts');
}

afterEach(() => {
  Object.defineProperty(navigator, 'userAgent', { value: original, configurable: true });
});

describe('getShortcutKeys', () => {
  it.each([
    ['a Mac', MAC, ['⌘', '⌥', '⇧', 'B'], ['Command', 'Option', 'Shift', 'B']],
    ['anything else', WINDOWS, ['Ctrl', 'Alt', '⇧', 'B'], ['Control', 'Alt', 'Shift', 'B']],
  ])('spells Mod, Alt, Shift and a letter for %s', async (_name, ua, symbols, readable) => {
    const { getShortcutKeys } = await load(ua);

    const parts = getShortcutKeys(['Mod', 'Alt', 'Shift', 'B']);

    expect(parts.map((part) => part.symbol)).toEqual(symbols);
    expect(parts.map((part) => part.readable)).toEqual(readable);
  });
});
```

If jsdom refuses the `defineProperty` on `navigator`, define it on `Navigator.prototype` instead (same `configurable: true`, restore in `afterEach`); the assertions stay.

- [ ] **Step 7: Run the tests and the gates**

Run:
```bash
pnpm vitest run src/lib src/components/settings src/components/editor src/components/cards src/components/reminders src/context/SyncProvider.test.tsx src/pages/settings.test.tsx src/routes/routes.test.tsx
pnpm check:ci
pnpm lint
pnpm exec tsc -b --noEmit
```
Expected: all green. `grep -rn "Intl\." src --include=*.tsx` finds nothing (every `Intl` call sits in `src/lib`); `grep -rn "format-attachment\|@/utils" src` finds nothing; `ls src/utils` says no such directory.

- [ ] **Step 8: Commit**

Stop and ask souki to commit:

```
refactor(lib): format.ts writes bytes and dates in the app's language; shortcut-keys.ts
```

---

### Task 7: Docs follow the code, then every gate

**Files:**
- Modify: `CLAUDE.md` (root), `src/components/editor/CLAUDE.md`, `src/context/CLAUDE.md` (if it describes `AccountProvider`'s two effects or `useOpenNote`), `docs/adr/0014-the-open-note-lives-in-the-url.md` (one line), `PLAN.md` (M6 slice 4 and the Tickets list)

- [ ] **Step 1: Root `CLAUDE.md`**

In the Data layer section, the sentence `One-shot open *intents* (start the camera, autoplay the first clip) stay in React state - a reload of a URL must not re-fire them.` becomes: `The one-shot half of an open is an **Intent** (`src/lib/intent.ts`: begin recording, open the Drawing, insert the chosen files, begin as a Checklist, play the first clip), kept in React state by `useOpenNote` and spent when the open ends, so a reload, Back or Forward never repeats it.`

In the Nav shell section, replace the two sentences `Audio and drawing Starts carry a \`capture\` intent that the editor auto-runs on open.` and `Image and Camera are picker Starts: the OS picker opens inside the tap itself (\`useStartPicker.tsx\`, one hidden input both bars share), because the tap's user activation does not survive the route change to the editor, and the chosen files travel as \`initialFiles\`.` with: `Each Start carries at most one Intent (\`quickCaptureActions.ts\`). Image and Camera are picker Starts: \`useStartPicker.tsx\` opens the OS picker inside the tap itself (each bar renders its own hidden input through the hook), because the tap's user activation does not survive the route change to the editor, and the chosen files become the Intent.`

In the Backup section, after the `requestSaveTarget` sentence add: `The three export buttons (Settings, the safety copy before an import, "Save a backup" in the blocked sign-out dialog) share \`exportBackup(store, suffix)\` in \`src/lib/export-backup.ts\`, which answers \`saved\`, \`unconfirmed\` or \`cancelled\` and lets each caller choose its words.`

In the Theming section, after `Every other preference is read by the component that spends it.` add: `A Settings row that only shows and writes one Preference is a \`PreferenceSwitch\` or \`PreferenceSegmented\` bound to its key (\`settings/SettingsSection.tsx\`); the option lists it offers are the schema's own (\`DENSITY_OPTIONS\` and friends in \`PreferencesProvider.tsx\`).`

In the i18n section, after the sentence about `t()` being passed into extension button factories, add: `Numbers and dates are written in the app language through \`src/lib/format.ts\` (\`formatBytes\`, \`formatDate\`), with \`useTranslation().i18n.language\` passed in at the call; node views get it as \`deps.locale\`.`

Under Key conventions add two bullets: `- **An effect that awaits**: \`useAsyncEffect(effect, deps)\` (\`src/hooks/useAsyncEffect.ts\`) owns the cancel flag; the effect gets \`alive()\` and writes state only while it is true. Biome checks its deps array (\`biome.json\`).` and `- **A user-started remote call**: \`useAction()\` (\`src/hooks/useAction.ts\`) holds \`busy\` and toasts the outcome; \`act\` answers \`false\` to back out quietly, and \`failure\` may pick the key from the error.`

- [ ] **Step 2: `src/components/editor/CLAUDE.md`**

Replace the **Open intents** paragraph (today lines 95-97) with:

```
  **Intent** (M4 Slice 2, reshaped 2026-09-09, one value since M6 slice 4): `Editor` takes an `intent?: Intent` prop (`src/lib/intent.ts`): `record` asks the recorder to start, `draw` opens the shared Excalidraw dialog, `files` inserts what a picker Start chose (the picker opens on the feed inside the tap, `notes/useStartPicker.tsx`, because that activation does not survive the route change), `play` autoplays the first clip, and `checklist` is the dialog's body seed, which the Editor ignores.
  Audio goes through `audioCapture.ts`, a pending-then-fire coordinator in `editor.storage.audioAttachment.capture` (same shape as `audioAutoplay`) because the host and the intent mount independently. The coordinator holds a request until the take it started settles, and hands it back if the recorder answering it unregisters first - React StrictMode's mount cycle does exactly that in development, and without it the request was consumed by a take that was torn down.
  All are one-shot: `useOpenNote` spends the Intent when the open ends, so a reload, Back or Forward never re-fires it.
```

Run `grep -n "initialCapture\|initialFiles\|autoplayFirstAudio\|format-attachment\|utils/platform" CLAUDE.md src/components/editor/CLAUDE.md src/context/CLAUDE.md src/data/CLAUDE.md src/hooks/data/CLAUDE.md` and reword any remaining hit the same way; list each in the report.

- [ ] **Step 3: ADR 0014 and `src/context/CLAUDE.md`**

In `docs/adr/0014-the-open-note-lives-in-the-url.md`, after the bullet `**\`EditingState\` became \`NoteOpenRequest\`.** …`, add a bullet: `- **\`NoteOpenRequest\` became \`Intent\` (2026-10-03, M6 slice 4).** The gesture lives in \`useOpenNote\` as \`{ id, isDraft, intent }\` and is spent when the open ends, which is what makes Forward open the Note plain.`

In `src/context/CLAUDE.md`, if a passage describes `AccountProvider` asking the server twice or `useOpenNote`, reword it to name `useAsyncEffect` and the shared `apply`; otherwise leave the file.

- [ ] **Step 4: `PLAN.md`**

Mark M6 slice 4 `✅` the way slices 1 to 3 are marked and append, three-space indented:

```
   Harmless changes: the two Stop sharing buttons, Remove and "Save a backup" hold `busy` so a double tap sends one request; the Export button and the import confirm show busy from the click, the save dialog included; the Settings storage line uses the attachment formatter's rounding and keeps its one-kilobyte floor; an English UI on a British or Czech browser shows US-style English dates in Settings, as the reminder chip already did; `useLive` loses its two ESLint warnings (four pre-existing warnings remain).
   Deviations: `useAsync` became `useAsyncEffect(effect, deps)`, which owns only the cancel flag, because five sites write the same state from handlers too, and Biome (not ESLint) checks its callers' deps; `AccountProvider`'s retry effect stays a `useEffect` (its cleanup is its listeners') and shares `apply` with the first; the remote-action helper is `useAction()` and also brackets the three backup flows; the shared dialog is `components/ui/LinkDialog.tsx`; `exportBackup` lives in `lib/export-backup.ts`, not `backup.ts`, so `BackupSection.test.tsx`'s partial mock keeps seeing its calls; the Intent is spent through a router subscription in `useOpenNote`, since a `setState` in an effect body is a lint error and a reset during render would race the navigation; `format-attachment.ts` became `format.ts` with `formatDate` beside the bytes; `platform.ts` became `lib/shortcut-keys.ts` (`lib/deviceName.ts` already owns the other UA question) and gained the Mac-branch test it never had.
```

Append to the M6 **Tickets** list:

```
- `SyncStatusSection.useStorage` has no `catch`, so a rejected `navigator.storage.persisted()` is an unhandled rejection.
- `t` sits in the deps of the Devices, Members and Shares loads, so a language switch re-fetches each list.
- `LinkDialog.copy` and the clipboard: a rejected `writeText` is unhandled (the two copies it replaced were the same).
- On a browser without `showSaveFilePicker` (Firefox, Safari) the safety copy before an import is unconfirmed, yet the restore proceeds as if it were saved.
- `backupFilename` stamps UTC, not local time, and still says `ruflo-backup-`.
- The Radix empty-value guard (`(next as T) || value`) is repeated in `SortMenu` (twice) and `ToolbarLayoutEditor`.
- `index.html` keeps `lang="en"` under a Czech UI; nothing writes `document.documentElement.lang`.
- `useLive` could join `useAsyncEffect` in Biome's `useExhaustiveDependencies.options.hooks`, which would check its callers' deps too.
- `src/lib/saveTarget.test.ts` tests `requestSaveTarget` from `backup.ts`; the survey's "SaveTarget out of backup.ts" would give it a module.
```

- [ ] **Step 5: Run every gate**

Run, in order:
```bash
pnpm check:ci
pnpm lint
pnpm build
pnpm test
pnpm test:e2e
```
Expected: all green, four ESLint warnings (`LinkButton`, `themeProvider`, two in `use-mobile`; none new), no flaky retries. The e2e run matters: `e2e/capture.spec.ts` now goes Forward after a Start, `e2e/onboarding.spec.ts` drives Settings whose rows and anchors moved, and `e2e/reminder.spec.ts` reads the chip through `formatDate`.

- [ ] **Step 6: Commit**

Stop and ask souki to commit:

```
docs(ui-helpers): useAsyncEffect, useAction, LinkDialog, exportBackup, Preference rows, Intent, format.ts
```

---

## Not in this plan

- `SyncProvider`'s loop effect, `TourProvider`'s sweep (slice 6) and `CardMedia`'s poster backfill: lifecycles and loops, not loads; they keep their own flags.
- `AccountForm.submit` and `ResetPasswordButton.submit`: their failure is rendered inline through `accountErrorKey`, a different contract from a toast.
- Folding theme, view mode and the sidebar state into `PreferencesProvider` (after the user test, per PLAN.md), so the Theme row stays a `SegmentedSetting` over `useTheme`.
- A `Select` variant of the key-bound row (Language is i18next's, not a Preference field).
- Routing a non-media paste or drop to the `file` kind, and the other attachment tickets from slice 3.
- Clearing the four remaining ESLint warnings.
