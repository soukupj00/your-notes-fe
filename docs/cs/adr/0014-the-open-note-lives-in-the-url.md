# 0014 - Otevřená poznámka žije v URL

- Stav: přijato
- Datum: 2026-08-08

## Kontext

Která poznámka je otevřená, byl React state: `NotesView.tsx` držel objekt `editing` a předával ho do `NoteEditorDialog`.
`Dialog` z Radixu na historii nesahá, takže prohlížeč neměl tušení, že je nějaká poznámka otevřená.

Tři důsledky, seřazené sestupně podle toho, jak moc záleží.

**Systémové tlačítko Zpět se na nejvytíženější obrazovce aplikace chovalo špatně.**
Pod `sm:` editor vůbec není modální okno - `NoteEditorDialog.tsx` ho vykresluje jako `top-0 left-0 h-[100dvh] w-full max-w-full rounded-none`, tedy celoobrazovkový panel, který zakrývá celou aplikaci včetně horní lišty.
Vypadá přesně jako stránka, takže na Androidu je gesto zpět samozřejmým způsobem, jak z něj odejít.
Ve skutečnosti ale to gesto spustilo zpět v routeru a přenavigovalo přehled pod panelem jinam.
Aplikace je `display: 'standalone'` (`vite.config.ts`), takže uživatel s nainstalovanou aplikací nemá žádné ovládání prohlížeče, kterým by chybu napravil.

**Na poznámku nešlo odkázat.**
Všechen ostatní stav přehledu se do URL přesunul už v M4 slice 2 - `q`, `sort`, `dir`, `tags` - s odůvodněním zaznamenaným v `CLAUDE.md`: *„prohledaný přehled je teď sdílitelný, přežije obnovení stránky a lze jím procházet tlačítkem zpět.“*
Která poznámka je otevřená, je stav stejného druhu a byl nápadnou výjimkou.

**Obnovení stránky poznámku ztratilo.**
Obnovení s otevřeným editorem vrátilo uživatele na holý přehled.

## Rozhodnutí

**Search param `note` na čtyřech routách přehledu určuje otevřenou poznámku a id poznámky se generuje při otevření jejího editoru, ne při prvním uložení.**

### `note` jede na stávajícím `validateSearch` rout přehledu

Přidává se do `noteSearchParamsSchema`, protože právě proti tomuto jedinému schématu validují všechny čtyři routy přehledu a druhý `validateSearch` by byl druhým místem, kde by se mohly rozejít.
Záměrně *není* součástí `ResolvedNoteSearch`: nemá výchozí hodnotu, filtrování na něm nezávisí a není to stav přehledu.
`useNoteSearchState` ho proto musí při zápisech explicitně přenášet, jinak by psaní do vyhledávacího pole - které na desktopu leží za otevřeným editorem - poznámku zavřelo.

### Identita patří do URL, záměr ne

Otevření poznámky může nést i jednorázové pokyny: spustit fotoaparát, automaticky přehrát první zvukový klip, založit prázdný seznam úkolů.
Ty popisují *gesto*, ne stav.
Dát je do URL by znamenalo, že obnovení stránky znovu otevře fotoaparát a sdílený odkaz přehraje cizí zvuk.
Zůstávají v React state, vázané na poznámku, ke které byly vytvořeny, aby je nemohlo zdědit tlačítko zpět, které přistane na jiné poznámce.

### Id se generuje při otevření, ne při prvním uložení

Tohle je ta neočividná část a nahrazuje návrh, se kterým se původně plánovalo.

Přirozený přístup je `?note=new`, vyměněné za `?note=<uuid>`, jakmile `createNote` vygeneruje id při prvním smysluplném stisku klávesy.
Tuto výměnu nelze implementovat bez druhé chyby: id je React `key` dialogu **a zároveň** závislost efektu, který načítá jeho obsah.
Jeho změna uprostřed práce znovu připojí editor pod kurzorem píšícího uživatele a načte poznámku z databáze přes neuložený stav.

`NotesView` proto vygeneruje uuid při otevření editoru a předá ho dolů jako `draftId`; `createNote` přijímá id, místo aby ho vždy generovalo.
Koncept se stále neukládá, dokud není co ukládat - guardrail 2 zůstává nedotčen - ale id, které *dostane*, je známé od prvního snímku.

URL je pak stabilní po celou dobu otevření, což odstraňuje výměnu, s ní spojenou otázku `replace` versus push i opětovné připojení.

### Zavření dělá pop, když je co popnout

Zavření spustí `history.back()`, pokud `useCanGoBack()`, a jinak param smaže na místě.

Žádná z větví sama o sobě není správná.
Vždy nahrazovat nechá na sobě dva stejné záznamy přehledu, takže další stisk zpět zdánlivě nic neudělá.
Vždy popovat úplně opustí aplikaci, když byla poznámka otevřena za studena - sdíleným odkazem, obnovením stránky, přes `start_url` PWA - což pro uživatele s aplikací nainstalovanou na iOS znamená ji znovu spustit.

## Důsledky

- **Zpět zavře editor**, na Androidu i na desktopu. Modální okno, které zavře tlačítko zpět, je webová konvence, takže i na desktopu jde o zlepšení, ale *je* to tam změna chování.
- **Na poznámky lze odkazovat a přežijí obnovení stránky.**
- **Param `note` může ukazovat do prázdna.** K tomu se lze dostat bez čehokoli neobvyklého: zavření prázdného konceptu ho trvale smaže (nebo ho vůbec nevytvoří), takže záznam, ze kterého uživatel právě přišel, jmenuje poznámku, která už neexistuje. Klepnutí na vpřed nebo obnovení zastaralé karty prohlížeče na něm přistane. Dialog to nahlásí výš, místo aby vykreslil prázdný editor, a param se smaže pomocí `replace`, aby do něj tlačítko zpět hned znovu nevešlo.
- **Id konceptu je vidět v adresním řádku dřív, než poznámka existuje.** Zkopírování tohoto odkazu a následné zahození konceptu dá odkaz do prázdna, což řeší předchozí bod.
- **Z `EditingState` se stal `NoteOpenRequest`.** Dříve obsahoval `null`, protože *byl* stavem editoru; teď vždy popisuje jen začátek.
- **`NoteOpenRequest` se rozdělil (2026-10-03, M6 slice 4): jeho id do `openNote(id | null, intent)`, jeho jednorázová pole do `Intent`.** Gesto žije v `useOpenNote` jako `{ id, isDraft, intent }` a spotřebuje se, když otevření skončí, a právě díky tomu Vpřed otevře poznámku bez něj.
- **Z `isDraft` se stal `isNew` a `draftId` zmizel (2026-10-03, M6 slice 5).** Každá otevřená poznámka má koncept (`CONTEXT.md`), takže příznak, který říká, že ji otevřel rychlý start, je `isNew`; `NoteEditorDialog` přijímá `noteId` z URL plus `isNew` místo `noteId | null` plus `draftId` a řádek pod tímto id vlastní `createNoteDraft({ id, isNew }, deps)` v `src/lib/draft.ts`.

## Zvažované alternativy

**Routa `/note/$id`.**
Zamítnuto. Za mnohem větší změnu - obnovení scrollu přehledu, vrácení fokusu na kartu, ze které se otevíralo - získá čistší editor na telefonu a desktop přijde o modální okno nad přehledem ve stylu Keep, což je tam správný tvar. `?note=` získá záznam v historii i přímý odkaz, aniž by sahalo na dialog, frontu konceptu nebo rozvržení na desktopu.

**Nechat to v React state a zachytávat `popstate`.**
Zamítnuto. Opravilo by to tlačítko zpět, ale poznámka by nebyla odkazovatelná ani by nepřežila obnovení stránky, a znamenalo by to udržovat vlastní model historie vedle toho v routeru.
