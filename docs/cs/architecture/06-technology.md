# Technologie a balíčky

Všechny použité technologie, seskupené podle účelu, s důvodem, proč tu jsou.
Verze odpovídají stavu k 2026-08 (rozhodující je `package.json`).
Celý seznam formuje jedno produktové omezení: **žádné externí síťové požadavky za běhu** (žádné CDN pro fonty, žádná analytika, žádné vzdálené zdroje) a velikost bundlu je náklad, který uživatel pocítí při instalaci PWA.

## Základní platforma

| Technologie | Role | Zdůvodnění |
|---|---|---|
| React 19 | UI framework | Dáno zadáním; concurrent funkce a moderní hooky |
| TypeScript (strict, `erasableSyntaxOnly`) | Jazyk | Typování od řádků Dexie až po parametry rout |
| Vite 7 | Build/dev | Rychlé HMR; hostitel pluginů pro PWA, generování kódu routeru, Tailwind |
| pnpm (připnutý přes corepack, `packageManager`) | Správce balíčků | Deterministické instalace; Node 22 přes `.nvmrc` |

## Routování a stav

| Technologie | Role | Zdůvodnění |
|---|---|---|
| TanStack Router | Souborové routování | Zvolen místo React Routeru kvůli **typovaným search parametrům** - URL je modelem stavu aplikace, takže rozhodlo, že parametry jsou plnohodnotné a validované ([ADR 0008](../adr/0008-tanstack-router-over-react-router.md)); `routeTree.gen.ts` je generovaný a commitnutý |
| Zod 4 | Validace za běhu | Parametry URL, blob předvoleb, manifesty záloh (`z.looseObject`, aby neznámá budoucí pole přežila cestu tam a zpět) a každá odpověď serveru na hranici |

Žádná knihovna pro klientský stav není: pokrývají ho živé dotazy Dexie + parametry URL + malé kontexty (viz [01-architecture.md](./01-architecture.md)).

## Datová vrstva

| Technologie | Role | Zdůvodnění |
|---|---|---|
| Dexie 4 + dexie-react-hooks | Obal nad IndexedDB + `useLiveQuery` | Verzované schéma s migracemi, transakce a reaktivní dotazy bez vrstvy cache ([ADR 0001](../adr/0001-local-first-storage-with-dexie.md)) |
| `crypto.randomUUID` (přes `lib/rows.ts`) | Id entit | Bez kolizí napříč zařízeními - vlastnost, na které stojí převzetí dat při přihlášení |
| fflate | Záloha do zipu | Malý, rychlý; export/import celé databáze |

## Editor

| Technologie | Role | Zdůvodnění |
|---|---|---|
| TipTap 3 (~25 balíčků `@tiptap/*`) | Editor formátovaného textu | Postavený na ProseMirroru, architektura po rozšířeních odpovídá vlastnímu vzoru pluginů aplikace ([ADR 0004](../adr/0004-canonical-editor-toolbar-pattern.md)); dáno zadáním |
| KaTeX (`@tiptap/extension-mathematics`) | Vykreslování matematiky | Hostovaný lokálně, žádné CDN |
| @excalidraw/excalidraw | Kresby | Scény tabule jako přílohy; upravují se v modálním okně, náhled je uložené SVG |
| dompurify | Sanitizace HTML | Tělo poznámky je uložené HTML; před vykreslením mimo editor se sanitizuje |

## UI a design systém

| Technologie | Role | Zdůvodnění |
|---|---|---|
| Tailwind CSS 4 | Stylování | Konfigurace v CSS; designové tokeny OKLCH v `globals.css` jsou jediným zdrojem barev |
| Primitiva Radix UI + vendorované shadcn | Přístupné komponenty | Dialog, popover, tooltip, switch apod. se zabudovanou přístupností; vendorované a upravené (např. shell s postranním panelem, [ADR 0010](../adr/0010-shadcn-sidebar-as-nav-shell.md)) |
| Motion | Animace | Veškerý pohyb podléhá omezení pohybu; oficiální knihovna podle `PRODUCT.md` (GSAP z původního zadání byl vypuštěn) |
| lucide-react | Ikony | Přes registr s textovými klíči (`icons.ts`), nikdy se neimportují přímo do kódu funkcí |
| @dnd-kit/* | Drag and drop | Řazení při přizpůsobení panelu nástrojů; ovladatelné klávesnicí |
| @fontsource-variable/* (Bricolage Grotesque, Work Sans) | Typografie | Lokálně hostované fonty - omezení bez CDN udělalo `@fontsource` povinným |
| sonner | Toasty | Možnost vrátit akci (smazání, upozornění na konflikt) |
| fuse.js | Fuzzy vyhledávání | Řazené vyhledávání v paměti nad přehledem; žádný server, žádný index k údržbě |
| class-variance-authority, clsx, tailwind-merge | Skládání tříd | Idiom shadcn |
| react-hotkeys-hook | Klávesové zkratky | `mod+K` atd.; zkratky se zobrazují jen přesným ukazatelům ([ADR 0016](../adr/0016-width-decides-layout-pointer-decides-affordances.md)) |
| driver.js | Zvýraznění v průvodci | Jediné místo, kde se průvodce dotýká knihovny; veškerá logika průvodce je bez závislostí v `lib/tour/` ([ADR 0024](../adr/0024-a-welcome-at-launch-the-tour-in-settings.md)) |
| react-colorful, color, country-flag-icons | Drobné utility | Výběr barvy, výpočty s barvami, vlajky jazyků |

## PWA a i18n

| Technologie | Role | Zdůvodnění |
|---|---|---|
| vite-plugin-pwa + Workbox (`workbox-window`) | Service worker, manifest, precache | `registerType: 'prompt'` pro explicitní postup aktualizace |
| i18next + react-i18next + http-backend + browser-languagedetector | i18n | `en`/`cs` od prvního dne, záložní jazyk `en`; test hlídá, aby se klíče balíčků nerozešly |

## Testování a kvalita

| Technologie | Role | Zdůvodnění |
|---|---|---|
| Vitest 4 + React Testing Library | Unit/komponentové/datové testy | Přes 900 testů; chování a kontrakty, ne pixely ([ADR 0003](../adr/0003-testing-stack-vitest-and-playwright.md)) |
| fake-indexeddb | IndexedDB v testech | Skutečné cesty kódu Dexie včetně testů migrací |
| Playwright | E2E (`e2e/`, projekty pro desktop + mobil) | Zapojen v M4, slice 5, protože ho potřeboval průvodce: jsdom měří každý prvek jako 0x0, takže chování zvýraznění pro něj je neviditelné |
| Biome | Lint + formátování (jeden nástroj) | Nahradil ESLint + Prettier ([ADR 0005](../adr/0005-biome-replaces-eslint-prettier.md)); ESLint zůstává jen pro pravidla `react-hooks`, dokud je Biome nepokryje |
| husky + lint-staged | Pre-commit | Bezpečné opravy se aplikují a znovu přidají do stage; zbývající chyby commit zablokují |

## Doručení

| Technologie | Role | Zdůvodnění |
|---|---|---|
| GitLab CI | Pipeline | `quality → test → build → publish`, plus SAST + detekce tajemství ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)) |
| Docker + Kaniko | Container image | Publikovaný do registru GitLabu; image backendu obsahuje sestavenou PWA a stává se artefaktem pro ty, kdo si aplikaci hostují sami |

## Repozitář backendu

Fastify, SQLite přes `better-sqlite3`, Drizzle ORM, Caddy pro TLS, `compose.yml`; REST + HAL (`application/hal+json`); sdílený kontrakt Zod vendorovaný do tohoto repozitáře.
Zdůvodnění je v [05-server.md](./05-server.md).

## Pro text práce

- Hlavní linka argumentace: téměř každá volba se dá vysledovat k jednomu ze tří omezení - **offline/soběstačnost** (Dexie, fontsource, žádné CDN), **typování od začátku do konce** (TS, Zod, TanStack Router, sdílený kontrakt), nebo **přístupnost ve výchozím stavu** (Radix, omezení pohybu, registr ikon).
- Odchylky od původního zadání, které stojí za poctivé zdokumentování: GSAP → Motion, ESLint/Prettier → Biome, Playwright odložen a pak přijat, když si ho vyžádal průvodce, a otázka frameworku backendu (zvažovány FastAPI/Laravel/Symfony) rozhodnutá ve prospěch Fastify argumentem sdíleného kontraktu.
