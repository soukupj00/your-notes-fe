# 0001 - Lokální úložiště (local-first) s Dexie/IndexedDB

- Stav: přijato; upraveno rozhodnutím [ADR 0020](./0020-the-local-store-seam.md) (aplikace už nepřistupuje k Dexie přímo)
- Datum: 2026-06-15

## Kontext

Aplikace musí jako PWA plně fungovat offline a zůstat použitelná na mobilu i bez připojení k síti.
Poznámky, štítky a přílohy potřebují trvalé úložiště na straně klienta, které přežije znovunačtení stránky a podporuje reaktivní dotazy, aby se UI aktualizovalo spolu se změnou dat.
Budoucí vlastní server bude tato data synchronizovat, ale v režimu offline musí být zdrojem pravdy zařízení.

## Rozhodnutí

Jako lokální úložiště se použije **IndexedDB**, ke kterému se přistupuje přes **Dexie** (`src/db/db.ts`, `NotesDB`), a pro reaktivní čtení **`dexie-react-hooks` `useLiveQuery`**.
Všechny entity (poznámky, štítky, NoteTags, obrázky, zvuky, soubory) jsou tabulky Dexie.
Aplikace je local-first: čte a zapisuje přímo do Dexie; synchronizace (M5) bude Dexie se serverem slaďovat, nikoli ho nahrazovat.

## Důsledky

- Reaktivní UI zdarma díky `useLiveQuery`; pro data poznámek není potřeba žádná samostatná knihovna pro klientskou cache nebo stav.
- Synchronizace musí být navržena jako slaďování vůči Dexie, včetně řešení konfliktů a fronty změn - metadata synchronizace (příznaky neodeslaných změn, tombstony neboli záznamy o smazání) se přidají do schématu (viz `src/db/PLAN.md`).
- Změny schématu vyžadují zvýšení verze Dexie a migrace, aby se zachovala uživatelská data.
- Velké přílohy uložené v IndexedDB otevírají rozhodnutí, zda je ukládat jako Blob, nebo jako base64 (odloženo na M3).
- Testy potřebují mimo prohlížeč náhradu (shim) IndexedDB - `fake-indexeddb` už používá seeder a bude podkladem i pro datové testy.
