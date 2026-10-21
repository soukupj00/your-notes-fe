# 0007 - Blob místo base64 pro data příloh

- Stav: přijato
- Datum: 2026-07-21

## Kontext

M3 zavádí přílohy (počínaje inline obrázky - viz [PLAN.md](https://github.com/soukupj00/your-notes-fe/blob/main/PLAN.md) M3 Slice 1).
Bajty příloh se musí ukládat do lokálního úložiště v IndexedDB ([ADR 0001](./0001-local-first-storage-with-dexie.md)).
[ADR 0004](./0004-canonical-editor-toolbar-pattern.md) drží editor ve středu produktu a M3 vykresluje obrázky **inline v těle poznámky**: HTML těla obsahuje jen lehké **id** přílohy, ne její bajty, a uzel TipTapu při vykreslení převede id na data.

Zbývá jedna otevřená otázka odložená z ADR 0001: v jaké fyzické podobě se mají samotná data ukládat - jako nativní `Blob`, nebo jako řetězec kódovaný do base64?

Rozhodnutí se týká schématu i každého čtení a zápisu přílohy, takže jeho zvrácení je drahé a stojí za zaznamenání.

## Rozhodnutí

Data příloh se v IndexedDB ukládají jako nativní **`Blob`y**, ne jako řetězce base64.

- Výběr souboru, vložení i přetažení nám předají `File` (což je `Blob`); ukládáme ho přímo, bez kódování.
- Vykreslení používá `URL.createObjectURL(blob)` k vytvoření krátkodobé URL `blob:` pro `<img>` (uvolní se při odpojení uzlu).
- Pokud synchronizace v M5 bude potřebovat podobu vhodnou pro JSON a přenos, zakódujeme data do base64 (nebo použijeme multipart) **pouze na hranici synchronizace** - lokální úložiště zůstane nativně na Blobech.

## Důsledky

- **Lokálně menší a rychlejší.** Žádná ~33% daň za base64 a žádné kódování přes `FileReader` při každém zápisu.
  IndexedDB ukládá Bloby nativně přes structured clone a `createObjectURL` stejně Blob vyžaduje.
- **Životní cyklus object URL je potřeba spravovat.** Každé `createObjectURL` musí mít párové `revokeObjectURL` (při odpojení uzlu/komponenty), jinak v rámci relace uniká paměť.
  Tuto disciplínu drží NodeView obrázku a vykreslovací komponenty.
- **Serializace pro synchronizaci je odložená, ne zadarmo.** M5 musí na hranici přenosu převádět Blob → base64/multipart.
  Přijato: jde o záležitost hranice pro milník vzdálený dva kroky a nemá teď zatěžovat lokální úložiště.
- **Tělo zůstává lehké.** Protože tělo odkazuje na id (nikdy na URI `data:`), automatické ukládání serializuje krátké řetězce i u poznámek plných obrázků.

## Zvažované alternativy

- **Řetězce base64 v poli s daty.** Zamítnuto: platí 33% daň za úložiště a cenu kódování při každém zápisu už teď, jen aby se zjednodušil formát synchronizace v M5, který stejně snadno vytvoříme později na hranici.
- **Inline URI `data:` v base64 přímo v HTML těla (výchozí chování Image v TipTapu).** Zamítnuto rovnou: nafukuje `Note.body` a při každém načtení editoru a každém automatickém uložení po debounce znovu parsuje a serializuje řetězce o velikosti několika megabajtů.
  Právě tomuto antivzoru se schéma s odkazem přes id vyhýbá.
