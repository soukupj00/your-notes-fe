# Synchronizace

Synchronizace sladí lokální úložiště zařízení se vzdáleným úložištěm (Remote), aby ostatní zařízení téhož člověka viděla stejné poznámky.
Aplikace nikdy nečte ze vzdáleného úložiště, aby něco zobrazila; čte lokální úložiště a synchronizace ho udržuje aktuální.
Tato stránka je pohled vývojáře; [synchronizace v referenční dokumentaci](../architecture/04-sync.md) obsahuje celý návrh a alternativy, které porazil.

## Model

**Last-writer-wins na úrovni poznámky, s ponecháním poražené verze** ([ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md)).

- Server drží pro každý synchronizovaný řádek **revizi**: počet změn, které přijal.
  Zařízení vždy jen hlásí revizi, kterou dostalo; nikdy si žádnou nevymýšlí.
- Push (odeslání změn), který nese zastaralou revizi, prohrává.
  Verze ze serveru se stane poznámkou a zařízení si svou vlastní verzi ponechá vedle ní jako novou, běžnou poznámku: **konfliktní kopii**.
  Má název `Groceries (conflict from Pixel 8, 2026-09-28)` a štítek „Conflicts“, takže místem, kde je člověk prochází, je existující zobrazení štítku.
- Synchronizace tak nikdy nezahodí, co někdo napsal; vyřešit konflikt znamená přečíst dvě poznámky a jednu smazat.

Vlastní revizi mají tři věci: poznámka (spolu s metadaty svých příloh), štítek a vazba NoteTag.
Vazba má vlastní revizi proto, aby označení poznámky štítkem v telefonu nikdy nebylo v konfliktu se psaním do ní na notebooku.
Bajty příloh žádnou nemají: pod daným id se zapisují jen jednou, takže jejich přenos je idempotentní `PUT`.

## Fronta offline změn je dotaz

Server je dlužen aktuální stav každého změněného řádku, ne historii toho, jak k němu došlo.
Každý zápis proto ve stejné transakci úložiště označí svůj řádek jako změněný (dirty) a fronta je prostě množina změněných řádků (`store.sync.dirty()`).
Deset offline úprav jedné poznámky dluží jeden push a neexistuje žádný druhý záznam, který by po pádu mohl s řádky nesouhlasit.

Mazání je jedinou výjimkou z pravidla „zápis je řádek“.
Přesunutí poznámky do koše je běžná změna pole a synchronizuje se jako každá úprava.
Řádek odstraní jen trvalé smazání a zanechá po sobě **tombstone** (záznam o smazání) nesoucí revizi, na které se zařízení naposledy shodlo se serverem, takže zastaralé trvalé smazání nemůže zahodit novější úpravu provedenou jinde.

## Jeden běh

`src/sync/engine.ts` spouští vždy jen jednu synchronizaci najednou:

1. **Push** toho, co je dlužné, po dávkách: poznámky před štítky, štítky před vazbami, vazby před tombstony.
   Server odpoví jedním výsledkem na řádek: `accepted`, `conflict` se svým vlastním řádkem, nebo `gone` pro id, které má tombstone.
   `conflict` u poznámky vytvoří konfliktní kopii; u štítku prostě vyhraje štítek ze serveru.
2. **Pull** (stažení změn) toho, co zařízení zmeškalo, stránku po stránce.
   Kurzorem je neprůhledný odkaz `next`, který vydal server; zařízení si ho uloží a nikdy samo neskládá URL.
   Kurzor, který je na server příliš starý, dostane odpověď `410` a zařízení se synchronizuje znovu od začátku: zahodí své čisté řádky a ponechá ty, které stále dluží.
3. **Přenos bajtů příloh.**
   Nahoru jde všechno, náhledy jako první.
   Směrem dolů přijdou náhledy hned, protože je potřebuje přehled; plné bajty přijdou, až je někdo otevře, pokud není zapnuté „Uchovávat všechny přílohy“.

`src/sync/loop.ts` rozhoduje, kdy synchronizaci spustit: při startu, chvíli po lokální úpravě, když se prohlížeč vrátí online nebo se karta stane viditelnou, když proud signálů ze serveru oznámí, že push provedlo jiné zařízení, a při pomalém pravidelném dotazování.
Běh, po kterém zůstane něco dlužné, odstoupí s dvojnásobnou prodlevou, takže selhávající server ho nikdy neroztočí naprázdno.
`SyncProvider` smyčku jen spouští a zastavuje; komponenty na synchronizaci nikdy nesahají.

## Předěl Remote

Engine mluví se dvěma rozhraními v `src/data/Remote.ts`, ne s HTTP.

- **`Remote`** je pouze replikace: `identity`, `push`, `pull`, `putBlob`, `getBlob` a volitelný proud `hints` pro živé aktualizace.
  Vzdálené úložiště bez `hints` se prostě pravidelně dotazuje.
- **`AccountService`** je vše, co se týká lidí: relace, zařízení, párovací odkazy, pozvánky, odkazy pro sdílení.
  Implementuje ho jen vlastní server a obrazovky účtu se vykreslí, jen když je nějaký nastavený.

Obě rozhraní jsou pro vlastní server implementována v `src/data/http/`.
Každá odpověď se parsuje schématy Zod z kontraktu protokolu, `src/contract/index.ts`, takže změna na serveru, která aplikaci rozbije, selže hlasitě na hranici.
Kontrakt patří do repozitáře serveru a sem ho kopíruje `pnpm contract:pull`; nikdy ho zde neupravujte.

Chcete-li synchronizovat s něčím vlastním, implementujte proti tomu `Remote` a předejte ho `App` v `src/main.tsx` místo `createHalRemote`.
Dnes se smyčka spustí, jakmile je přihlášen účet, a účet pochází z `AccountService`, takže vzdálené úložiště bez účtů potřebuje ještě malou změnu v `SyncProvider`, která mu dodá id účtu.

## Účty a lokální úložiště

- **Převzetí při prvním přihlášení.** Databáze, která nikdy nebyla připojena k účtu, označí všechny řádky jako dlužné a odešle je všechny; id jsou náhodná UUID, takže se nemohou srazit.
- **Smazání při odhlášení.** Odhlášení vymaže lokální úložiště, takže další člověk na sdíleném notebooku nikdy nepřevezme cizí poznámky.
  Dokud je cokoli dlužné, je odhlášení odmítnuto a místo toho nabídne zálohu.
- „Uloženo“ v editoru znamená uloženo lokálně; stav synchronizace se zobrazuje zvlášť, jako počet čekajících změn, v Nastavení.

## Testování

Engine i smyčka jsou testovány v `src/sync/` proti falešnému serveru postavenému ze stejného kontraktu, takže konflikty, opakované synchronizace i offline fronta jsou deterministické.
Dvě skutečná zařízení proti skutečnému serveru zůstávají ruční kontrolou.
