# Strategie testování

Shrnuje to, co po částech drží [ADR 0003](../adr/0003-testing-stack-vitest-and-playwright.md), metodická sekce kořenového `CLAUDE.md` a `PLAN.md`.
Aktuální rozsah: přes 1 300 testů Vitest v přibližně 165 souborech plus E2E v Playwrightu ve dvou breakpointech.

## Metodika: pragmatické TDD

Red → green → refactor, uplatňované *po vrstvách*, ne dogmaticky:

- **Test předem je povinný** pro čistou logiku a utility, datovou vrstvu Dexie, hooky a *chování* komponent (interakce a kontrakty jako „smazání zobrazí toast s možností vrátit zpět“). U uživatelského toku se akceptační test v Playwrightu píše před funkcí.
- **Nejdřív postavit, pak testovat** u čistě vizuálního rozvržení (rozestupy masonry, stíny, vykreslení OKLCH); testy přidané dodatečně zamykají chování a přístupnost (role, popisky, ovládání klávesnicí), nikdy pixely.
- Každé rozšíření, datový hook a uživatelský tok přichází **se svými testy ve stejné změně**; CI podmiňuje průchod celou sadou.

## Testovací pyramida, jak byla skutečně postavena

| Úroveň | Runner / prostředí | Co ověřuje | Příklady |
|---|---|---|---|
| Čistá logika | Vitest (node/jsdom) | `src/lib`: parametry vyhledávání, záloha do zipu tam a zpět, tokeny barev, pořadí v přehledu, propadání v seznamu úkolů, pravidla průvodce (záměrně bez závislostí) | `note-search-params.test.ts`, `backup.test.ts`, `lib/tour/*` |
| Datová vrstva | Vitest + `fake-indexeddb` | Jedna kontraktová sada spouštěná proti oběma implementacím lokálního úložiště; skutečné cesty kódu Dexie: CRUD, kaskádové mazání, GC osiřelých příloh a **migrace** (pro každý test `NotesDB` s jednorázovým názvem) | `lifecycle.migration.test.ts`, `attachments.roundtrip.test.ts` |
| Hooky | Vitest + RTL | Živé dotazy reagují na změny; změny jsou idempotentní a transakční | `src/hooks/data/*` |
| Chování komponent | Vitest + RTL + user-event | Interakce, kontrakty, sémantika a11y; role a popisky, ne pixely | testy editoru, karet, navigace, nastavení |
| Průřezové kontroly | Vitest | Konzistence, kterou nevlastní žádná jednotlivá funkce: balíčky i18n proti rozcházení klíčů, párování tokenů safe-area | `i18n.test.ts`, `globals.test.ts` |
| Synchronizace | Vitest + falešný server postavený z vendorovaného kontraktu | Push, pull, konflikty, resynchronizace, převzetí a vymazání, deterministicky | `src/sync/*.test.ts` |
| End-to-end | Playwright (`e2e/`), projekty `desktop` + `mobile` proti `pnpm dev` | Toky ve skutečném prohlížeči, které jsdom nevidí | `onboarding.spec.ts` (průvodce) |

Vitest vidí jen `src/**`; `testDir` Playwrightu je `e2e/`; žádný z runnerů nevidí soubory toho druhého.

## Hranice prostředí, naučené tvrdou cestou

Jsou zaznamenané, protože každá stála jedno ladění:

- **jsdom měří každý prvek jako 0x0**, takže cokoli geometrického (otvor ve spotlightu, rozvržení masonry) je pro unit testy neviditelné. Proto byl Playwright, odkládaný přes M1-M3, zapojen přesně ve chvíli, kdy ho potřeboval průvodce (M4 slice 5).
- **jsdom čte uložený Blob zpět jako prostý objekt**; testy Blobu tam a zpět musí běžet pod `// @vitest-environment node`.
- **Knihovny závislé na geometrii (přetahování klávesnicí v dnd-kit) potřebují v jsdom podvržené `getBoundingClientRect`**, se spy poté obnoveným.
- **IndexedDB přeskakuje řádky, jejichž indexovaná vlastnost je `undefined`**, a proto má migrace v3 samostatný test ([03-database.md](./03-database.md)).

## Co se záměrně neautomatizuje

- **Vizuální ověření na pixely je ruční.** Identitu nightshift specifikují měření v `DESIGN.md` a rozvržení se kontroluje okem v obou breakpointech; automatizované pixelové testy byly vzhledem ke své hodnotě vyhodnoceny jako křehké.
- **Instalace PWA** se ověřuje ručně na skutečných zařízeních (emulátor nevystaví ani výřez displeje, ani skutečné toky instalace); service worker a start offline mají vlastní běh Playwrightu proti produkčnímu buildu (`pnpm test:e2e:pwa`).
- **Skutečná synchronizace dvou zařízení** zůstává ruční plus uživatelské testování: pipeline Playwright napříč repozitáři by stála víc, než kolik by odhalila.

## CI

Pipeline v GitLabu ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)): `quality` (Biome + typecheck) → `test` (Vitest, Playwright) → `build` → `publish`, se zachovanými šablonami GitLabu pro SAST a detekci tajemství.
Pre-commit (husky + lint-staged) aplikuje bezpečné opravy Biome a na zbytku commit zablokuje.

## Testování synchronizace bez serveru

Klientský synchronizační engine se v tomto repozitáři testuje proti **falešnému serveru postavenému z vendorovaného kontraktu Zod**, což dělá těžké cesty deterministickými: konflikt → konfliktní kopie, úplná resynchronizace při příliš starém kurzoru, vyprázdnění offline fronty, převzetí a vymazání.
Soubor kontraktu zároveň slouží jako alarm na rozcházení: změna backendu, která rozbije klienta, selže na validaci v testech dřív, než selže v produkci.
Backend se testuje sám ve svém repozitáři.

## Pro text práce

- Rozdělení TDD po vrstvách je obhajitelným metodickým tvrzením: přísné tam, kde existují kontrakty (logika, data, hooky, chování), pragmatické tam, kde neexistují (vizuální identita).
- Sekce o hranicích prostředí je poctivým materiálem o limitech testování nad jsdom, které většina textů přechází.
- Metriky dostupné pro text: počet testů v čase (historie gitu), izolace dvou runnerů a struktura kontrol v CI.
