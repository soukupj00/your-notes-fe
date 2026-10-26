# 0028 - Ovládací prvky pro klávesnici si vyslouží hardwarová klávesa

- Stav: přijato, doplňuje [ADR 0016](./0016-width-decides-layout-pointer-decides-affordances.md)
- Datum: 2026-10-25

## Kontext

ADR 0016 nabízí nápovědy klávesnice jen přesnému ukazateli, protože telefon nemá klávesy, které by šlo stisknout.
Dotykový tablet v pouzdře s klávesnicí je případ, který mu uniká: jeho hlavní ukazatel je hrubý, takže nedostal odznaky zkratek, klávesu pro novou poznámku ani stránku Klávesové zkratky, i když má všechny klávesy, které má notebook.
Žádný media query klávesnici neohlásí, takže ji zastupoval ukazatel.

## Rozhodnutí

**Ovládací prvky pro klávesnici se nabízejí přesnému ukazateli, nebo jakmile se v této relaci stiskne hardwarová klávesa.**

- Odpovídá na to `useKeyboardAffordances`; co se počítá, rozhoduje `isHardwareKey` (`lib/hardware-key.ts`).
- Klávesa se počítá, když mohla přijít jen z hardwarové klávesnice: tisknutelná klávesa, šipka, Tab nebo Escape mimo pole, nebo jakákoli klávesa s drženým Ctrl, Cmd nebo Alt.
  Klávesa napsaná do pole se sama nepočítá nikdy, protože tam píše i softwarová klávesnice; nepočítá se ani nedůvěryhodná událost, skládání v IME ani androidí `Unidentified`/229.
- Co bylo viděno, se drží v `sessionStorage`: obnovení stránky ve stejné kartě to zachová, nová karta nebo nové spuštění, kdy může být klávesnice odpojená, začíná bez toho.
- Klávesa pro novou poznámku se ptá až při stisku, takže první N ovládací prvky zapne a zároveň otevře poznámku.
  WCAG 2.1.4 platí dál: stránka Klávesové zkratky, kde se klávesa vypíná, se objeví se stejným stiskem.
- Klávesnici následují: odznaky zkratek, nápovědy v tooltipech, klávesa pro novou poznámku, stránka Klávesové zkratky a zaměření nadpisu existující poznámky při otevření.
  Co rozhoduje ukazatel, zůstává u ukazatele: Soubor místo Fotoaparátu v rychlém zápisu a šířková třída lišty editoru.

## Zvažované možnosti

- **Uložit viděnou klávesu natrvalo (`localStorage`).**
  Zamítnuto: tablet bez pouzdra by ukazoval nápovědy ke klávesám, které už nemá, dokud by je něco nevynulovalo.
- **Zapnout při jakémkoli stisku klávesy.**
  Zamítnuto: softwarová klávesnice iPadu posílá do pole skutečné klávesy, takže hledání by zapnulo nápovědy na zařízení bez klávesnice.

## Důsledky

- Na dotykovém zařízení se nápovědy objeví po první hardwarové klávese, nikdy dřív.
- Obnovení stránky je zachová, takže stránka Klávesové zkratky otevřená po obnovení se vykreslí; nová karta začíná bez nich až do své první klávesy.
- Šířková třída se nemění: tablet s klávesnicí si nechá úzkou lištu editoru, jejíž 44px pozice odpovídají dotykové obrazovce, ne klávesám.
