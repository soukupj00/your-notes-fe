# 0010 - shadcn `Sidebar` jako navigační kostra

- Stav: přijato, doplněno 2026-10-21 (sbalená lišta ukazuje štítky)
- Datum: 2026-07-29

## Kontext

Až do M4 Slice 2 byla navigační kostra psaná ručně (`src/components/layout.tsx`): na desktopu trvalý `<aside className="hidden w-64 ... sm:block">` a na mobilu tentýž `SideNav` uvnitř `Dialog`, přestylovaného na zásuvku ukotvenou vlevo.
`navItems.ts` udržoval obě varianty v souladu.
Fungovalo to, ale desktopový postranní panel nešel sbalit a `Dialog` je pro zásuvku nesprávné primitivum.

Byl spuštěn `pnpm dlx shadcn@latest add sidebar`, který do projektu vendoroval `src/components/ui/sidebar.tsx`, `src/components/ui/sheet.tsx` a `src/hooks/use-mobile.tsx`.
Tato komponenta poskytuje jako sladěnou sadu sbalení na ikony, mobilní `Sheet`, lištu (rail) a tooltipy ve sbaleném stavu.
Zároveň s sebou nese několik předpokladů ze svého původu (aplikace v Next.js s SSR), které pro tento kód neplatí, a jejím tichým převzetím by se převzaly i ony.

## Rozhodnutí

Vendorovaný `Sidebar` se přijímá jako navigační kostra, a to celý, nikoli po kouscích, a kostra se kolem něj přestaví.

**Tvar kostry.** `SidebarProvider` obaluje `<Sidebar collapsible="icon">` a `<SidebarInset>` jako sourozence.
Postranní panel má plnou výšku a patří mu levý horní roh; `Navbar` se přesouvá *dovnitř* `SidebarInset` jako jeho řádek záhlaví a přichází o logo (to se stěhuje do `SidebarHeader`) i o slot `leading` pro hamburger (nahrazuje ho `SidebarTrigger`).
Náš `<main>` odpadá, protože `SidebarInset` už jeden vykresluje a dva landmarky `main` jsou porušením přístupnosti.

**Sbalená lišta ukazuje jen cíle navigace.** Čtyři `NAV_ITEMS` se sbalí do lišty široké `4rem` s tooltipy; seznam štítků je ve sbaleném stavu skrytý.
Lišta zůstává dost široká pro symetrické okraje položek `px-4` a nechává viditelný textový logotyp (wordmark), dokud ho nenahradí plánovaná značka loga.
Sbalení je gesto „vraťte mi obrazovku“, ne bezztrátové zhuštění.
Nastavení v postranním panelu záměrně chybí, protože jediným vstupem do něj je ozubené kolečko v horní liště.
Na mobilu toto kolečko otevírá rychlá nastavení s odkazem „Všechna nastavení“ na celou stránku Nastavení.

**Stav otevření žije v `localStorage`**, čte se synchronně v inicializátoru `useState` (vzor `ViewModeProvider`) a do `SidebarProvider` se předává přes jeho props `open`/`onOpenChange`.

**Jeden navigační breakpoint: 640px.**
`MOBILE_BREAKPOINT` v `use-mobile.tsx` se mění ze 768 na 640 a vlastní natvrdo zapsané breakpointy `md:` v `Sidebar` se mění na `sm:`.

**Barevné tokeny postranního panelu jsou aliasy stávajících sémantických tokenů**, místo aby zaváděly druhou paletu.

**Sedm záměrných úprav vendorovaného `src/components/ui/sidebar.tsx`**, každá s jednořádkovým komentářem přímo na místě:

1. Zápis `document.cookie` v `setOpen` je smazán.
2. Posluchač události keydown na window pro `Cmd/Ctrl+B` je smazán.
3. `md:` se mění na `sm:` (třídy viditelnosti desktopové větve a pomocné třídy pro dotykové cíle).
4. Na mobilním `SheetContent` je potlačen `onCloseAutoFocus`.
5. Natvrdo anglické `SheetTitle` / `SheetDescription` procházejí přes `t()`.
6. (V `use-mobile.tsx`, ne v `sidebar.tsx`) `MOBILE_BREAKPOINT` 768 → 640.
7. Mobilní zásuvka zabírá 70 % šířky viewportu a odstraňuje zděděný pravý okraj a obrys fokusu.

Zaznamenání těchto úprav je hlavní důvod, proč tento ADR existuje.
Budoucí čtenář najde vendorovaný soubor, v němž jsou smazané části, a bude rozumně předpokládat, že jde o omyly, nebo je „opraví“ opětovným spuštěním `shadcn add --overwrite`.
shadcn je generátor kostry kódu, ne závislost: tyto soubory jsou naše a neexistuje žádný upstream, od kterého by se mohly odchýlit.

## Proč jednotlivé úpravy vendorovaného kódu

**Cookie se jen zapisovala.**
`SidebarProvider` zapisuje `sidebar_state` při každém přepnutí, ale nic v této aplikaci ji nečte.
Cookie existuje, protože shadcn cílí na Next.js, kde ji čte serverová komponenta a předává ji dál jako `defaultOpen`, aby správná šířka byla už v prvním bajtu HTML.
Toto je SPA na Vite bez vykreslování na serveru, takže vždy vyhrálo `defaultOpen` a postranní panel při každém znovunačtení zapomněl volbu uživatele.
Nešlo tedy o „perzistenci, kterou je třeba přesunout“, ale o perzistenci, která nikdy neprobíhala, plus o cookie v offline-first PWA k vlastnímu hostování, která by při pozdějším bezpečnostním review vyvolala otázky.

**`Cmd/Ctrl+B` kolidovala s tučným písmem.**
Zkratka byla registrovaná na `window` s `preventDefault()`, takže se spustila dřív než editor.
V aplikaci na poznámky postavené na TipTapu, kde je `Bold` kanonické rozšíření podle vzoru A ([ADR 0004](./0004-canonical-editor-toolbar-pattern.md)), to rozbije tučné písmo v celé aplikaci.
Zkratka byla smazána, ne přemapována: nikdo o ni nežádal a `SidebarTrigger` je skutečný `<button>` v pořadí tabulátoru, takže uživatelé klávesnice nic neztrácejí.
Pokud bude později potřeba klávesová zkratka pro přepínání, má se přidat záměrně přes `react-hotkeys-hook`, vedle zkratky pro vyhledávání `mod+K` plánované v M4 Slice 3 Task 5.

**Dva breakpointy vytvořily mrtvé pásmo.**
`use-mobile.tsx` měl natvrdo 768, zatímco aplikace se přepíná na Tailwindovém `sm:` (640) na 63 místech, včetně hamburgeru, obou řádků `Navbar`, `QuickCaptureBar` a `NotesView`.
Mezi 640px a 767px vracel `useIsMobile()` hodnotu `true`, takže se postranní panel vykreslil jako `Sheet` mimo obrazovku, zatímco `sm:` už platilo, takže byl hamburger skrytý: **žádná navigace a nic, čím ji otevřít.**
Toto pásmo pokrývá běžné šířky tabletů na výšku.
Sjednotit jen konstantu nestačilo, protože desktopová větev `Sidebar` má vlastní `md:block` / `md:flex`, čímž by se mrtvé pásmo jen posunulo, místo aby se uzavřelo.

**Obnovení fokusu mařilo `useFocusOnMount`.**
Radix při zavření `Sheet` vrací fokus na spouštěcí prvek.
Klepnutí na navigační odkaz zároveň naviguje (připojí pohled, který zaměří svůj `<h1>`) i zavře zásuvku, takže fokus byl hned po příchodu stažen zpět na hamburger.
To odporuje kontraktu, který `useFocusOnMount` vynucuje napříč `NotesView`, `labels` a `settings`.
Potlačení obnovení nechá vyhrát nadpis cíle.
Cenou je, že zavření bez navigace (Esc, kliknutí na pozadí) teď nechá fokus na `<body>` místo na spouštěcím prvku; zavření navigací je u navigační nabídky převládající cesta a podmíněná implementace nebyla vyhodnocena jako hodná protahování stavu, dokud nebude důkaz, že na cestě přes Esc záleží.

**Přístupný název zásuvky nebyl přeložený.**
`SheetTitle` byl natvrdo anglický řetězec "Sidebar" - přístupný název celé navigační zásuvky v aplikaci, která se dodává v `en` a `cs`.

**Mobilní zásuvka potřebuje jednu vizuální hranici, ne tři.**
Překryv už navigaci od obsahu odděluje, takže zděděný pravý okraj a obrys fokusu prohlížeče v tmavém motivu vypadaly jako jasně bílý šev.
Zásuvka teď zabírá 70 % šířky viewportu a jako hranici využívá rozmazaný překryv a stín.

## Zvažované možnosti

- **Převzít jen `Sheet` pro mobil a ručně napsat sbalení na ikony pro desktop** - zamítnuto: použitelná lišta s ikonami potřebuje tooltipy, které se vykreslují jen ve sbaleném stavu, a to `SidebarMenuButton` už správně implementuje.
  Implementovali bychom to znovu a hůř.
- **Ponechat záhlaví přes celou šířku s postranním panelem pod ním** (současné uspořádání podobné Keepu) - zamítnuto: desktopová větev `Sidebar` je `fixed inset-y-0 h-svh`, takže by to znamenalo přepsat jeho základní pozicování hned první den a udržovat magické číslo výšky záhlaví, na kterém se musí shodnout dva soubory.
  Každá budoucí změna záhlaví (banner, indikátor offline) tuto aritmetiku znovu otevře.
  Navíc by nad sbalenou lištou zůstal hamburger a logo nad sebou, tedy dva navigační prvky v jednom rohu.
- **Ukládat stav otevření do blobu `settings` v Dexie přes `PreferencesProvider`** - zamítnuto ze dvou důvodů.
  Hydratace je asynchronní, takže by se postranní panel vykreslil na `16rem`, o snímek později skočil na `4rem` a odstrčil přehled do strany; jde o stejnou úvahu, jaká je už zaznamenaná pro `ThemeProvider` a `ViewModeProvider` v `src/context/CLAUDE.md`.
  Zásadnější je, že sbalení postranního panelu je volba podle typu konkrétního zařízení (sbalený na notebooku, rozbalený na velkém monitoru), takže synchronizovat ho v M5 napříč zařízeními by bylo vyloženě špatně.
- **Zobrazovat ve sbalené liště barevné tečky štítků** - zamítnuto: `Tag.color` je volitelné, takže štítek bez barvy se vykreslí jako prázdný šedý kroužek a dva štítky se stejnou položkou palety jsou na pixel stejné.
  Sloupec dvaceti takových teček se jmény jen v tooltipech je dekorace, která vypadá jako navigace.
  Lišta by se navíc musela posouvat, což maří smysl sbalení.
- **Vysouvací podnabídka štítků ve sbaleném stavu** - zamítnuto jako zatím nepotřebná složitost: chování při najetí myší, dotyku a ovládání klávesnicí by se muselo vyladit kvůli seznamu, který je v rozbaleném stavu vzdálený jedno kliknutí.
- **Převést HSL tokeny postranního panelu ze shadcn na OKLCH, nebo navrhnout nové ručně** - zatím zamítnuto: současný `<aside>` je prostý `background` + `border-r`, takže aliasy přesně reprodukují dnešní vzhled a tato změna zůstává změnou rozvržení, ne propašovaným přebarvením.
  Jedna paleta také znamená, že varianty pro barvoslepé (`PreferencesProvider.colorBlind`, deklarované, ale neimplementované) se do postranního panelu propíšou zadarmo, bez potřeby paralelní sady přepisů.
  Tónování je odloženo na průchod barevnými tokeny ve Slice 3 a zůstává změnou jednoho řádku na alias.

## Důsledky

- Navigační mrtvé pásmo 640-767px je uzavřené; celou kostru řídí jediný breakpoint.
- Stav sbalení postranního panelu teď skutečně přetrvává, což dřív neplatilo.
- Záhlaví je `sticky top-0`, takže vyhledávací pole, nabídka řazení a filtry štítků zůstávají v dlouhém přehledu dosažitelné.
  Na tom záleží, protože viditelný řádek s titulkem přehledu už byl dříve odstraněn ve prospěch ovládacích prvků vyhledávacího pole.
- Stín ve stavu po odrolování používá CSS animaci řízenou posouváním (`animation-timeline: scroll()`) uvnitř `@supports`, takže nestojí žádný JavaScript, žádný handler posouvání ani stub `IntersectionObserver` v nastavení testů.
  Podle MDN browser-compat-data je to k dispozici v Chrome/Edge/Samsung 115+ a Safari 26+ (desktop i iOS); Firefox to má jen v preview.
  Uživatelé Firefoxu dostanou lepivé záhlaví a jeho `border-b` bez stínu, což je přijatelná ztráta dekorativního náznaku hloubky, a až to Firefox vydá, nebude potřeba měnit kód.
- `Navbar` už neobsahuje značku a mobilní řádek ji záměrně vynechává, aby ubylo vizuálního šumu.
  Domovem loga je `SidebarHeader`.
Textový logotyp zůstává viditelný v obou stavech, dokud nebude k dispozici plánovaná značka loga, čímž se zachová výška záhlaví i identita aplikace ve sbaleném stavu.
- Spolu s tím se odstraňují tři mrtvé hooky (`use-window-size`, `use-isomorphic-layout-effect`, `use-unmount`); `use-debounce-callback` a jeho test zůstávají, protože se pravděpodobně budou hodit a jsou samostatně otestované.
- M4 Slice 3 Task 4 (sémantika, pořadí tabulátoru, odkaz pro přeskočení na obsah) teď přistává na kostře s jediným `<main>` a skutečnými prvky `nav`/`header`.
  Odkaz pro přeskočení, který tam vznikne, by měl cílit na `SidebarInset`.

## Doplněno 2026-10-21

První externí tester sbalil postranní panel a přišel o štítky, které byly jeho hlavním způsobem, jak filtrovat přehled.
Sbalená lišta proto teď ukazuje každý štítek jako jeho barevnou tečku, která stejně jako řádek v rozbaleném stavu vede na `/tag/$id`, a jméno štítku nese vlastní tooltip lišty.
Když se štítky nevejdou, lišta se posouvá, se skrytým posuvníkem, aby ikony zůstaly vystředěné.
Zamítnutá možnost výše cenu stále popisuje: štítek bez barvy je šedá tečka a dva štítky se stejnou barvou vypadají stejně, takže rozdíl nese tooltip a přístupné jméno.
Ve sbaleném stavu je jméno řádku dostupné jen čtečce obrazovky místo odstranění, takže každý odkaz v liště má přístupné jméno.
