# 0009 - Model životního cyklu poznámky (stav, připnutí, barva, koš)

- Stav: přijato
- Datum: 2026-07-25

## Kontext

Až do M3 neměla poznámka žádný životní cyklus: smazání bylo okamžité a trvalé (jen s krátkodobým toastem pro vrácení zpět) a neexistovalo připnutí, archiv, barva ani obnovení.
M4 přidává organizaci na úrovni Google Keep - připínání, archivaci, obnovitelný koš a barvu pro každou poznámku.
To vše musí být na poznámce reprezentováno jednoznačně, musí se to dát levně dotazovat pro přehled, vyhledávání a pohledy a musí to zůstat dopředně kompatibilní se synchronizací v M5.
Úložištěm je Dexie/IndexedDB ([ADR 0001](./0001-local-first-storage-with-dexie.md)).

## Rozhodnutí

Životní cyklus se na poznámce modeluje takto:

- **`state: 'active' | 'archived' | 'trashed'`** - jediný výčet se vzájemně vylučujícími hodnotami (výchozí `'active'`).
  Poznámka nikdy není ve dvou stavech zároveň.
- **`pinnedAt?: string`** - nezávislé na `state` (přítomnost = připnutá; časové razítko ISO určuje pořadí připnutých poznámek).
  Má smysl jen ve stavu `active`; archivace nebo přesun do koše ho vymaže.
- **`color?: string`** - **klíč tokenu** palety (ne surová hodnota barvy), překládaný podle motivu, aby stejná poznámka vypadala správně ve světlém, tmavém i barvoslepém motivu.
- **`trashedAt?: string`** - nastaví se při přesunu do koše; úklid při spuštění **trvale smaže** poznámky v koši starší než 30denní ochranná lhůta a uvolní jejich přílohy, přičemž znovu využije stávající cestu úklidu osiřelých příloh (orphan GC).
  K dispozici je i ruční „Vysypat koš“.

Viditelnost: **aktivní** → přehled + vyhledávání; **archivovaná** → vyhledávání (s odznakem) + pohled Archiv, ale ne přehled; **v koši** → pouze pohled Koš, mimo přehled i vyhledávání.
Mrtvé, nepoužívané pole `checklist: string[]` se odstraňuje v rámci téhož zvýšení verze schématu.
Totéž zvýšení verze přidává token `Tag.color?` (štítky sdílejí paletu barev poznámek).

`pinnedAt`, `color` a `trashedAt` jsou volitelné a nepotřebují migraci, ale `state` ano: je indexované a IndexedDB neindexuje řádek, jehož indexovaná vlastnost je `undefined`.
Bez doplnění hodnoty do existujících řádků by každá poznámka z doby před v3 byla pro `where('state')` neviditelná a tiše by zmizela z přehledu.
Zvýšení verze na v3 proto nese jednorázový `.upgrade()`, který existujícím řádkům nastaví `state: 'active'` a smaže `checklist`.

## Zvažované možnosti

- **Booleany (`isPinned` / `isArchived` / `isTrashed`)** - zamítnuto: umožňují nepovolené kombinace (archivovaná *a zároveň* v koši), které výčet činí nereprezentovatelnými.
- **Připnutí jako součást výčtu `state`** - zamítnuto: připnutí je nezávislé na archivaci a koši (aktivní poznámka může, ale nemusí být připnutá), takže samostatné pole je poctivý model.
- **Uložení surové hodnoty barvy** - zamítnuto: nepřizpůsobila by se motivu ani variantám pro barvoslepé; token překládaný podle motivu udržuje barvu dekorativní a přístupnou.

## Důsledky

- Dotazy přehledu, vyhledávání a pohledů filtrují podle jediného pole `state` plus `pinnedAt` - jednoduché a vhodné pro indexy.
- Trvalé mazání po ochranné lhůtě zavádí mazání na pozadí, které uživatel přímo nespouští - zmírňuje to 30denní okno, viditelný pohled Koš a ruční vysypání.
- Jedno zvýšení verze Dexie přidává čtyři pole životního cyklu poznámky a volitelné `Tag.color`, odstraňuje `checklist` a nese malý `.upgrade()`, který doplní indexované `state`.
- Pojmy glosáře jsou zaznamenány v `CONTEXT.md` (State / Active / Archived / Trashed / Pinned / Color / Purge).
