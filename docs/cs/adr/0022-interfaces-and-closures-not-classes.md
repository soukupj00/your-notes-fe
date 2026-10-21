# 0022 - OOP pomocí rozhraní a closure factories, nikdy pomocí tříd

- Stav: přijato
- Datum: 2026-10-02

## Kontext

Refaktorizační průchod se ptal, zda by principy a vzory OOP (rozhraní, factories, adaptéry, dekorátory, strategie) usnadnily frontend měnit, pochopit a udržet bez kopií.
Čtyři průzkumy kódu ukázaly, že opakování je soustředěné na několika místech (synchronizační polovina obou lokálních úložišť, vkládání příloh a node views, jedenáct téměř identických rozšíření editoru, logika ukládání v dialogu editoru, řádky entit sestavované inline), a zjistily, že kódová základna už OOP praktikuje v jednom konkrétním stylu.
Její rozhraní jsou TypeScript interfaces, za kterými stojí closure factories: `LocalStore` má dvě implementace pod jednou sadou kontraktových testů ([ADR 0020](./0020-the-local-store-seam.md)), `TourStage` má dvě, `createAttachmentNode` má pět produktů, `createSyncEngine` a `createHalClient` jsou closures nad svými závislostmi.
Kód obsahuje 121 rozhraní a pět tříd, z nichž tři jsou podtypy `Error` a zbylé dvě si vynutily Dexie a React.
Otázka zněla, zda „zavést OOP“ znamená uplatnit principy tohoto stylu tam, kde jsou kopie, nebo převést refaktorované oblasti na třídy, dědičnost a dekorátory.

## Rozhodnutí

**Vzory se uplatňují ve stávajícím stylu. Nezavádějí se žádné třídy, dědičnost ani dekorátory.**

- Rozhraní je kontrakt a closure factory (`createX(deps)`) je implementace.
- Strategie je tabulka `Record<Kind, …>` s klíčem podle doménového druhu, ne třída pro každý druh.
- Šablona je pomocná funkce, která proměnlivou část dostává jako argument (`withButton(Upstream, ctx => props)`), ne základní třída s abstraktními metodami.
- Sdílené algoritmy nad dvěma implementacemi jsou čisté funkce, které rozhodují, přičemž každá implementace čte před nimi a zapisuje po nich, ne základní třída, kterou implementace rozšiřují.
- Stavová věc s identitou a životním cyklem (synchronizační engine, koncept v editoru, běh průvodce) je closure, která vrací malý objekt funkcí, jako už je `createSyncEngine`.
- `class` zůstává vyhrazené pro to, co vyžaduje knihovna: podtyp `Error`, podtřídu `Dexie` pro Dexie, error boundary v Reactu.
- Abstrakce si své místo musí zasloužit druhou skutečnou implementací nebo alespoň třemi místy volání.
  Rozhraní s jednou implementací nebo factory pro jeden produkt je zápach, který by měl čtenář zpochybnit.

## Důsledky

- Deset jednoduchých rozšíření editoru se stává deklaracemi přes jeden helper v jednom souboru a jejich testy se stávají jedním tabulkovým testem.
- Úložiště Dexie a paměťové úložiště budou sdílet své synchronizační algoritmy přes rozhodovací funkce v `syncRows.ts`, což udržuje paměťové úložiště atomické tím, že je synchronní, a práci Dexie uvnitř jeho transakce.
- Čtenář, který zná styl kteréhokoli jednoho rozhraní, zná všechna; neexistuje druhý dialekt, který by se musel učit.
- Mění se pravidlo pro složky: složka je pro rozšíření, které má víc než svou deklaraci (node view, koordinátor, vlastní test chování), a jednořádková deklarace žije vedle svých sourozenců.

## Zvažované alternativy

**Třídy v TypeScriptu s dědičností** pro rozšíření (základní `MarkButtonExtension`), lokální úložiště (abstraktní `BaseLocalStore`) a koncept.
Zamítnuto: React hooky i `.extend()` z TipTapu mají tvar funkcí, takže třída by v každém případě obalovala funkci; základní třída úložiště by svázala úložiště nad `Map` s tvarem transakcí Dexie; a výsledek by každou oblast rozdělil na dva dialekty.

**Dekorátory v TypeScriptu** pro průřezové obaly (retry nad vzdáleným úložištěm, toast u vzdálené akce).
Zamítnuto: nejsou zapnuté v `tsconfig`, nejsou v tomto stacku idiomatické a oba kandidáti už mají menší řešení (back-off ve smyčce je ten retry; helper pro vzdálenou akci je funkce).
