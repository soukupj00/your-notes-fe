# Requirements

Functional and non-functional requirements distilled from the project brief (the thesis assignment quoted below plus the author's stack and quality constraints) and the product definition ([`PRODUCT.md`](../../PRODUCT.md)), with traceability to where each is satisfied and how it is verified.

## The brief's requirements

The thesis assignment, as issued in Czech:

> **Open-source self-hosted poznámky**
>
> Důležitost soukromí se zvyšuje rok od roku s tím, jak velké korporace využívají uživatelská data nejen pro účely strojového učení, ale především s možnost další monetizace.
> Přechod na self-hosted řešení, tak může být validním krokem.
> Analyzujte základní funkcionality aplikace Google Keep a pokuste se navrhnout vlastní open-source řešení se zaměřením na synchronizaci prostřednictvím self-hosted řešení.
>
> - Proveďte rešerši aplikace Google Keep a podobných správců poznámek.
> - Analyzujte a navrhněte řešení s ohledem na synchronizaci i off-line podporu.
> - Implementujte PWA aplikaci a serverovou část pro správu a synchronizaci poznámek.
> - Vytvořenou aplikaci otestujte s uživateli.

The brief reduces to the assignment's four mandated outcomes plus the author's stack and quality constraints:

| Id | Brief requirement | Addressed by |
|---|---|---|
| B1 | Research Google Keep and similar note managers | [10-related-work.md](./10-related-work.md) |
| B2 | Analyze and design a solution for synchronization *and* offline support | [ADR 0001](../adr/0001-local-first-storage-with-dexie.md), [ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md), [ADR 0018](../adr/0018-the-server-serves-the-pwa.md), [04-sync.md](./04-sync.md) |
| B3 | Implement a PWA application and a server part for managing and syncing notes | PWA: M0-M4 (shipped); server: M5 (shipped, [05-server.md](./05-server.md)) |
| B4 | Test the application with users | [09-evaluation.md](./09-evaluation.md), after the release |

Brief-mandated constraints: React + TypeScript + pnpm + Tailwind + shadcn/Radix + TipTap + IndexedDB + Zod; REST with HATEOAS for the server; Docker-compose setup approachable for non-programmers; local accounts syncing across devices; mobile-first responsive layout (incl. landscape and tablet); light/dark plus colour-vision themes; descriptive, recognizable icons; i18n `en`/`cs` with `en` fallback; unit tests plus Playwright, a test per small feature.
One deviation is recorded honestly: the brief suggested GSAP for animation; Motion shipped instead ([06-technology.md](./06-technology.md)).

## Functional requirements

Status: every requirement below has shipped.

| Id | Requirement | Satisfied by | Verified by |
|---|---|---|---|
| FR1 ✅ | Create, edit, autosave notes with rich text (marks, headings, lists, quotes, colors, fonts, alignment, links, code, math) | TipTap Editor, Pattern A extensions | Vitest per extension; editor behavior tests |
| FR2 ✅ | Checklists with checked-state, sinking presentation | TaskList in the Body, [ADR 0013](../adr/0013-checklist-sinking-is-presentation-not-storage.md) | `checklist.test.ts`, component tests |
| FR3 ✅ | Attach images, audio (incl. in-app recording), video, files, Excalidraw drawings | `attachments/` node core + Dexie `attachments` table | Attachment/node tests, blob round-trip test |
| FR4 ✅ | Organize: labels (create/rename/recolour/merge/delete), per-note colors, pin | Tags + NoteTags, `/labels`, palette tokens | Data-hook and page tests |
| FR5 ✅ | Lifecycle: archive, trash with undo window, purge after grace period | `state` field, sweeps ([ADR 0009](../adr/0009-note-lifecycle-model.md)) | Migration + lifecycle tests |
| FR6 ✅ | Find: fuzzy search, sort, AND label filters, shareable as URL | Fuse.js + typed search params | `note-search*.test.ts` |
| FR7 ✅ | Backup and restore the whole database as one file | `backup.ts` zip export/import | `backup.test.ts` |
| FR8 ✅ | Customize: theme, vision mode, density, reduced motion, locale, toolbar layout, quick-capture | Preferences in `localStorage` (`PreferencesProvider`) | Provider + settings tests |
| FR9 ✅ | Onboard: a Welcome at launch, a Settings Tour, replayable | `lib/tour/`, `Welcome` + `TourProvider` ([ADR 0024](../adr/0024-a-welcome-at-launch-the-tour-in-settings.md)) | `e2e/onboarding.spec.ts` (two breakpoints) |
| FR10 ✅ | Install as a PWA and work fully offline | vite-plugin-pwa, Dexie | Manual verification; offline is the default data path |
| FR11 | Local accounts: Owner on first run, Invites, private silos | [ADR 0018](../adr/0018-the-server-serves-the-pwa.md) | M5: contract tests + fake server |
| FR12 | Bidirectional sync across devices with offline queue | [ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md), [04-sync.md](./04-sync.md) | M5: deterministic engine tests |
| FR13 | Conflicts never lose text; user-resolvable Conflicted Copies | LWW + Conflicted Copy model | M5: engine tests + user testing |
| FR14 | Device management: list, revoke, sign out with erase | Server sessions per Device | M5 |
| FR15 | Reminders on a Note, one-shot or repeating, that fire whether or not the app is running | Hand-off to the user's calendar as an `.ics`; the app never notifies - [ADR 0021](../adr/0021-reminders-are-handed-off-to-the-calendar.md) | `.ics` builder unit tests; Playwright download/share acceptance; on-device check of the Hand-off |

## Non-functional requirements

| Id | Quality | Requirement | Satisfied by | Verified by |
|---|---|---|---|---|
| NFR1 | Availability (offline) | Every feature works with no network; the network is the addition | IndexedDB as source of truth; no runtime fetches | Architecture: there is no online code path to degrade |
| NFR2 | Privacy | Zero external requests at runtime: no CDN, no analytics, no remote assets | Self-hosted fonts, bundled assets | Build inspection; product constraint in `PRODUCT.md` |
| NFR3 | Usability | Keep-level approachability for a non-technical household member; capture is one-handed and interrupted | Mobile-first design, quick-capture starts, Tour | User testing ([09-evaluation.md](./09-evaluation.md)) |
| NFR4 | Accessibility | 44px touch targets, descriptive icons, focus management, reduced motion honored, colour-blind palette, keyboard nav | `.touch-target`/`.touch-reach`, icon registry, `DocumentPreferences`, Radix | Behavior/a11y assertions in component tests |
| NFR5 | Performance | Feed never loads full attachment bytes; bundle weight treated as a cost | Previews/thumbnails, pruned fonts | Thumbnail tests; build size watched manually |
| NFR6 | i18n | `en`/`cs` complete from day one, `en` fallback | i18next | `i18n.test.ts` gates bundles against key drift |
| NFR7 | Maintainability | Typed end to end; every decision recorded; each feature lands with its tests | TS strict, Zod at boundaries, 18 ADRs, pragmatic TDD | CI `quality` stage; 900+ tests |
| NFR8 | Portability (self-host) | One container, approachable for a non-programmer; backup is one file | Server serves the PWA; SQLite; Caddy modes | M5 setup docs + user testing |
| NFR9 | Security | No script-readable credentials; revocable sessions; closed registration | `HttpOnly` cookies, Invites ([05-server.md](./05-server.md)) | M5; threat model documented |
| NFR10 | Data safety | Sync never silently discards user writing; restore never destroys before validating | Conflicted Copies; `parseBackupZip` gate; save-first restore dialog | Backup tests; M5 engine tests |

## Explicit non-requirements

Recorded so the paper can show scope was chosen, not forgotten: end-to-end encryption (threat model documented instead), sharing a Note between Accounts, email/SMTP anywhere, real-time collaboration, notifications raised by the app itself (Web Push or otherwise - Reminders are handed to the calendar instead, [ADR 0021](../adr/0021-reminders-are-handed-off-to-the-calendar.md)), and hierarchical organization (labels are flat, as in Keep).

## For the paper

- The traceability tables are the chapter: brief → requirement → mechanism → verification, each row checkable against the repo.
- NFR1/NFR2 are the differentiating qualities and deserve the analysis depth; NFR3 is the one the evaluation chapter must actually measure.
- The non-requirements section preempts the "why no E2EE / no sharing" reviewer question with recorded reasoning.
