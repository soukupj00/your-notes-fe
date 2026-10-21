# 0025 - Zavřená poznámka zaujme své seřazené místo

- Stav: přijato (doplňuje [ADR 0012](./0012-feed-rank-is-held-membership-is-live.md))
- Datum: 2026-10-21

## Kontext

ADR 0012 drží místo každé karty, dokud se uživatel nepodívá jinam, takže při řazení „naposledy upraveno“ zůstala upravená poznámka na místě až do obnovení stránky.
V prvním uživatelském testu to působilo jako chyba: tester čekal, že se právě upravená poznámka posune nahoru, a viděl, že změna štítku přeřadí zeď hned (změna parametru vyhledávání), kdežto úprava ne.
Zavření editoru je okamžik, kdy uživatel s poznámkou skončil, a pohyb připadne na kartu, se kterou právě pracoval.

## Rozhodnutí

**Když se editor zavře, poznámka, která byla otevřená, a jen ona, opustí držené pořadí a zaujme místo, které jí dává řazení.**

- Všechny ostatní karty si drží své místo, takže se zeď nepřeuspořádá za kartami, na které uživatel nesáhl.
- Poznámka je uvolněna až do první aktualizace přehledu po zavření, protože poslední zápis při zavření může dorazit až poté, co URL už říká, že je editor zavřený.
- Otevření poznámky a zavření bez úpravy nic nezapíše, takže poznámka, která se jen četla, zůstane na místě.

Vše ostatní z ADR 0012 platí dál.

## Zvažované možnosti

- **Při zavření znovu seřadit celý přehled.**
  Zamítnuto: poskočily by i karty dříve přebarvené nebo odškrtnuté, což je právě to prostorové překvapení, kterému ADR 0012 brání.
- **Posunout poznámku s krátkým zpožděním.**
  Zamítnuto: posun už ukazuje stávající pružinová animace a zpoždění by jen pohnulo zdí ve chvíli, kdy je uživatel jinde.

## Důsledky

- Karta upravené poznámky se při zavření posune; při jiném řazení než „naposledy upraveno“ jen tehdy, když úprava změnila klíč řazení.
- Čtení už neposouvá `updatedAt`, takže se ani nesynchronizuje jako změna.
