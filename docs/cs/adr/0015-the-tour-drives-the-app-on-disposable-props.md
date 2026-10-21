# 0015 - Průvodce ovládá aplikaci na jednorázových rekvizitách

- Stav: přijato
- Datum: 2026-08-09

## Kontext

Položka 12 milníku M4 požaduje tutoriál při prvním spuštění, který zvýrazní část aplikace, ukáže na ni a dovede uživatele k přizpůsobení, které Nastavení získalo v položce 11.
Plán slice se rozhodl pro tematizovaný spotlight z `driver.js` místo ručně psaného a zbytek nechal jako seznam povrchů, na které ukázat.

Důkladné prověření tohoto plánu proti hotové aplikaci odhalilo tři problémy, seřazené vzestupně podle toho, jak moc mění návrh.

**Na obrazovce není nic, na co ukázat.**
Při opravdu čerstvé instalaci je přehled prázdný: `NoteContent.tsx` vykreslí blok `notes.empty.active` a databázi nic nenaplní.
Krok plánu, který zvýrazňuje „akce životního cyklu poznámky (připnout/barva/archivovat/koš)“, by vyřízl spotlight nad prázdným plátnem.
Tatáž prázdnota činí zeď, přeskládání po připnutí a přepínač Masonry/Stack - tři z nejcharakterističtějších chování systému podle `DESIGN.md` - neviditelnými právě na té obrazovce, která vytváří první dojem.

**Plán utrácí kroky za samozřejmé a vynechává nebezpečné.**
Tři z pěti kroků pokrývají vytvoření, hledání a práci s poznámkou.
Všechny tři ohlašují viditelné ovládací prvky: lišta pro rychlé zachycení je na obrazovce, vyhledávací pole vykresluje vlastní nápovědu `mod+K` a akce karty jsou vidět trvale, ne až po najetí myší (`NoteCard.tsx` podmiňuje najetím jen dekorativní zvětšení a stín).
Mezitím nic neřekne novému uživateli, že jeho poznámky žijí **jen v tomto prohlížeči**, což je jediný fakt, jehož neznalost ho může stát všechno, co napsal, když smaže data webu nebo změní počítač.

**Prohlídka přehledu učí rám, ne obraz.**
Většina této aplikace je v editoru: slash menu, vložené obrázky, zvuk, video, soubory, kresby v Excalidraw, seznamy úkolů a panel nástrojů přizpůsobitelný pro každou šířkovou třídu.
Průvodce, který nikdy neotevře poznámku, to všechno přeskočí.

Pod všemi třemi leží těžší otázka: má onboarding aplikaci *popisovat*, nebo ji *ukazovat*?
Ukazování je to, co si uživatelé opravdu zapamatují, a běžný způsob, jak ukazovat, je nahrané video.
To kontakt s touto aplikací nepřežije.
Klip má zapečený jazyk UI, motiv i poměr stran, takže pokrytí `en`+`cs` × světlý+tmavý × mobil+desktop znamená osm nahrávek na krok, čtyřicet v bundlu offline-first PWA, a všechny zastarají, jakmile se příště posune nějaký ovládací prvek.
Navíc nemůže uživateli ukázat jeho vlastní motiv, což je celá teze „mění své světlo“ z `DESIGN.md`.

## Rozhodnutí

**Průvodce ovládá skutečnou aplikaci a předvádí ji na rekvizitách, které vytvoří a trvale smaže.**

Každý krok provede gesto, které popisuje - otevře speed dial, otevře poznámku, připne kartu a nechá zeď přeskládat, přejde do Nastavení - zatímco uživatel jen mačká Další, Zpět nebo Přeskočit.
Nic se nepřehrává samo a žádný krok na uživatele nečeká.

### Bezpečnost zajišťují rekvizity

Loutkový průvodce ovládající skutečná uživatelská data by byl nepřijatelný: připínal by, barvil a otevíral poznámky, na kterých někomu záleží.
Průvodce proto na začátku vytvoří tři rekvizity (`CONTEXT.md`), na konci je trvale smaže a pracuje jen s nimi.
Připnutí rekvizity, její obarvení, otevření - nic z toho nemění nic, co uživatel vlastní, a všechno to vrátí úklid.

Úklid je zase bezpečný díky třem pravidlům:

1. **Trvale maže, nepřesouvá do koše.** Rekvizita v koši by uživateli nechala tři záhadné poznámky k objevení a vyčištění, což je horší, než neuklízet vůbec.
2. **Upravená rekvizita není rekvizita.** Jakmile rekvizita obsahuje uživatelův text, patří jemu a úklid ji nechá být.
3. **Osiřelé rekvizity se uklidí při příštím načtení.** Obnovení stránky nebo zavřená karta prohlížeče v kroku 2 ukončí průvodce bez úklidu, takže rekvizity žijí v blobu předvoleb, a ne v React state, a příští spuštění uklidí, co předchozí běh opustil.

Pravidlo 2 vyžaduje péči, protože jeho naivní verze je špatně.
Porovnávat `updatedAt` s tím, co průvodce *založil*, selže okamžitě: krok 3 rekvizitu připne a krok 2 do ní může psát, takže při úklidu vypadá každá rekvizita jako upravená a nic by se trvale nesmazalo - což vytvoří přesně ten nepořádek, kterému mají rekvizity zabránit.
Výchozí stav proto vlastní průvodce, ne založení: `tourProps` ukládá `{ id, updatedAt }` a průvodce po každém svém vlastním úkonu znovu zaznamená `updatedAt`.
Úklid trvale smaže jen rekvizity, které stále odpovídají výchozímu stavu, který naposledy nastavil sám průvodce, což zůstává správné bez ohledu na to, jak volně úkony zapisují a kolik kroků se později přidá.

### Nic není nahrané, takže nic nemůže zastarat

Protože průvodce *je* aplikace, má automaticky správný jazyk, motiv, režim pro barvoslepé, hustotu i šířkovou třídu a nemůže popisovat tlačítko, které se přesunulo.
To je vlastnost, kterou nahrané video nemůže mít za žádnou cenu.

### Scénář je oddělitelný od spotlightu

Seznam kroků, jejich úkony `enter`/`exit`, zakládání a úklid jsou obyčejné jednotky bez `driver.js`; `driver.js` je za nimi tenký adaptér.
Nejde o spekulativní oddělení - právě to umožňuje funkci vůbec testovat, protože jsdom vrací nulové obdélníky a jediný skutečný způsob selhání spotlightu nevidí.

`driver.js` samotný je potvrzen, ne znovu otevřen.
Vyřezává otvor do **SVG overlaye** (overlay dostane `pointer-events: none`, cíl `pointer-events: auto`), místo aby cíli zvýšil `z-index`.
Tady to konkrétně záleží: každá karta v masonry je `m.li` s transformací x/y, a tedy s vlastním stacking contextem, takže spotlight založený na `z-index` - po kterém by naivní ruční řešení sáhlo - by zvýrazněnou kartu nechal ztmavenou pod scrimem.

Dvě mezery se záplatují, místo aby se s nimi žilo.
`driver.js` vykresluje vlastní markup popoveru, takže se do něj přes `onPopoverRender` portáluje React, což dává skutečnou komponentu `Button`, skutečné `useTranslation`, poctivé počítadlo „3 z 6“, ohlášení kroku přes `aria-live` a odsazení pro safe area, o kterém jeho vlastní polohovací engine nic neví.
A protože žádný krok nepotřebuje, aby uživatel na aplikaci sáhl, je po dobu běhu průvodce všechno označeno jako `inert` - každý přímý potomek `document.body` kromě vlastního portálu popoveru, ne jen kořen aplikace, protože Radix portáluje do `body` a dialog editoru by jinak unikl.
To se vyplatí třikrát: Tab cykluje uvnitř popoveru bez knihovny pro focus trap, ztlumené UI je nedosažitelné klávesnicí i ukazatelem a v kroku s editorem se nemůže vysunout softwarová klávesnice.
To poslední je to, co by jinak bolelo.
Editor si automaticky bere fokus a `index.html` obsahuje `interactive-widget=resizes-content`, takže na telefonu by krok 2 zmenšil vizuální viewport na polovinu a popover by po zbytek průvodce bojoval s panelem nástrojů, na který ukazuje - a to na primární platformě aplikace.

### Úkony čekají na stav, nikdy na časovače

Omezení pohybu je v `DESIGN.md` tvrdý vypínač, takže každá doba trvání v aplikaci může být nulová.
Krok, který na speed dial čeká 300ms, je špatně oběma směry.
Každé `enter()` čeká na podmínku v DOM, kterou skutečně potřebuje.

### Průvodce se nabídne jednou, ne do dokončení

`onboardingSeenAt` se zapíše, když se vykreslí krok 1, ne při dokončení.
Zaznamenat stojí za to fakt, že průvodce byl *nabídnut*; příznak zapsaný při dokončení se znovu aktivuje po každém obnovení stránky, pádu, zavřené kartě a tlačítku zpět, a tutoriál, který se objeví znovu poté, co jste ho zavřeli, je to nejotravnější, co tato funkce může udělat.
„Spustit průvodce znovu“ v Nastavení je záměrná cesta zpět.

Jakákoli navigace, kterou průvodce sám nespustil, ho ukončí.
Uživatel, který stiskne zpět, odešel; průvodce s ním o router nebojuje.

## Důsledky

- **Aplikace na chvíli vytváří poznámky, o které uživatel nežádal.** To je ta překvapivá část a důvod, proč toto ADR existuje. Omezují ji výše uvedená pravidla pro rekvizity: tři poznámky, na konci trvale smazané, nikdy se nedotknou ničeho upraveného.
- **Po skončení průvodce je přehled prázdný.** Prázdná obrazovka při studeném startu se o pár minut odkládá, ne odstraňuje. Text prázdného stavu to už zvládá.
- **Rekvizity nenesou žádné štítky ani přílohy.** Štítek rekvizity by přežil úklid a zůstal v postranním panelu, a trvale smazat štítek, který uživatel mezitím mohl přidat jinam, je horší problém než ho nepředvést; příloha rekvizity by byla blobem, který po celou dobu instalace jede v každé zip záloze a v synchronizaci M5. Krok 3 proto štítky zmiňuje v textu, aniž by nějaký ukázal.
- **Krok může působit na stav, který si pak uživatel ponechá.** Rekvizita, kterou uživatel během průvodce upraví, úklid přežije a zůstane na jeho zdi, což je správně, ale znamená to, že „objeví se tři poznámky a pak zmizí“ neplatí vždy.
- **Kroky jsou uspořádané závislosti, ne seznam.** Krok 4 opouští přehled kvůli `/settings`, takže posloupnost už nelze volně přeskupovat a Zpět musí úkon vrátit, ne jen snížit index.
- **V tomto slice se zapojuje Playwright.** `CLAUDE.md` vyžaduje akceptační test před uživatelským flow a tohle je ta nejvíc flow práce v M4; jsdom nevidí otvor vyříznutý nad ničím. Spec průvodce je první a synchronizace v M5 harness zdědí.
- **`CONTEXT.md` získal dva pojmy a trvalé smazání se rozšířilo.** Trvalé smazání dříve znamenalo jen konec životního cyklu v koši; rekvizita se trvale maže ze stavu aktivní, okamžitě, bez ochranné lhůty.

## Zvažované alternativy

**Uvítací knihovna, kterou si uživatel ponechá.**
Zamítnuto při prověřování ve prospěch rekvizit.
Založené poznámky, které zůstanou, vyřeší problém prázdného plátna a pak uživateli hned první den naloží úklid a nutí cíl každého kroku k obezřetnosti vůči poznámce, kterou mohl před měsíci smazat.

**Nahrané video nebo GIF pro každý krok.**
Zamítnuto. Kombinatorická cena výše (jazyk × motiv × breakpoint), váha bundlu v offline-first PWA a jistota zastarání.

**Syntetická animovaná replika v popoveru.**
Zamítnuto. Je to druhé UI, které se musí udržovat souběžně se skutečným, zaručeně se rozejde a žádá uživatele, aby sledoval kreslený film o aplikaci, která leží přímo za ním.

**Statický spotlight průvodce, který jen popisuje.**
Zamítnuto jako nejslabší podoba funkce, a ta, kterou uživatelé prokazatelně proklikají. Pokud vůbec stojí za to průvodce stavět, je jeho úkolem odhalit, co *není* objevitelné - přizpůsobitelný panel nástrojů, přeskupitelné rychlé starty, paletu pro barvoslepé a fakt, že data jsou lokální - a popsat to v titulku je přesně to, co už dělá stránka Nastavení.

**Ruční spotlight nad `@floating-ui/dom` + Radix + Motion.**
Zamítnuto, i když všechny tři už jsou závislostmi. SVG výřez je ta opravdu těžká část a `driver.js` ji řeší správně v 5kb; portálovaný popover vrací věrnost komponent a přístupnost, které byly jedinými skutečnými argumenty pro ruční řešení.
