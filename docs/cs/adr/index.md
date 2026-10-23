# Rozhodnutí

Každý záznam uvádí, co bylo rozhodnuto, proč a co to stojí.
Záznam, který mění dřívější rozhodnutí, to uvádí hned nahoře.
Rozhodnutí týkající se samotného serveru jsou na [webu serveru](https://soukupj00.github.io/your-notes-be/cs/adr/).

| Záznam | Rozhodnutí |
|---|---|
| [0001](./0001-local-first-storage-with-dexie.md) | Lokální úložiště (local-first) s Dexie a IndexedDB |
| [0002](./0002-separate-frontend-backend-repositories.md) | Oddělené repozitáře frontendu a backendu |
| [0003](./0003-testing-stack-vitest-and-playwright.md) | Testovací sada: Vitest a Playwright |
| [0004](./0004-canonical-editor-toolbar-pattern.md) | Tlačítka panelu nástrojů editoru patří svým rozšířením, ikony pocházejí z registru |
| [0005](./0005-biome-replaces-eslint-prettier.md) | Biome nahrazuje ESLint a Prettier |
| [0006](./0006-ci-cd-and-container-image-distribution.md) | CI/CD a distribuce container image |
| [0007](./0007-blob-over-base64-for-attachment-payloads.md) | Blob místo base64 pro data příloh |
| [0008](./0008-tanstack-router-over-react-router.md) | TanStack Router místo React Routeru |
| [0009](./0009-note-lifecycle-model.md) | Model životního cyklu poznámky: stav, připnutí, barva, koš |
| [0010](./0010-shadcn-sidebar-as-nav-shell.md) | shadcn `Sidebar` jako navigační kostra |
| [0011](./0011-toolbar-items-and-families.md) | Položky a skupiny panelu nástrojů místo plochého seznamu tlačítek |
| [0012](./0012-feed-rank-is-held-membership-is-live.md) | Pořadí v přehledu se drží, příslušnost je živá (doplněno [0025](./0025-the-closed-note-takes-its-sorted-place.md)) |
| [0013](./0013-checklist-sinking-is-presentation-not-storage.md) | Propadání v seznamu úkolů je způsob zobrazení, ne uložení |
| [0014](./0014-the-open-note-lives-in-the-url.md) | Otevřená poznámka žije v URL |
| [0015](./0015-the-tour-drives-the-app-on-disposable-props.md) | Průvodce ovládá aplikaci na jednorázových rekvizitách (nahrazeno [0023](./0023-the-tour-points-at-settings.md)) |
| [0016](./0016-width-decides-layout-pointer-decides-affordances.md) | Šířka rozhoduje o rozvržení, ukazatel o nabízených ovládacích prvcích |
| [0017](./0017-note-level-last-writer-wins-with-conflicted-copies.md) | Last-writer-wins na úrovni poznámky, poražená verze zůstává jako konfliktní kopie |
| [0018](./0018-the-server-serves-the-pwa.md) | Synchronizační server servíruje PWA, a to určuje autentizaci, párování i TLS |
| [0019](./0019-import-replaces-restore.md) | Import nahrazuje obnovení: jedna aditivní operace pro každý zdroj |
| [0020](./0020-the-local-store-seam.md) | Aplikace čte a zapisuje přes rozhraní lokálního úložiště, nikdy přímo přes Dexie |
| [0021](./0021-reminders-are-handed-off-to-the-calendar.md) | Připomenutí se předávají do kalendáře; aplikace nikdy neposílá oznámení |
| [0022](./0022-interfaces-and-closures-not-classes.md) | OOP pomocí rozhraní a closure factories, nikdy pomocí tříd |
| [0023](./0023-the-tour-points-at-settings.md) | Průvodce ukazuje na Nastavení a nezakládá žádné poznámky (nahrazeno [0024](./0024-a-welcome-at-launch-the-tour-in-settings.md)) |
| [0024](./0024-a-welcome-at-launch-the-tour-in-settings.md) | Při spuštění uvítání; průvodce čeká na první návštěvu Nastavení |
| [0025](./0025-the-closed-note-takes-its-sorted-place.md) | Zavřená poznámka zaujme své seřazené místo |
| [0026](./0026-shortcuts-are-one-preference-matched-by-one-key-name.md) | Klávesové zkratky jsou jedna předvolba s jedním názvem klávesy |
| [0027](./0027-label-order-is-a-synced-fractional-position.md) | Pořadí štítků je synchronizovaná zlomková pozice |
