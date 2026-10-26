# 0024 - Uvítání při spuštění, průvodce v Nastavení

- Stav: přijato (nahrazuje [ADR 0023](./0023-the-tour-points-at-settings.md))
- Datum: 2026-10-21

## Kontext

ADR 0023 nabízelo tříkrokového průvodce při prvním spuštění a kvůli němu vzalo uživatele z přehledu do Nastavení.
Tester při prvním uživatelském testu chtěl místo toho dva průvodce: jednoho pro hlavní stránku a ten současný až při prvním otevření Nastavení.
Přeskočení průvodce navíc testera vrátilo do přehledu, pryč z Nastavení, která mu průvodce právě ukázal.
To průvodce vracel vlastní navigaci, jak ho ADR 0023 navrhlo, ale působilo to jako vyhození.

## Rozhodnutí

**Při spuštění se ukáže uvítání a průvodce čeká na první návštěvu Nastavení.**

- **Uvítání** je jedna vrstva nad přehledem: krátký pozdrav a dvě značky, z nichž každá vyřízne jeden ovládací prvek a řekne, k čemu je, lištu pro zachycení (na telefonu tlačítko ＋) a ozubené kolo Nastavení.
  Není to průvodce: nic se nekrokuje a jedno stisknutí (nebo Esc) ho zavře.
  Nabídne se jednou a při nabídnutí se zapíše do `welcomeSeenAt`.
- **Průvodce** si nechává své tři kroky v Nastavení, ale už nenaviguje.
  Nabídne ho první návštěva Nastavení a při nabídnutí se zapíše do `onboardingSeenAt`; Hotovo i Přeskočit nechají uživatele tam, kde je, v Nastavení.
  „Spustit průvodce znovu“ v Nastavení ho přehraje na místě.

Co ADR 0015 a 0023 o průvodci říkají jinak, platí dál: každá navigace, kterou neprovedl on sám, ho ukončí, aplikace je po dobu jeho běhu `inert`, čeká se na podmínky v DOM a nikdy na časovače a `src/lib/tour/` neimportuje `driver.js` ani React.
Uvítání se řídí stejnými pravidly a své výřezy kreslí samo místo přes `driver.js`, který zvýrazní vždy jen jeden prvek.

## Důsledky

- Průvodce už nemá scény, do kterých by vstupoval a ze kterých by odcházel, takže z jeho kroků zmizely `enter`, `exit` a `continues` a s nimi i označování navigací a `resetScroll`.
- Dvě nezávislá razítka: instalace, která viděla starého průvodce při spuštění, uvidí uvítání jednou a průvodce už nabídnut nedostane.
- Text uvítání a jeho dvě značky jsou prvním návrhem; vyhledávání vynechané, protože na počítači by jeho bublina ležela na bublině lišty pro zachycení.

## Dodatek (2026-10-25): kroky ukazují na úvodní stránku Nastavení

Nastavení se stalo úvodní stránkou s řádky, z nichž každý otevře podstránku (Obecné, Panel nástrojů editoru, Rychlé psaní, stránka dat, Účet, Klávesové zkratky).
Průvodce se nabídne při první návštěvě úvodní stránky, ne podstránky, a jeho tři kroky ukazují na její řádky Panel nástrojů editoru, Rychlé psaní a řádek dat.
Průvodce dál nikdy nenaviguje, takže nemůže otevřít podstránku a ukázat do ní; řádek říká, kde které nastavení je, a text kroku vyzve k jeho otevření.
Řádek dat se vykreslí na každém zařízení, přihlášeném i nepřihlášeném, takže krok 3 má teď vždy výřez; dřív jeho sekce bez Storage API nebo účtu nevykreslila nic a krok ukázal jen svůj text.
