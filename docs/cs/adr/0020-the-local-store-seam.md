# 0020 - Aplikace čte a zapisuje přes rozhraní lokálního úložiště, nikdy přímo přes Dexie

- Stav: přijato (doplňuje [ADR 0001](./0001-local-first-storage-with-dexie.md))
- Datum: 2026-08-29

## Kontext

Aplikace je open source a self-hosted a přispěvatel může chtít mít svá data jinde než v IndexedDB: jen v paměti, nebo sladěná s vlastním vzdáleným úložištěm místo vlastního serveru, který tento projekt dodává.
Dnes se na Dexie sahá přímo ze 14 souborů - šesti datových hooků a osmi dalších (`backup.ts`, `tour/props.ts`, `PreferencesProvider`, dvou vyhledání štítků na úrovni routy, node view pro Excalidraw, dialogu editoru a testovacího helperu).
Spolu s ním prosakují dva koncepty Dexie: reaktivita (`useLiveQuery`) a atomicita (`db.transaction`).

„Úložiště“ v požadavku zahrnovalo dvě různé věci a glosář je nyní drží odděleně.
**Lokální úložiště** je kopie na zařízení, jediná věc, kterou aplikace přímo čte nebo zapisuje; v prohlížeči je jeho trvalou podobou IndexedDB a alternativou, která skutečně existuje, je *žádná perzistence*.
**Vzdálené úložiště** je to, s čím se lokální úložiště sladí prostřednictvím synchronizace; S3 nebo konkurenční server je vzdálené úložiště, ne lokální, protože prohlížeč ho nedokáže udělat reaktivním, transakčním ani dostupným offline.

## Rozhodnutí

**Dvě rozhraní, odpovídající dvěma významům.**

1. **`LocalStore`** (`src/data/LocalStore.ts`) je jediné rozhraní, přes které kód aplikace sahá na perzistovaná data.
   Je utvářené doménou (`notes.feed(scope)`, `tags.merge`, `attachments.sweepAll`), ne tabulkami.
   Živá čtení vracejí minimální observable, `Live<T>`, které se konzumuje přes jediný hook `useLive`; každá operace, která musí být atomická, je jedna metoda, atomická uvnitř své implementace, takže rozhraní nemá žádné `transaction()`.
   Vyhledávání, řazení a držené pořadí zůstávají před tímto rozhraním: jsou to čisté funkce nad seznamem, který vrací, a držené pořadí existuje proto, aby odpovědělo na otázku „dívá se uživatel“, kterou žádné úložiště znát nemůže.
   Úložiště se poskytuje přes React context, sestavuje se jednou v `main.tsx`; moduly mimo React ho dostávají jako argument.
   Dexie se stává privátní záležitostí `src/data/dexie/`, vynucenou pravidlem `noRestrictedImports` v Biome, ne konvencí.
2. **`Remote`** (push, pull, put/get blobu) je to, s čím mluví synchronizační engine, a **`AccountService`** (relace, zařízení, pozvánky) je samostatná, volitelná schopnost, kterou implementuje jen vlastní server.
   Typy jsou deklarované už teď; implementace patří do synchronizačních slices M5.

**Dodávají se dvě implementace lokálního úložiště: Dexie (výchozí, jediná, která data uchovává) a in-memory.**
Proti oběma běží jedna sada kontraktových testů, takže je prokázáno, že rozhraní dokáže splnit i něco, co není Dexie, a paměťové úložiště se nemůže zvrhnout v testovací dvojník, který projde tam, kde by Dexie selhalo.
Uživatel nemá žádný přepínač: volbu dělá ten, kdo aplikaci sestavuje, v `main.tsx`.

**Předvolby z úložiště odcházejí.** Předvolba je to, jak uživatel s aplikací zachází, ne něco, co aplikace drží za uživatele; přidává se k motivu a jazyku v `localStorage` a už není součástí zálohy.
Co ze starého řádku `settings` zůstává za rozhraním, je evidence o vlastních řádcích úložiště - výchozí stavy rekvizit průvodce a v M5 synchronizační kurzor a připojený účet - pod `meta`.

## Důsledky

- Věta z ADR 0001 „aplikace čte a zapisuje přímo do Dexie“ už neplatí; jeho volba Dexie jako výchozího lokálního úložiště ano.
- Hooky v `src/hooks/data` si zachovávají veřejný tvar; mění se jen jejich těla, takže komponenty zůstávají beze změny.
- `dexie-react-hooks` mizí ze seznamu závislostí.
- Seed průvodce už nepotřebuje transakci přes více tabulek: výchozí stavy se zaznamenají *před* zápisem řádků rekvizit, a pád mezi tím zanechá výchozí stavy pro poznámky, které neexistují, což úklid už toleruje.
- Testy hooků a komponent mohou běžet proti paměťovému úložišti, což je rychlejší a bez zvláštnosti jsdom s Blobem.
- `App` dostává úložiště jako prop, což umožňuje testům ho vykreslit proti libovolné implementaci.
- Příběh pro vývojáře má tři věty: implementujte `LocalStore`, zajistěte, aby prošly kontraktové testy, změňte jeden řádek v `main.tsx`.

## Zvažované alternativy

**Rozhraní ve tvaru tabulek** (API `Table` z Dexie pod jiným jménem). Zamítnuto: žádná druhá implementace by nemohla poctivě nabídnout `where().equalsIgnoreCase()` ani transakce přes více tabulek.

**Obecné `transaction(stores, fn)` na rozhraní.** Zamítnuto ze stejného důvodu - je to právě ta schopnost, kterou úložiště mimo IndexedDB slíbit nemůže.

**Hrubá sběrnice změn po tabulkách místo `Live<T>`.** Zamítnuto: ztrácí přesnost `liveQuery` (zápis štítku by znovu spustil každé čtení příloh) a dává každému hooku seznam závislostí, který se může rozejít se skutečností.

**Žádné rozhraní; zdokumentovat Dexie jako lokální úložiště.** Nejlevnější a vůči prohlížečům poctivé, ale ponechává osm souborů mimo hooky, které sahají přímo na Dexie, což byl zápach už dříve, než tento požadavek vznikl.
