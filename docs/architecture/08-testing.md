# Testing strategy

Consolidates what [ADR 0003](../adr/0003-testing-stack-vitest-and-playwright.md), the root `CLAUDE.md` methodology section, `PLAN.md` and the M5 design each hold a piece of.
Current scale: 900+ Vitest tests across ~130 files, plus Playwright E2E at two breakpoints.

## Methodology: pragmatic TDD

Red → green → refactor, applied *per layer* rather than dogmatically:

- **Test-first is mandatory** for pure logic/utilities, the Dexie data layer, hooks, and component *behavior* (interactions and contracts such as "deleting shows an undo toast"). For a user flow, the Playwright acceptance test is written before the feature.
- **Build-then-test** for purely visual layout (masonry spacing, shadows, OKLCH rendering); tests added afterward lock behavior and accessibility (roles, labels, keyboard nav), never pixels.
- Every extension, data hook, and user flow lands **with its tests in the same change**; CI gates on the full suite.

## The test pyramid, as actually built

| Level | Runner / environment | What it verifies | Examples |
|---|---|---|---|
| Pure logic | Vitest (node/jsdom) | `src/lib`: search params, backup zip round-trip, color tokens, feed rank, checklist sinking, Tour rules (dependency-free by design) | `note-search-params.test.ts`, `backup.test.ts`, `lib/tour/*` |
| Data layer | Vitest + `fake-indexeddb` | Real Dexie code paths: CRUD, cascade delete, orphan GC, and **migrations** (a throwaway-named `NotesDB` per test) | `lifecycle.migration.test.ts`, `attachments.roundtrip.test.ts` |
| Hooks | Vitest + RTL | Live queries react to mutations; mutations are idempotent and transactional | `src/hooks/data/*` |
| Component behavior | Vitest + RTL + user-event | Interactions, contracts, a11y semantics; roles and labels, not pixels | editor, cards, nav, settings tests |
| Cross-cutting gates | Vitest | Consistency no single feature owns: i18n bundles against key drift, safe-area token pairing | `i18n.test.ts`, `globals.test.ts` |
| End-to-end | Playwright (`e2e/`), `desktop` + `mobile` projects against `pnpm dev` | Real-browser flows jsdom cannot see | `onboarding.spec.ts` (the Tour) |

Vitest sees only `src/**`; Playwright's `testDir` is `e2e/`; neither runner sees the other's files.

## Environment boundaries, learned the hard way

These are recorded because each cost a debugging session:

- **jsdom measures every element as 0x0**, so anything geometric (a spotlight hole, a masonry layout) is invisible to unit tests. This is why Playwright, deferred through M1-M3, was wired exactly when the Tour needed it (M4 slice 5).
- **jsdom reads a stored Blob back as a plain object**; Blob round-trip tests must run under `// @vitest-environment node`.
- **Geometry-dependent libraries (dnd-kit keyboard drag) need stubbed `getBoundingClientRect`** in jsdom, with the spy restored after.
- **IndexedDB skips rows whose indexed property is `undefined`**, which is why the v3 migration has a dedicated test ([03-database.md](./03-database.md)).

## What is deliberately not automated

- **Visual/pixel verification is manual.** The nightshift identity is specified by `DESIGN.md` measurements, and layout is checked by eye at both breakpoints; automated pixel tests were judged brittle for their value.
- **PWA install and offline behavior** are verified manually on real devices (an emulator exposes neither a notch nor real install flows).
- **Genuine two-device sync (M5)** stays manual plus user testing: a cross-repo Playwright pipeline would cost more than it catches.

## CI

GitLab pipeline ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)): `quality` (Biome + typecheck) → `test` (Vitest, Playwright) → `build` → `publish`, with GitLab's SAST and secret-detection templates kept.
Pre-commit (husky + lint-staged) applies Biome safe fixes and blocks on the rest.

## M5 plan: testing sync without the server

The client sync engine will be tested in this repo against a **fake server built from the vendored Zod contract**, making the hard paths deterministic: conflict → Conflicted Copy, too-old-cursor full resync, offline queue drain, adopt and erase.
The contract file doubles as the drift alarm: a backend change that breaks the client fails validation in tests before it fails in production.
The backend tests itself in its own repository.

## For the paper

- The per-layer TDD split is the defensible methodological claim: strict where contracts exist (logic, data, hooks, behavior), pragmatic where they do not (visual identity).
- The environment-boundary section is honest material about the limits of jsdom-based testing that most papers gloss over.
- Metrics available for the text: test count over time (git history), the two-runner isolation, and the CI gate structure.
