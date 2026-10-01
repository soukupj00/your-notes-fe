# PWA offline, lost Session and Card accessibility fixes - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the frontend findings from the backend rework's end-to-end run.
A Note must open offline on a Device's very first visit, the fonts must work offline, and a Device whose Session is gone must say so and offer a sign-in.
A Share Link page must not ask for a Session, a Card must have a clean accessible name, Empty trash must ask first, and the empty Feed must point at the right control.

**Architecture:** Four of the five areas are local changes:
- the Workbox config in `vite.config.ts`;
- one router option and a shared crash screen;
- `main.tsx` composition for Share Links;
- the Card markup.

The lost-Session change is one rule: only the sync loop turns a `401` into "signed out", and `SyncProvider` flips `AccountProvider` to `signed-out`.
The service worker can only be tested against a production build, so a second Playwright config runs one spec against `vite preview`.

**Tech Stack:**
- React 19 and TanStack Router 1.170;
- vite-plugin-pwa 1.3 (Workbox `generateSW`);
- Vitest with Testing Library;
- Playwright 1.62;
- i18next (en, cs);
- Biome;
- pnpm, Node 24.

**Spec:** There is no separate spec document.
The source is the verifier's report of 2026-10-01, which is restated here in "Source findings" because its folder (`~/.claude/jobs/58dfd59b/tmp/verify/`) is temporary.

## Source findings

The verifier ran the backend rework end to end with this frontend image (`ni-dip-fe:local`), with two Chrome profiles as two Devices.
These are its frontend findings:

| Id | Finding | Plan |
|---|---|---|
| F1 | Right after pairing the page is not controlled by the service worker (`registerType: 'prompt'`, no `clientsClaim`). Opening a Note offline then shows TanStack's raw "Something went wrong! Unable to preload CSS for /assets/NoteEditorDialog-*.css". It works after one reload. | Tasks 1 and 3 |
| F2 | The precache `globPatterns` leave out `woff2`, so offline the app falls back to system fonts; the woff2 requests fail with `ERR_INTERNET_DISCONNECTED`. | Task 2 |
| F3 | A Note that references a new Attachment is pushed before its bytes are uploaded; the other Device gets `404` on `GET /api/blobs/{id}` and succeeds on a retry 2 s later. | Decision only, see "Decisions for souki" |
| F4 | When the Session is gone (an older Server Backup restored, or the Device removed), the app still shows "Signed in as owner" and "Could not sync. It will try again." with empty Devices and Members lists, and never asks to sign in. | Task 4 |
| F5 | The pair page and the Share Link page each log a `401` console error from `GET /api/session`. | Task 5 (Share Link page); the pair page is kept, see "Not in this plan" |
| F6 | Each Card is a `role="button"` whose accessible name includes its nested buttons ("Pin Stripes photo Card colour Archive Move to trash"). | Task 6 |
| - | "Empty trash" purges at once with no confirmation (verified in code: `src/routes/trash.tsx`, no dialog, no undo). | Task 7 |
| - | The empty Feed says "Tap the button to write your first one", which names no button and is wrong on desktop. | Task 8 |

## Global Constraints

- pnpm only, never npm or yarn; Node 24.
- Plain dash, never an em dash; in long Markdown one sentence per line.
- Comments are short, plain and high level: why, a decision (link the ADR) or a trap; never narrate the next line (`CLAUDE.md` hard rule).
- `DESIGN.md` is binding for any UI change, including the 44px Touch Rule.
- Every new i18n key goes into both `public/locales/en/translation.json` and `public/locales/cs/translation.json`, because `src/i18n.test.ts` gates them.
- No change to the backend or its HTTP API; `src/contract/index.ts` is vendored and is not edited.
- Files stay under 500 lines.
- Test first, as `CLAUDE.md` "Development methodology" says: write a failing Vitest or Playwright test, then the code.
- Never commit, push or switch branches without asking.
  souki makes every commit; a "Commit" step means stop and ask souki to commit, with the suggested message.
  Never add a `Co-Authored-By` trailer or name an agent as author.
- Work on a new branch from `main` (suggested `fix/pwa-offline-session-a11y`), created by souki once `chore/comment-rule` (the `CLAUDE.md` comment rule) is committed.
- Gates before handing back: `pnpm check:ci`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm test:e2e:pwa`, all green with no new warnings or flaky retries.

## Review Focus

1. A Device whose Session is lost while it still owes edits: the edits stay owed and the Local Store is not erased (test in Task 4).
2. A server that is down (`fetch` rejects) or answers `500` must not sign the Device out; only `401` does (test in Task 4).
3. The first visit must not reload itself when the service worker claims it; the update prompt still waits for the person (test and manual check in Task 1).
4. Enter on a rail control or a menu item must not open the editor, and the open button comes first in the Card's tab order (tests in Task 6).
5. A Czech Device offline needs the `latin-ext` font subsets, not only `latin` (test in Task 2).

---

### Task 1: Offline test harness, and the first visit is controlled (F1)

**Files:**
- Create: `playwright.pwa.config.ts`
- Create: `e2e/pwa/offline.spec.ts`
- Modify: `playwright.config.ts` (add `testIgnore`; update the header comment's last paragraph about the PWA path)
- Modify: `tsconfig.node.json` (`include`)
- Modify: `package.json` (`scripts`)
- Modify: `.gitignore`
- Modify: `.gitlab-ci.yml` (`test:e2e` job)
- Modify: `vite.config.ts` (the `workbox` block)
- Modify: `CLAUDE.md` (Commands block)

**Interfaces:**
- Produces: the `pnpm test:e2e:pwa` script.
  It also produces `e2e/pwa/offline.spec.ts` with a `CACHED_URLS` constant that Task 2 adds to.

- [ ] **Step 1: Add the second Playwright config**

`playwright.pwa.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * The service worker's own behaviour, against the production build. `pnpm dev`
 * serves no worker (see `playwright.config.ts`), so offline can only be tested
 * on `vite preview`. Never reuses a running server: a stale build would pass.
 * One width, because what the worker caches does not depend on it.
 */
export default defineConfig({
  testDir: './e2e/pwa',
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-pwa' }]]
    : 'list',
  use: { baseURL: BASE_URL, trace: 'on-first-retry', locale: 'en-GB' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 240_000,
  },
});
```

Make these changes in the other files:
- In `playwright.config.ts` add `testIgnore: 'pwa/**',` under `testDir`.
  Replace the header comment's sentence "What it costs is that the PWA install path is not covered here" with: the service worker is covered by `playwright.pwa.config.ts` against the production build, and the install prompt still cannot be driven headlessly.
- In `tsconfig.node.json` add `"playwright.pwa.config.ts"` to `include`.
- In `package.json` add `"test:e2e:pwa": "playwright test -c playwright.pwa.config.ts"` after `test:e2e`.
- In `.gitignore` add `/playwright-report-pwa/` under `/playwright-report/`.
- In `.gitlab-ci.yml`, in the `test:e2e` job:
  - add `- pnpm test:e2e:pwa` after `- pnpm test:e2e`;
  - add `- playwright-report-pwa/` under `artifacts.paths`.
- In `CLAUDE.md`, in the Commands block, add `pnpm test:e2e:pwa   # Playwright against the production build: service worker and offline`.

- [ ] **Step 2: Write the failing offline test**

`e2e/pwa/offline.spec.ts`:

```ts
import { expect, type Page, test } from '@playwright/test';
import { skipTour, startNote } from '../helpers.ts';

// Strings, not callbacks: `tsconfig.node.json` has no DOM lib (see `skipTour`).
const CONTROLLED = 'navigator.serviceWorker.controller !== null';

async function untilControlled(page: Page) {
  await page.waitForFunction(CONTROLLED, undefined, { timeout: 20_000 });
}

test.beforeEach(async ({ page }) => {
  await skipTour(page);
});

test('the first visit works offline, with no reload', async ({ page, context }) => {
  await page.goto('/');
  // A reload would clear this, so it proves the page that installed the worker is the one it controls.
  await page.evaluate('window.firstLoad = true');
  await untilControlled(page);

  await context.setOffline(true);
  await startNote(page, 'Note');

  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible();
  expect(await page.evaluate('window.firstLoad === true')).toBe(true);
});
```

- [ ] **Step 3: Run it and see it fail for the right reason**

Run: `pnpm test:e2e:pwa`
Expected: FAIL at `untilControlled` with a timeout of 20000ms: the first visit stays uncontrolled.
If it fails anywhere else, for example at the build or a missing button, fix the harness first.

- [ ] **Step 4: Claim the first visit**

In `vite.config.ts`, inside `workbox`, add this above `globPatterns`:

```ts
        // A first visit installs the worker but stays uncontrolled until a reload,
        // so a Device paired and then taken offline could not open a Note. Claiming
        // on activate is safe under `prompt`: an update still waits for a yes.
        clientsClaim: true,
```

- [ ] **Step 5: Run it and see it pass**

Run: `pnpm test:e2e:pwa`
Expected: PASS.

- [ ] **Step 6: Check the update prompt by hand (Review Focus 3)**

1. Run `pnpm build && pnpm preview --port 4173`.
2. Open `http://localhost:4173` with `chrome-devtools-axi`.
3. Stop preview, change any visible string in `public/locales/en/translation.json`, then build and preview again.
4. Reload once.

Expected: `PwaUpdatePrompt` offers the new version, nothing reloads until you accept, accepting reloads once into the new string, and there is no reload loop.
Revert the string afterwards.

- [ ] **Step 7: Gates and commit**

Run: `pnpm check:ci && pnpm test && pnpm test:e2e && pnpm test:e2e:pwa`
Expected: all green.
Then ask souki to commit, suggesting `fix(pwa): claim the first visit so a new Device works offline`.

---

### Task 2: The app's fonts work offline (F2)

**Files:**
- Modify: `vite.config.ts` (`workbox.globPatterns`, `workbox.runtimeCaching`)
- Test: `e2e/pwa/offline.spec.ts`

**Interfaces:**
- Consumes: the `pnpm test:e2e:pwa` harness from Task 1.

What the build holds: the two app families are 6 `woff2` files, about 166 KB in all (`latin`, `latin-ext` and `vietnamese` for each).
KaTeX adds 17 files and Excalidraw 4 more (`Assistant-*`).
Precache the two app families, and cache the rest the first time they load, so a first install does not download every math font.

- [ ] **Step 1: Write the failing test**

Append this to `e2e/pwa/offline.spec.ts`:

```ts
/** Every URL in the worker's caches. */
const CACHED_URLS = `(async () => {
  const urls = [];
  for (const name of await caches.keys()) {
    for (const request of await (await caches.open(name)).keys()) urls.push(request.url);
  }
  return urls;
})()`;

test('the app fonts are precached, Czech subsets included', async ({ page }) => {
  await page.goto('/');
  await page.evaluate('navigator.serviceWorker.ready.then(() => true)');

  const urls = (await page.evaluate(CACHED_URLS)) as string[];
  for (const font of [
    'work-sans-latin-wght-normal',
    'work-sans-latin-ext-wght-normal',
    'bricolage-grotesque-latin-wght-normal',
    'bricolage-grotesque-latin-ext-wght-normal',
  ]) {
    expect(urls.some((url) => url.includes(font) && url.endsWith('.woff2')), font).toBe(true);
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test:e2e:pwa`
Expected: FAIL on `work-sans-latin-wght-normal`, because no font is precached.

- [ ] **Step 3: Precache the app fonts and runtime-cache the rest**

In `vite.config.ts`, replace the `globPatterns` line and its comment with:

```ts
        // Default globPatterns omit .json, which would leave the i18n locale files
        // (dist/locales/<lng>/translation.json) uncached and break translations offline.
        // The two app font families are precached; KaTeX's and Excalidraw's fonts are
        // many and rarely needed, so they are cached the first time they load.
        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,json}',
          '**/{bricolage-grotesque,work-sans}-*.woff2',
        ],
        runtimeCaching: [
          {
            // Hashed file names never change content, so cache-first is exact.
            urlPattern: ({ request, sameOrigin }) => sameOrigin && request.destination === 'font',
            handler: 'CacheFirst',
            options: { cacheName: 'fonts', expiration: { maxEntries: 60 } },
          },
        ],
```

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm test:e2e:pwa`
Expected: PASS, both tests.

- [ ] **Step 5: Look at it offline**

On `pnpm build && pnpm preview --port 4173`, with `chrome-devtools-axi`:
1. Load the Feed, create a Note with a math formula, and wait for the worker.
2. Go offline and reload.
3. Take a screenshot of the Feed and the open Note.

Expected: the titles render in Bricolage Grotesque and the body in Work Sans, exactly as online, and the formula renders in KaTeX's fonts.
Compare against an online screenshot at the same size; any difference is a bug.

- [ ] **Step 6: Gates and commit**

Run: `pnpm check:ci && pnpm test:e2e:pwa`
Expected: green.
Then ask souki to commit, suggesting `fix(pwa): keep the app fonts offline`.

---

### Task 3: A route that fails to load shows the app's crash screen (F1, safety net)

A chunk can still fail to load, for example offline before the first install finished, or in a tab left open across a deploy.
TanStack Router then renders its unstyled default ("Something went wrong!") instead of the app's own recoverable screen.

**Files:**
- Create: `src/components/CrashScreen.tsx`
- Create: `src/components/CrashScreen.test.tsx`
- Modify: `src/components/ErrorBoundary.tsx` (render `CrashScreen`; drop `withTranslation`)
- Modify: `src/components/ErrorBoundary.test.tsx` (the `react-i18next` mock)
- Modify: `src/App.tsx:18` (`createRouter`)
- Modify: `src/test/renderRoute.tsx` (`createRouter`)

**Interfaces:**
- Produces: `CrashScreen({ error }: { error: Error })` and `RouteError(props: ErrorComponentProps)`, both exported from `src/components/CrashScreen.tsx`.

- [ ] **Step 1: Write the failing test**

`src/components/CrashScreen.test.tsx`:

```tsx
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteError } from './CrashScreen.tsx';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

beforeEach(() => {
  // React and the router log the caught error themselves.
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('RouteError', () => {
  it("replaces a route that failed to load with the app's crash screen", async () => {
    const root = createRootRoute();
    const broken = createRoute({
      getParentRoute: () => root,
      path: '/',
      component: () => {
        throw new Error('Unable to preload CSS for /assets/NoteEditorDialog.css');
      },
    });
    const router = createRouter({
      routeTree: root.addChildren([broken]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      defaultErrorComponent: RouteError,
    });
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('errors.crash.title')).toBeInTheDocument();
    expect(screen.getByText(/Unable to preload CSS/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'errors.crash.reload' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm vitest run src/components/CrashScreen.test.tsx`
Expected: FAIL, because `./CrashScreen.tsx` does not exist.

- [ ] **Step 3: Write `CrashScreen` and `RouteError`**

`src/components/CrashScreen.tsx`:

```tsx
import type { ErrorComponentProps } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';

/**
 * What a crash leaves on screen. An installed PWA has no address bar to retype,
 * so it always offers a reload; Notes are safe in the Local Store, which is what
 * makes the reload cheap.
 */
export function CrashScreen({ error }: { error: Error }) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <h1 className="font-semibold text-xl">{t('errors.crash.title')}</h1>
      <p className="max-w-sm text-muted-foreground text-sm">{t('errors.crash.description')}</p>
      {/* The message helps a bug report, so it is shown; the stack never is. */}
      <p className="max-w-sm break-words font-mono text-muted-foreground text-xs">
        {error.message}
      </p>
      <Button onClick={() => window.location.reload()}>{t('errors.crash.reload')}</Button>
    </div>
  );
}

/** The router's fallback, so a route that throws (a chunk that failed to load) is not TanStack's unstyled default. */
export function RouteError({ error }: ErrorComponentProps) {
  return <CrashScreen error={error} />;
}
```

- [ ] **Step 4: Use it in the boundary and the routers**

In `src/components/ErrorBoundary.tsx`:
- import `CrashScreen`;
- make the class `class ErrorBoundary extends Component<{ children: ReactNode }, State>`;
- replace the fallback JSX with `return <CrashScreen error={error} />;`;
- drop `withTranslation` and the `Button` import.

Export the class as both `ErrorBoundary` and the default, as now.
Keep the doc comment's "why", and drop the sentence about `withTranslation`.

In `src/components/ErrorBoundary.test.tsx`, replace the `vi.mock('react-i18next', ...)` block with:

```tsx
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
```

In `src/App.tsx`:

```tsx
const router = createRouter({ routeTree, defaultErrorComponent: RouteError });
```

In `src/test/renderRoute.tsx`, add `defaultErrorComponent: RouteError` to `createRouter`, so route tests see the same fallback as the app.

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run src/components/CrashScreen.test.tsx src/components/ErrorBoundary.test.tsx src/routes/routes.test.tsx`
Expected: PASS.

- [ ] **Step 6: Look at it**

On `pnpm dev`, temporarily throw in `src/routes/archive.tsx`'s component, open `/archive` at both breakpoints, take screenshots, then revert.
Expected: the crash screen renders inside the shell's content area, themed, centred, with no page scrollbar caused by `min-h-dvh`.
If the shell makes it scroll, give `CrashScreen` a `className` prop, pass `min-h-[60dvh]` from `RouteError`, and keep `min-h-dvh` for the boundary.

- [ ] **Step 7: Gates and commit**

Run: `pnpm check:ci && pnpm test`
Expected: green.
Then ask souki to commit, suggesting `fix(app): show the crash screen when a route fails to load`.

---

### Task 4: A lost Session signs the Device out and says so (F4)

The rule: only the sync loop turns a `401` into "signed out".
It runs at start and on every hint, so it notices within seconds.
A `401` from a sign-in form is a wrong password, and stays that form's business.
Nothing is erased: what this Device owes stays owed, and it goes up after the next sign-in to the same Account (`adopt` keeps the cursor for the same `accountId`).

**Files:**
- Modify: `src/sync/loop.ts` (`startSyncLoop` options and its `catch`)
- Modify: `src/sync/loop.test.ts` (the `device()` helper and one new test)
- Modify: `src/context/SyncProvider.tsx`
- Modify: `src/context/SyncProvider.test.tsx` (one new test)
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json` (`sync.signedOut`)
- Modify: `src/context/CLAUDE.md` (the `AccountProvider` and `SyncProvider` bullets)

**Interfaces:**
- Produces: `startSyncLoop({ ..., onSignedOut?: () => void })`.
  It is called once when a run answers `401`, after which the loop does nothing until `stop()`.

- [ ] **Step 1: Write the failing loop test**

In `src/sync/loop.test.ts`, inside `device()`:
- add `let signedOut = 0;` before `startSyncLoop`;
- pass `onSignedOut: () => { signedOut += 1; },`;
- return `signedOut: () => signedOut` alongside the rest.

Then add these tests:

```ts
  it('stops, and says so once, when the server no longer knows the Session', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id, 30);
    // What "Remove" in another Device's Settings does to this one.
    server.devices.splice(
      server.devices.findIndex((d) => d.name === 'Phone'),
      1
    );

    await a.loop.syncNow();
    expect(a.signedOut()).toBe(1);
    const after = a.runs();
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(a.runs()).toBe(after);
    expect(a.signedOut()).toBe(1);
  });

  it('an unreachable or broken server never signs the Device out', async () => {
    const server = createFakeServer();
    const owner = server.seedOwner('ada', 'correct horse');
    const a = await device(server, owner.id);

    server.state.offline = true;
    await a.loop.syncNow();
    server.state.offline = false;
    server.state.staticHost = true;
    await a.loop.syncNow();
    expect(a.signedOut()).toBe(0);
  });
```

- [ ] **Step 2: Run them and see the first fail**

Run: `pnpm vitest run src/sync/loop.test.ts`
Expected: the first new test FAILS with `expected 0 to be 1`; the second passes already, and it guards the change.

- [ ] **Step 3: Teach the loop**

In `src/sync/loop.ts`:
- import `ProblemError` from `@/data/http/hal.ts`; `Remote.ts` already documents it as the error type;
- add the option to the parameter type, under `onReport`:

```ts
  /** The server no longer knows this Device's Session (removed, or an older backup restored). */
  onSignedOut?: () => void;
```

Then destructure `onSignedOut` with the others, and make the `catch` in `syncNow`:

```ts
    } catch (error) {
      if (error instanceof ProblemError && error.status === 401) {
        // Retrying cannot help, only signing in again can.
        stopped = true;
        onSignedOut?.();
        return;
      }
      // `fetch` rejects with a TypeError when nothing answered at all.
      status = error instanceof TypeError ? 'offline' : 'error';
    } finally {
```

Update the doc comment of `startSyncLoop` with one clause: a `401` stops it and calls `onSignedOut`.

- [ ] **Step 4: Run the loop tests**

Run: `pnpm vitest run src/sync/loop.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing provider test**

In `src/context/SyncProvider.test.tsx`, add:

```tsx
  it('signs this Device out when the server forgets its Session, and keeps what it owes', async () => {
    const { server } = await mountSignedIn();
    expect(await screen.findByText(/^sync\.idle /)).toBeVisible();
    server.devices.splice(
      server.devices.findIndex((d) => d.name === 'Phone'),
      1
    );
    const id = crypto.randomUUID();
    await testStore.notes.add({ id, state: 'active', createdAt: T0, updatedAt: T0 });

    await pressSyncNow();

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('sync.signedOut', expect.objectContaining({}))
    );
    expect(screen.queryByText('sync.label')).not.toBeInTheDocument();
    expect(await testStore.notes.get(id)).toBeDefined();
    expect((await testStore.sync.dirty()).notes.map((n) => n.id)).toContain(id);
  });
```

Run: `pnpm vitest run src/context/SyncProvider.test.tsx`
Expected: FAIL; the toast is never called.

- [ ] **Step 6: Wire it in `SyncProvider`**

In `src/context/SyncProvider.tsx`:
- take `setSession` from `useAccount()`;
- keep the handler in a ref, like `onReport`, so a language change does not restart the loop:

```tsx
  const onSignedOutRef = useRef<() => void>(() => {});
  const onSignedOut = () => {
    setSession(null);
    toast(t('sync.signedOut'), {
      action: {
        label: t('account.section.signIn'),
        onClick: () => void navigate({ to: '/settings' }),
      },
    });
  };
  useEffect(() => {
    onReportRef.current = onReport;
    onSignedOutRef.current = onSignedOut;
  });
```

That replaces the existing effect that only sets `onReportRef`.
Then pass `onSignedOut: () => onSignedOutRef.current(),` to `startSyncLoop`.
`setSession(null)` turns `accountId` undefined, so the existing effect cleanup stops the loop and closes the hint stream.
The Account section then shows "Sign in to your server", and the Devices and Members sections hide.

Add the copy.
In `en`, under `sync`: `"signedOut": "This Device is no longer signed in. Sign in again to sync; your changes wait here."`
In `cs`, under `sync`: `"signedOut": "Toto zařízení už není přihlášené. Přihlaste se znovu a synchronizace bude pokračovat; změny zůstávají tady."`

- [ ] **Step 7: Run the tests**

Run: `pnpm vitest run src/context/SyncProvider.test.tsx src/sync/loop.test.ts src/i18n.test.ts`
Expected: PASS.

- [ ] **Step 8: Update the context docs**

In `src/context/CLAUDE.md`:
- `AccountProvider`: replace "A signed-in Device is not re-asked." with "A signed-in Device is not re-asked; if the server forgets its Session, `SyncProvider` sets it signed out."
- `SyncProvider`: add a bullet saying that a `401` from a run stops the loop and calls `setSession(null)` with one toast linking to Settings, and that nothing is erased: owed rows wait for the next sign-in.

- [ ] **Step 9: Gates and commit**

Run: `pnpm check:ci && pnpm test`
Expected: green.
Then ask souki to commit, suggesting `fix(sync): a lost Session signs the Device out instead of retrying forever`.

---

### Task 5: A Share Link page never asks for a Session (F5)

**Files:**
- Modify: `src/main.tsx`
- Create: `e2e/share.spec.ts`

- [ ] **Step 1: Write the failing test**

`e2e/share.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('a Share Link page never asks the server who is signed in', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname === '/api' || pathname === '/api/session') asked.push(pathname);
  });
  await page.route('**/api/public/shares/**', (route) => route.fulfill({ status: 404 }));

  await page.goto('/share/no-such-token');

  await expect(page.getByText('Nothing is shared here')).toBeVisible();
  expect(asked).toEqual([]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm test:e2e e2e/share.spec.ts`
Expected: FAIL with `asked` equal to `['/api']`, from `AccountProvider`'s startup question.

- [ ] **Step 3: Give the Share Link page no Account**

In `src/main.tsx`:

```tsx
// A Share Link's page (`/share/<token>`) is opened by strangers: it writes nothing to
// their Local Store and has no Account, so it never opens IndexedDB or asks for a Session.
const shared = isSharePath(window.location.pathname);
const store = shared ? createMemoryLocalStore() : createDexieLocalStore();
// The server that serves the PWA is the server (ADR 0018); where none answers,
// `AccountProvider` says so and the app runs local-only.
const hal = createHalClient();
const accountService = shared ? null : createHalAccountService(hal);
const remote = shared ? null : createHalRemote(hal);
```

This replaces the existing `store` lines and their comment.

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm test:e2e e2e/share.spec.ts`
Expected: PASS at both widths.

- [ ] **Step 5: Gates and commit**

Run: `pnpm check:ci && pnpm build`
Expected: green.
Then ask souki to commit, suggesting `fix(share): a Share Link page asks for no Session`.

---

### Task 6: A Card's accessible name is its title (F6)

Today the whole Card is `role="button"`, so its name is computed from everything inside it, including the pin and rail buttons, and those nested controls inside a button are invalid ARIA.
The fix keeps every pointer behaviour as it is: a click anywhere still opens the Note, and checklist taps and long-press are unchanged.
Only keyboard and assistive technology move to a real `<button>`: visually hidden, first in the Card, and named by the title.
The focus ring stays on the whole Card through `has-[...]`.

Considered: a heading-button that wraps the visible title.
That is better for a screen reader (no title read twice), but it changes the title's layout and its `line-clamp-3`, and the zero-pixel change was preferred.

**Files:**
- Modify: `src/components/cards/NoteCard.tsx:170-245` (the root `Card` and the title)
- Modify: `src/components/cards/NoteCard.test.tsx` (selectors and two new tests)
- Modify: `src/components/cards/CardPin.tsx:39`, `src/components/color-picker/NoteColorButton.tsx:31` (comments that say the card is a `role="button"`)
- Modify: `e2e/helpers.ts` (new `card()` helper)
- Modify: `e2e/checklist.spec.ts:19,64,79`

**Interfaces:**
- Produces: `card(page: Page, title: string): Locator` in `e2e/helpers.ts`, and the `data-slot="note-card-open"` button.

- [ ] **Step 1: Write the failing tests**

In `src/components/cards/NoteCard.test.tsx`, replace every `closest('[role="button"]')` with `closest('[data-slot="card"]')`.
Replace the test "opens the editor when the card itself is keyboard-activated" with:

```tsx
  it("opens the editor from the keyboard through the title's button", async () => {
    const note = makeNote();
    const onSelect = vi.fn();
    render(<NoteCard note={note} onSelect={onSelect} />);

    screen.getByRole('button', { name: 'My note' }).focus();
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith(note.id);
  });

  it("names the open button by the title alone, never by the rail's controls", () => {
    render(<NoteCard note={makeNote()} onSelect={vi.fn()} />);

    const open = screen.getByRole('button', { name: 'My note' });
    expect(open).toHaveAttribute('data-slot', 'note-card-open');
    expect(screen.queryByRole('button', { name: /My note.+notes\./ })).not.toBeInTheDocument();
  });

  it('puts the open button first in the tab order, and names an untitled one', async () => {
    render(<NoteCard note={makeNote({ header: '' })} onSelect={vi.fn()} />);

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'notes.editNoteTitle' })).toHaveFocus();
  });
```

Keep "does not open the editor when a rail control is keyboard-activated" as it is (Review Focus 4).

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run src/components/cards/NoteCard.test.tsx`
Expected: the three tests FAIL, because no button is named exactly "My note" and the Card has no `data-slot="note-card-open"`.
The selector changes may fail too, if `[data-slot="card"]` is not the root; it is, per `src/components/ui/card.tsx`.

- [ ] **Step 3: Move the semantics to a real button**

In `src/components/cards/NoteCard.tsx`:
- add `useId` to the React import, and `const titleId = useId();` beside `open`;
- on `<Card>`, remove `role="button"`, `tabIndex={0}` and the whole `onKeyDown`;
- keep `onClick={open}`, and replace the comment above it with:

```tsx
      // A click anywhere opens the note. Keyboards and screen readers use the open
      // button below instead, so the card is not one button whose name swallows the
      // rail's controls (controls nested in a button are invalid).
```

- in the Card's `className`, replace `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background` with `has-[[data-slot=note-card-open]:focus-visible]:ring-2 has-[[data-slot=note-card-open]:focus-visible]:ring-ring has-[[data-slot=note-card-open]:focus-visible]:ring-offset-2 has-[[data-slot=note-card-open]:focus-visible]:ring-offset-background`;
- add the button as the Card's first child, before the surface `div`:

```tsx
      {/* Its click bubbles to the Card's `onClick`, so it needs no handler of its own. */}
      <button
        type="button"
        data-slot="note-card-open"
        className="sr-only"
        aria-labelledby={note.header ? titleId : undefined}
      >
        {note.header ? null : t('notes.editNoteTitle')}
      </button>
```

- give the `<h2>` `id={titleId}`, and delete the `<span className="sr-only">{t('notes.editNoteTitle')}</span>` branch: render the `<h2>` only when `note.header` is set (`{note.header && (<h2 ...>)}`).

In `CardPin.tsx` and `NoteColorButton.tsx`, change "The card is a role=\"button\" that opens the editor" to "A click on the card opens the editor".
The `stopPropagation` they explain is still needed.

- [ ] **Step 4: Run the unit tests**

Run: `pnpm vitest run src/components/cards/`
Expected: PASS.

- [ ] **Step 5: Fix the e2e selectors**

Add to `e2e/helpers.ts`:

```ts
/** A Card on the wall, found by its title. */
export function card(page: Page, title: string) {
  return page.locator('[data-slot="card"]', {
    has: page.getByRole('heading', { name: title }),
  });
}
```

Make these changes in `e2e/checklist.spec.ts`:
- replace `page.getByRole('button', { name: /Shopping/ })` with `card(page, 'Shopping')`;
- replace `page.getByRole('button', { name: /Order/ })` with `card(page, 'Order')`;
- replace `page.getByRole('button', { name: /Held/ })` with `card(page, 'Held')`;
- import `card` from `./helpers.ts`.

Run: `pnpm test:e2e`
Expected: PASS at both widths.
The Tour (`e2e/onboarding.spec.ts`) has to pass too, since it spotlights Cards.

- [ ] **Step 6: Look at it**

On `pnpm dev`, with `chrome-devtools-axi` at both breakpoints:
1. Tab onto a Card: the ring must look exactly as before (2px ring, offset, rounded) around the whole Card.
2. Tab again: focus moves to the pin, then the rail, with no ring on the Card.
3. Take an accessibility snapshot: each Card shows one button named by its title, then its controls.
4. Click, checklist tap and long-press still work.

- [ ] **Step 7: Gates and commit**

Run: `pnpm check:ci && pnpm test && pnpm test:e2e`
Expected: green.
Then ask souki to commit, suggesting `fix(a11y): a Card's open button is named by its title`.

---

### Task 7: Empty trash asks first

Emptying the trash purges for good, and on a synced Device the Tombstones remove the Notes from every Device.
The toast after it has no undo, so the action asks first, with the app's one confirm dialog.

**Files:**
- Modify: `src/routes/trash.tsx` (`EmptyTrashButton`)
- Modify: `src/routes/routes.test.tsx` ("trash view")
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json` (`notes.confirmEmptyTrash`)

- [ ] **Step 1: Write the failing tests**

In `src/routes/routes.test.tsx`, in "empties the trash without touching the other views", add this right after the click on `notes.emptyTrash`:

```tsx
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmEmptyTrash.confirm' })
    );
```

Add to the same `describe`:

```tsx
  it('asks first, and cancelling keeps the trash', async () => {
    await seed();
    renderAt('/trash');

    await waitFor(() => expect(screen.getAllByTestId('note-card')).toHaveLength(1));
    await userEvent.click(screen.getByRole('button', { name: 'notes.emptyTrash' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'notes.confirmEmptyTrash.cancel' })
    );

    expect(await testStore.notes.get('n-trashed')).toBeTruthy();
  });
```

Run: `pnpm vitest run src/routes/routes.test.tsx -t "trash view"`
Expected: both FAIL, because no confirm button appears.

- [ ] **Step 2: Wrap the button in `ConfirmDialog`**

In `src/routes/trash.tsx`, import `ConfirmDialog` from `@/components/ui/ConfirmDialog.tsx` and make `EmptyTrashButton` render:

```tsx
  const [confirming, setConfirming] = useState(false);
  // ... handleEmpty unchanged ...
  return (
    <ConfirmDialog
      open={confirming}
      onOpenChange={setConfirming}
      title={t('notes.confirmEmptyTrash.title')}
      description={t('notes.confirmEmptyTrash.description')}
      confirmLabel={t('notes.confirmEmptyTrash.confirm')}
      cancelLabel={t('notes.confirmEmptyTrash.cancel')}
      onConfirm={() => void handleEmpty()}
    >
      <Button variant="ghost" size="sm" className="gap-1" disabled={purging}>
        {purging && <Spinner />}
        {purging ? t('notes.emptyingTrash') : t('notes.emptyTrash')}
      </Button>
    </ConfirmDialog>
  );
```

Add the copy under `notes`.
In `en`:

```json
    "confirmEmptyTrash": {
      "title": "Empty the trash?",
      "description": "Every note in the trash is deleted for good. This cannot be undone.",
      "confirm": "Empty trash",
      "cancel": "Cancel"
    },
```

In `cs`:

```json
    "confirmEmptyTrash": {
      "title": "Vysypat koš?",
      "description": "Všechny poznámky v koši se nadobro smažou. Tuto akci nelze vrátit.",
      "confirm": "Vysypat koš",
      "cancel": "Zrušit"
    },
```

- [ ] **Step 3: Run the tests**

Run: `pnpm vitest run src/routes/routes.test.tsx src/i18n.test.ts`
Expected: PASS.

- [ ] **Step 4: Look at it**

Open `/trash` with one trashed Note at both breakpoints and press Empty trash.
Take a screenshot of the dialog in light and dark.
Expected: the dialog matches the label-delete dialog in `/labels`, with the destructive button styled destructive and the Czech labels fitting on one line.

- [ ] **Step 5: Gates and commit**

Run: `pnpm check:ci && pnpm test`
Expected: green.
Then ask souki to commit, suggesting `fix(trash): ask before emptying the trash`.

---

### Task 8: The empty Feed points at the control this width shows

The capture surface is decided by width (ADR 0016): the ＋ dial below `sm:` and the "Take a note…" bar above it.
The copy names whichever one is on screen, without "tap" or "click", which are pointer words.

**Files:**
- Modify: `src/components/NoteContent.tsx:52-57`
- Modify: `src/components/NoteContent.test.tsx` ("NoteContent empty states")
- Modify: `public/locales/en/translation.json`, `public/locales/cs/translation.json` (`notes.empty.active`)

- [ ] **Step 1: Write the failing test**

Add to "NoteContent empty states":

```tsx
  it('points an empty Feed at the capture surface this width shows', () => {
    render(<NoteContent scope={{ state: 'active' }} onSelect={vi.fn()} />);

    expect(screen.getByText('notes.empty.active.subtitle')).toHaveClass('sm:hidden');
    expect(screen.getByText('notes.empty.active.subtitleWide')).toHaveClass('hidden', 'sm:block');
  });
```

Run: `pnpm vitest run src/components/NoteContent.test.tsx`
Expected: FAIL, because there is no `subtitleWide`.

- [ ] **Step 2: Render both, one per width**

In `src/components/NoteContent.tsx`, replace the subtitle `<p>` with:

```tsx
        {key === 'active' ? (
          // The capture surface depends on width (ADR 0016): the dial below `sm:`, the bar above.
          <>
            <p className="max-w-xs text-sm sm:hidden">{t('notes.empty.active.subtitle')}</p>
            <p className="hidden max-w-xs text-sm sm:block">
              {t('notes.empty.active.subtitleWide')}
            </p>
          </>
        ) : (
          <p className="max-w-xs text-sm">{t(`notes.empty.${key}.subtitle`)}</p>
        )}
```

Change the copy in `notes.empty.active`.
In `en`:
- `"subtitle": "Your notes will show up here. Use the ＋ button to write your first one."`
- `"subtitleWide": "Your notes will show up here. Write your first one in “Take a note…” above."`

In `cs`:
- `"subtitle": "Vaše poznámky se objeví tady. První napíšete tlačítkem ＋."`
- `"subtitleWide": "Vaše poznámky se objeví tady. První napíšete v poli „Napsat poznámku…“ výše."`

- [ ] **Step 3: Run the tests**

Run: `pnpm vitest run src/components/NoteContent.test.tsx src/i18n.test.ts`
Expected: PASS.

- [ ] **Step 4: Look at it**

Open an empty Feed (a fresh profile with the Tour skipped) at both breakpoints, in both languages.
Expected: exactly one subtitle shows, it names the control on screen, and it wraps inside `max-w-xs` without a widow on the Czech line.

- [ ] **Step 5: Gates and commit**

Run: `pnpm check:ci && pnpm test`
Expected: green.
Then ask souki to commit, suggesting `fix(feed): the empty Feed names the control on screen`.

---

### Task 9: End to end with a real server, as a person would

**Files:**
- Modify: `PLAN.md` (one line under M5)

- [ ] **Step 1: Reproduce every finding on the fixed build**

Run the backend (`../ni-dip-be`, `pnpm dev`, with an explicit temporary `DATA_DIR`; never `./data`) and this app's `pnpm build && pnpm preview`, which proxies `/api` to it.
The Pairing Link the backend prints points at port 3000, so open its `/pair#<code>` on port 4173 instead.
With `chrome-devtools-axi`, use two fresh profiles as Device A and Device B:
1. **F1:** pair B from A's "Add a Device" link, go offline at once on B, and open a Note.
   Expected: the editor opens, with no crash and no reload needed.
2. **F2:** offline on B, compare the Feed and an open Note against online screenshots.
   Expected: identical fonts.
3. **F4:** remove B from A's Settings, Devices, then edit a Note on B.
   Expected: within one run B shows the signed-out toast, Settings shows "Sign in to your server", and the edit stays on B.
   Sign in again on B as the same Account.
   Expected: the edit reaches A, with no full resync (B's pull continues from its cursor).
4. **F5:** open a Share Link in a third, signed-out profile.
   Expected: the console has no `401` and no request to `/api/session`.
5. **F6:** take an accessibility snapshot of the Feed.
   Expected: each Card has one button named by its title.
6. **Empty trash and empty Feed:** check the dialog and the copy at both widths.

Save the screenshots outside the repo and list anything that looks off, even if unrelated.
Fix it in this branch or list it for souki.

- [ ] **Step 2: Record it**

In `PLAN.md`, under M5, add: `- [x] Fixes from the backend rework's end-to-end run (2026-10-01): docs/superpowers/plans/2026-10-01-pwa-offline-session-a11y-fixes.md`.

- [ ] **Step 3: Final gates and commit**

Run: `pnpm check:ci && pnpm build && pnpm test && pnpm test:e2e && pnpm test:e2e:pwa`
Expected: all green, no retries.
Then ask souki to commit, suggesting `docs(plan): record the post-verification fixes`.

---

## Decisions for souki

- **F3, a Note pushed before its Attachment bytes:** keep as built, recommended.
  `docs/architecture/04-sync.md` "Attachment transfer" decides "Bytes last, so they never delay a run's rows" and "uploads run after a run's pull ... only for Notes the server knows".
  The receiving Device already shows the "known but not downloaded" placeholder and retries on the loop's back-off, so the image appears about 2 s later.
  The alternative is to upload Previews before the push, so the other Device's Feed is right on the first pull.
  That reverses the decision, delays the push by the Preview uploads, and needs the Tour's Props kept out of the uploads too.
  Choose it only if user testing shows the delay bothers people.
- **Signing in as a different Account after a lost Session:** the existing adopt rule then uploads this Device's Notes into the new Account (`04-sync.md` "Adopt on first sign-in").
  It is unchanged here and worth a look before the user test.

## Not in this plan

- **The pair page's `401` from `GET /api/session` (F5, second half):** `AccountProvider` asks once at startup on every app page, and a new Device on `/pair` is expected to be signed out, so `401` is the API's correct answer and Chrome logs every 4xx.
  Removing it would mean a special case in `AccountProvider` or an API change; neither is worth a console line.
- **The Card focus ring through `has-[...]`** needs a browser with `:has()`, which every browser the app supports has had since 2023.
