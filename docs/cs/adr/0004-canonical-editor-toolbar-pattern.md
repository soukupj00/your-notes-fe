# 0004 - Kanonický vzor panelu nástrojů editoru: tlačítka vlastněná rozšířeními + registr ikon

- Stav: přijato
- Datum: 2026-06-15

## Kontext

V editoru dnes vedle sebe existují dva vzory panelu nástrojů, což mate a vede k rozcházení kódu:

- **Vzor A - tlačítko vlastněné rozšířením.** Každé rozšíření volá `.extend()` na své upstreamové rozšíření TipTapu a připojuje volbu `button`, která vrací `{ component: ActionButton, componentProps: { icon: "<name>", ... } }`, kde `icon` je **řetězcový klíč** překládaný přes `src/components/icons/icons.ts`.
  Tehdy ho používaly `extensions/Bold/Bold.ts` a `extensions/history/History.ts`; od M6 slice 2 jsou rozšíření s jediným tlačítkem deklarace v `extensions/formatting.ts` přes `withButton`.
- **Vzor B - centralizované pole panelu nástrojů.** `menus/toolbars/FormatSection.tsx` a `ListSection.tsx` definují pole `formatActions` s **přímo importovanými inline JSX ikonami z Lucide**, vykreslované přes `Toolbar`/`ToolbarSection`.
  Právě to dnes `editor.tsx` skutečně vykresluje.

Inspirační repozitář (reactjs-tiptap-editor) používá vzor A.
Volba jednoho ze vzorů se později těžko vrací, protože by se muselo přepsat každé rozšíření i každý panel nástrojů.

## Rozhodnutí

**Kanonický je vzor A.**
Každé rozšíření vlastní své `button` a na ikony odkazuje řetězcovým klíčem z centrálního registru `icons.ts`.
`ActionButton` je jediná sdílená komponenta tlačítka.
Starší panely nástrojů `FormatSection`/`ListSection` se převedou tak, aby **skládaly tlačítka poskytovaná rozšířeními** do sekcí a rozbalovacích nabídek, místo aby znovu definovaly akce a importovaly ikony přímo.

## Důsledky

- Rozšíření jsou soběstačná: chování, tlačítko, klávesová zkratka i tooltip žijí pohromadě - každé rozšíření se tak snáz přidává, testuje a dá se o něm snáz uvažovat.
- Registr ikon je jediné místo, kde se ikony deklarují; s přibývajícími rozšířeními se musí rozšiřovat.
  Panely nástrojů přestanou importovat Lucide přímo.
- Cena migrace: `FormatSection`/`ListSection` a `editor.tsx` se musí přepracovat a dosud prázdná (stub) rozšíření doplnit (M1, viz `src/components/editor/PLAN.md`).
- Přijatý kompromis: centralizované pole se o něco snáz přelétne očima, ale rozděluje definici rozšíření do více souborů a duplikuje napojení ikon - zamítnuto ve prospěch soudržnosti a konzistence se zdrojovým projektem.
