# 0003 - Testovací sada: Vitest + Playwright

- Stav: přijato
- Datum: 2026-06-15

## Kontext

Zadání projektu vyžaduje unit testy a E2E testy v Playwrightu, přičemž každou malou funkci doprovází test (chování UI a data v IndexedDB).
Zatím není nainstalovaný žádný test runner - v devDependencies jsou jen pomocné balíčky `fake-indexeddb` a `indexeddbshim`.
Build už používá Vite.

## Rozhodnutí

- **Vitest** pro unit testy, testy komponent a testy datové vrstvy - sdílí s Vite konfiguraci, transformační pipeline i alias `@/`, takže nastavení je minimální.
- **React Testing Library** pro testy komponent.
- **`fake-indexeddb`** (už je mezi závislostmi) pro testování vrstvy Dexie v Node.
- **Playwright** pro end-to-end testy v prohlížeči, včetně PWA a offline scénářů.

### Postup: pragmatické TDD (red → green → refactor)

Sada se používá **test-first**, pragmaticky podle vrstvy:

- **Nejdřív test (povinně):** čistá logika a utility, datová vrstva Dexie, hooky a **chování** komponent (interakce a kontrakty).
  Pro každý uživatelský tok se akceptační test v Playwrightu píše **před** samotnou funkcí.
- **Nejdřív implementace, pak test:** čistě vizuální rozvržení (mezery, stíny, vykreslení barev).
  Testy přidané dodatečně fixují **chování a přístupnost** (role, popisky, ovládání klávesnicí), ne pixely.
- **Pro každou jednotku práce:** napsat padající test proti definovanému kontraktu/šabloně → implementovat minimum, aby prošel → refaktorovat s testy jako záchrannou sítí.

Existující dobře definované kontrakty - rozhraní rozšíření podle vzoru A ([ADR 0004](./0004-canonical-editor-toolbar-pattern.md)) a rozhraní v `src/hooks/data/` - dělají přístup test-first proveditelným.
Každé rozšíření, datový hook i uživatelský tok přichází se svými testy v téže změně.

## Důsledky

- Vitest znovu používá `vite.config.ts`, takže alias i pluginy fungují bez paralelní konfigurace Jestu.
- Dva testovací příkazy (`test` pro unit/komponentové/datové testy, `test:e2e` pro Playwright) - přidají se v M1.
- Datové testy importují stejný modul `db` jako aplikace a IndexedDB jim poskytuje `fake-indexeddb/auto` (stejně jako už to dělá seeder).
- Volba Vitestu místo Jestu se vyhýbá druhé sadě nástrojů; cenou je závislost na ekosystému Vitestu, který ale k projektu na Vite dobře sedí.
