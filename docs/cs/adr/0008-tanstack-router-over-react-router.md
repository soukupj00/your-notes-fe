# 0008 - TanStack Router místo React Routeru

- Stav: přijato
- Datum: 2026-07-25

## Kontext

Až do M3 byla aplikace fakticky jediný pohled (`App.tsx` vykresluje `NotesHome`); klientský router neexistoval.
M4 přináší více cílů navigace - Archiv, Koš, Nastavení (s podsekcí štítků), přehledy filtrované podle štítku a případně přímé odkazy na jednotlivé poznámky - a rozhraní pokročilého vyhledávání, jehož stav (fulltextový dotaz, režim řazení, aktivní filtry štítků, rozsah podle stavu životního cyklu) by mělo jít sdílet, přežít obnovení stránky a fungovat s tlačítkem Zpět.
To přesouvá stav vyhledávání, filtrů a životního cyklu do URL.
Projekt upřednostňuje kvalitu, robustnost a dlouhodobou udržovatelnost před náklady na vývoj a pro validaci už používá Zod v4.

## Rozhodnutí

Jako klientský router se místo React Routeru použije **TanStack Router** (routování podle souborů, strom rout generovaný jeho pluginem pro Vite).
Routy: `/`, `/archive`, `/trash`, `/settings` (+ `/settings/labels`), `/tag/:id` a volitelně `/note/:id`.
Stav vyhledávání, filtrů, řazení a životního cyklu žije v **typovaných, validovaných search params**: `validateSearch` každé routy přímo přebírá schéma Zod (adaptér není potřeba, protože projekt je na Zod v4) a middleware `retainSearchParams` zachovává relevantní parametry napříč navigací.

## Zvažované možnosti

- **React Router** - vyspělý, všudypřítomný, s nižší vstupní bariérou pro přispěvatele do open-source projektu.
  Jako hlavní volba zamítnut, protože jeho práce se search params stojí na řetězcích (`useSearchParams` → `URLSearchParams`) a vyžaduje ručně psané parsování a validaci všude, kde se čte stav vyhledávání a filtrů - a právě na tuto oblast M4 spoléhá nejvíc.
- **Žádný router / kontext se stavem pohledu** (jako stávající `ViewModeProvider`) - nejjednodušší, ale vzdává se adresovatelnosti přes URL, přímých odkazů a navigace zpět/vpřed v prohlížeči a s přibývajícími pohledy přestává stačit.

## Důsledky

- Vyhledávání, filtr štítků, řazení a rozsah životního cyklu se stávají typově bezpečným stavem v URL - sdílitelným a obnovitelným - což je páteř práce na pokročilém vyhledávání v M4.
- Přibývá krok generování stromu rout při buildu (plugin pro Vite) a novější, menší ekosystém než u React Routeru; přispěvatelé se musí naučit konvence TanStacku.
- Typová bezpečnost rout a parametrů od začátku do konce zachytí chyby už při kompilaci napříč rostoucí sadou pohledů.
- Přijatý kompromis: víc počáteční ceremonie a méně rozšířená knihovna výměnou za pohodlnou práci s typovaným stavem v URL, která se vyplácí v každé funkci M4.
