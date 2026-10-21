# 0017 - Last-writer-wins na úrovni poznámky, poražená verze zůstává jako konfliktní kopie

- Stav: přijato, doplněno 2026-08-30
- Datum: 2026-08-12

## Kontext

M5 synchronizuje local-first aplikaci s vlastním serverem.
Dvě zařízení mohou upravovat stejnou poznámku, zatímco je jedno z nich offline, takže milník nemůže začít, dokud není rozhodnuto, co se pak stane.
Je to jediné rozhodnutí o synchronizaci, které nešlo odložit do repozitáře backendu ([ADR 0002](./0002-separate-frontend-backend-repositories.md)): určuje schéma Dexie v tomto repozitáři a určuje, zda REST API vůbec stačí.

Bojuje se o tělo poznámky.
Je to jeden HTML řetězec ([CONTEXT.md](https://github.com/soukupj00/your-notes-fe/blob/main/CONTEXT.md)), psaný v TipTapu, a každý bohatší prvek - přílohy, seznamy úkolů - žije uvnitř něj, ne vedle.
Strategie slučování, která řeší `header`, `color` a `state` nezávisle, se tedy konfliktu, který skutečně nastává, vůbec nedotkla.

## Rozhodnutí

**Server drží revizi pro každou synchronizovanou věc. Push nesoucí zastaralou revizi je odmítnut; verze ze serveru se stane poznámkou a vlastní verze zařízení se uchová vedle ní jako obyčejná poznámka - konfliktní kopie.**

Synchronizace proto nikdy nezahodí nic, co uživatel napsal.
Vyřešit konflikt znamená přečíst dvě poznámky a jednu smazat, a to dělá člověk, ne aplikace potichu.

### Hranicí revize je poznámka, metadata jejích příloh a nic jiného

Příloha patří právě jedné poznámce (`Attachment.noteId`, kaskádové mazání) a nemá samostatný život, takže její metadata jedou na revizi poznámky.

Štítek samostatný život má - `CONTEXT.md` to výslovně říká - takže štítek je samostatná synchronizovaná věc s vlastní revizí.

Vazba NoteTag je také samostatný synchronizovaný řádek, a to je jediná část granularity, která je pořízena záměrně.
Scénář: psaní do poznámky na notebooku a současné klepnutí na „＋ Štítek → Work“ u stejné poznámky na telefonu.
Kdyby vazby na štítky jely na revizi poznámky, to nevinné klepnutí by vyrobilo duplicitní kartu.
Přidání štítku nesmí nikdy kolidovat s psaním.

### Bajty příloh se zapisují jednou

Jediný flow v aplikaci, který přepisoval bajty existující přílohy, bylo uložení v Excalidraw.
To se mění tak, že uložení vytvoří *novou* přílohu a přesměruje na ni tělo poznámky, přičemž starý řádek nechá úklidu osiřelých příloh, který už existuje.

Každý blob v systému je pak podle id neměnný, což znamená, že přenos blobů je „nahraj, pokud server toto id nemá“ - idempotentní `PUT`, bez rev, bez pravidla pro konflikty a bez možnosti, že by se dvě zařízení neshodla na tom, co dané id obsahuje.

### Smazání je tombstone, ale smazání jsou vzácná

Kvůli [ADR 0009](./0009-note-lifecycle-model.md) je přesun poznámky do koše aktualizace pole `state`, ne smazání, takže okno pro vrácení se synchronizuje jako každá jiná úprava.
Tombstone (záznam o smazání) se zapisuje jen při trvalém smazání.
Tombstony na serveru po omezené době (90 dní) expirují; zařízení, jehož kurzor je starší než toto okno, se to dozví a stáhne znovu všechno, přičemž zahodí své čisté řádky a ponechá si ty změněné.

## Důsledky

- **REST API dál stačí.** Nic tu nepotřebuje trvalý socket, díky čemuž zůstává závazek REST/HATEOAS ze zadání práce poctivý, a ne dekorativní.
- **Schéma Dexie získává `rev` a příznak změny na každém řádku, plus store `tombstones`.** Žádná metadata pro slučování, žádná časová razítka po polích, žádný log operací.
- **Fronta offline změn je množina, ne log** - viz glosář. Server má dostat aktuální stav každého změněného řádku, takže deset offline úprav jedné poznámky znamená jeden push.
- **Konfliktní kopii je potřeba zviditelnit, jinak je neviditelná.** Je to obyčejná poznámka, takže potichu přistane v přehledu. Proto dostane štítek „Conflicts“ a nadpis se jménem zařízení, ze kterého pochází, a datem, díky čemuž se stávající obrazovka `/tag/$id` zadarmo stává místem pro kontrolu.
- **Souběžné úpravy jedné poznámky neztratí žádný text, ale vytvoří duplikát.** To je poctivá cena a je to způsob selhání, kterému uživatel rozumí a dokáže ho napravit.

## Zvažované alternativy

**Slučování na úrovni polí.**
Zamítnuto. Čistě vyřeší `header`, `color`, `pinnedAt` a `state` a tělo poznámky - to, v čem lidé skutečně kolidují - nechá stejně na last-writer-wins.
Časová razítka po polích na každém řádku jsou za to špatný obchod.

**CRDT (Yjs) pro tělo poznámky.**
Zamítnuto, a protože jde o technicky lepší slučování, zamítnutí si zaslouží záznam.
Z dokumentu Yjs by se stala skutečná poznámka a z HTML z TipTapu *odvozená cache* - a toto HTML čtou náhledy na kartách, vyhledávání Fuse.js, zip záloha a každý odkaz `data-attachment-id` v aplikaci.
Jeho přirozeným transportem je WebSocket, ne REST API, ke kterému se zadání zavazuje.
Byla by to největší samostatná věc v M5 a konkurovala by skutečnému cíli milníku, kterým je synchronizace, kterou průměrný člověk dokáže nastavit a spolehnout se na ni.
Zůstává k dispozici jako pozdější upgrade jen pro tělo poznámky: revize a konfliktní kopie by pro všechno kolem zůstaly správné.

## Doplněno 2026-08-30

Znovu vyhodnoceno od začátku proti širší množině kandidátů (CouchDB + PouchDB, RxDB, Yjs + Hocuspocus, PocketBase, Zero, ElectricSQL, PowerSync a sedm transportů) s explicitními vstupními podmínkami a váženými kritérii; poznámky jsou v [`docs/sync-evaluation.md`](https://github.com/soukupj00/your-notes-fe/blob/main/docs/sync-evaluation.md), text práce v `ni-dip-thesys/text/design/sync.tex`; podložená zjištění jsou uložena spolu s materiály k práci, mimo tento repozitář.
Rozhodnutí platí a doplňuje se takto:

- **SSE je součástí návrhu.** „REST API dál stačí“ platí i nadále pro data; živá aktualizace je signál přes `text/event-stream`, jehož `id` události je pořadové číslo (Sequence) změny, a polling je spouštěčem dohnání změn i záložním řešením. Ve frontendu je to jedna volitelná metoda na seamu `Remote`.
- **Zastaralý push je `412 Precondition Failed` proti `If-Match`**, s revizí jako `ETag` řádku, místo 409.
- **Proud změn (change feed) má pořadové číslo (Sequence) pro každý účet**, odlišné od revizí jednotlivých řádků; neprůhledný kurzor i id události SSE jsou toto pořadové číslo.
- **Background Sync je vylepšení, nikdy záruka**; Safari ho nepodporuje. Web Push je zamítnut jako relay třetí strany.
- **Id zůstávají UUIDv4**; UUIDv7 bylo zváženo a nepřijato.
