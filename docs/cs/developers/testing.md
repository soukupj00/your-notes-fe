# Testování

Testy se píšou předem tam, kde je kontrakt, který je třeba dodržet, a dodatečně tam, kde jde jen o to, aby něco správně vypadalo ([ADR 0003](../adr/0003-testing-stack-vitest-and-playwright.md)).
Každé rozšíření, datový hook a uživatelský tok přichází se svými testy ve stejné změně.

```bash
pnpm test         # Vitest: unit, component and data tests, under src/
pnpm test:e2e     # Playwright against pnpm dev, at a desktop and a phone width, under e2e/
pnpm test:e2e:pwa # Playwright against the production build: the service worker and offline start
pnpm check        # Biome
pnpm lint         # ESLint, for the React Hooks rules
```

První běh Playwrightu na stroji potřebuje `pnpm exec playwright install chromium`.
Vitest vidí jen `src/` a Playwright jen `e2e/`.

## Co se testuje kde

| Úroveň | Nástroj | Co kontroluje |
|---|---|---|
| Čistá logika | Vitest | `src/lib`: vyhledávání, záloha, barvy, pořadí v přehledu, připomenutí, pravidla průvodce |
| Lokální úložiště | Vitest s `fake-indexeddb` | Jedna sada kontraktních testů spuštěná proti oběma implementacím, plus migrace Dexie |
| Hooky | Vitest a Testing Library | Živá čtení sledují zápisy; mutace jsou atomické |
| Komponenty | Vitest, Testing Library a user-event | Chování, role, popisky a ovládání klávesnicí, nikdy pixely |
| Průřezové | Vitest | Překladové balíčky se shodují; každá barva je uvnitř sRGB |
| Synchronizace | Vitest a falešný server sestavený z kontraktu | Push, pull, konflikty, resync, adopce a vymazání |
| End to end | Playwright | Co jsdom nevidí: průvodce, rychlé zachycení, seznamy úkolů, odkazy pro sdílení |

Uživatelský tok dostane svůj test v Playwrightu dřív než samotná funkce.
Téměř stejné testy jsou jeden tabulkový test.

## Pasti

- **jsdom měří každý prvek jako 0x0.**
  Cokoli, co závisí na rozvržení, jako zvýraznění průvodce nebo zděná (masonry) stěna, potřebuje Playwright.
- **jsdom čte uložený Blob zpět jako obyčejný objekt.**
  Test, který Blob uloží a znovu načte, běží pod `// @vitest-environment node`.
- **Drag and drop klávesnicí potřebuje v jsdom podvržené `getBoundingClientRect`**; spy potom obnovte.
- **IndexedDB přeskakuje řádky, jejichž indexované pole je `undefined`**, a proto má každá migrace vlastní test.

## Co zůstává ruční

- **Jak to vypadá.** Design se kontroluje okem v obou šířkách a v obou motivech podle `DESIGN.md`; pixelové testy byly vyhodnoceny jako příliš křehké vzhledem k tomu, co zachytí.
- **Instalace PWA** na skutečných telefonech, kterou emulátor věrně nezvládne.
- **Dvě skutečná zařízení synchronizovaná přes skutečný server.** Engine se zde testuje proti falešnému serveru a server se testuje sám ve vlastním repozitáři.

## CI

Stejná pipeline běží na GitLabu i na GitHubu: Biome a kontrola typů, pak Vitest a Playwright, pak build a container image ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)).
Před commitem spustí husky Biome a ESLint na stagovaných souborech; bezpečné opravy se aplikují a cokoli jiného commit zablokuje.
