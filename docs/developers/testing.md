# Testing

Tests are written first where there is a contract to hold, and after the fact where there is only a look to get right ([ADR 0003](../adr/0003-testing-stack-vitest-and-playwright.md)).
Every extension, data hook and user flow lands with its tests in the same change.

```bash
pnpm test         # Vitest: unit, component and data tests, under src/
pnpm test:e2e     # Playwright against pnpm dev, at a desktop and a phone width, under e2e/
pnpm test:e2e:pwa # Playwright against the production build: the service worker and offline start
pnpm check        # Biome
pnpm lint         # ESLint, for the React Hooks rules
```

The first Playwright run on a machine needs `pnpm exec playwright install chromium`.
Vitest sees only `src/`, and Playwright only `e2e/`.

## What is tested where

| Level | Runner | What it checks |
|---|---|---|
| Pure logic | Vitest | `src/lib`: search, backup, colours, Feed rank, reminders, the Tour's rules |
| Local Store | Vitest with `fake-indexeddb` | One contract suite run against both implementations, plus the Dexie migrations |
| Hooks | Vitest and Testing Library | Live reads follow writes; mutations are atomic |
| Components | Vitest, Testing Library and user-event | Behaviour, roles, labels and keyboard use, never pixels |
| Cross-cutting | Vitest | The translation bundles agree; every colour is inside sRGB |
| Sync | Vitest and a fake server built from the contract | Push, pull, conflicts, resync, adopt and erase |
| End to end | Playwright | What jsdom cannot see: the Tour, capture, Checklists, Share Links |

A user flow gets its Playwright test before the feature.
Near-identical tests are one table-driven test.

## Traps

- **jsdom measures every element as 0x0.**
  Anything that depends on layout, such as the Tour's spotlight or the masonry wall, needs Playwright.
- **jsdom reads a stored Blob back as a plain object.**
  A test that round-trips a Blob runs under `// @vitest-environment node`.
- **Drag and drop with the keyboard needs `getBoundingClientRect` stubbed** in jsdom; restore the spy afterwards.
- **IndexedDB skips rows whose indexed field is `undefined`**, which is why each migration has its own test.

## What stays manual

- **How it looks.** The design is checked by eye at both widths and in both themes against `DESIGN.md`; pixel tests were judged brittle for what they catch.
- **Installing the PWA** on real phones, which an emulator cannot do faithfully.
- **Two real Devices syncing through a real server.** The engine is tested against a fake server here, and the server tests itself in its own repository.

## CI

The same pipeline runs on GitLab and on GitHub: Biome and the type check, then Vitest and Playwright, then the build and the container image ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)).
Before a commit, husky runs Biome and ESLint on the staged files; safe fixes are applied and anything else blocks the commit.
