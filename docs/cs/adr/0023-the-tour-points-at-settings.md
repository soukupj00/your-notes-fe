# 0023 - Průvodce ukazuje na Nastavení

- Stav: přijato (nahrazuje [ADR 0015](./0015-the-tour-drives-the-app-on-disposable-props.md))
- Datum: 2026-10-11

## Kontext

ADR 0015 dalo průvodci šest kroků: tři v přehledu a v editoru, tři v Nastavení.
První tři učily to, co aplikace na obrazovce učí sama.
Rychlé starty jsou viditelné ovládací prvky, akce karty jsou vidět trvale a zástupný text editoru říká „stiskněte „/“ pro příkazy“.
Text posledního kroku tvrdil, že každá poznámka žije jen na tomto zařízení a nikde jinde, což synchronizace mezitím vyvrátila.
Rekvizity, tedy tři poznámky, které průvodce založil a pak trvale smazal, existovaly jen proto, aby první tři kroky měly s čím pracovat.
Přinesly výchozí stavy v lokálním úložišti, úklid při každém spuštění, výjimku v synchronizačním enginu a jediné místo, kde aplikace smazala poznámku, o což nikdo nežádal.

## Rozhodnutí

**Průvodce má tři kroky, všechny v Nastavení, a nic nezakládá.**

1. Tvoje lišta: průvodce přejde do Nastavení a ukáže na náhled panelu nástrojů.
2. Tvoje rychlé starty: pořadí rychlých startů a strana tlačítka ＋.
3. Kde tvoje poznámky žijí: část „Úložiště a synchronizace“, která říká, že zařízení je na prvním místě, server udržuje zařízení v souladu a záloha do zipu je vždy k dispozici.

Průvodce dál ovládá skutečnou aplikaci: přechod do Nastavení je jeho úkon a odchod z něj je inverzní úkon.
Vše ostatní z ADR 0015, co se netýká rekvizit, platí dál: průvodce se nabídne jednou, každá navigace, kterou neprovedl on sám, ho ukončí, aplikace je po dobu jeho běhu `inert` a jeho pravidla zůstávají bez `driver.js` a Reactu.
Když část o synchronizaci nic nevykreslí (žádné Storage API a žádné přihlášené zařízení), krok 3 ukáže svůj text bez výřezu.

## Důsledky

- Průvodce nezakládá žádné poznámky, takže přehled je po průvodci stejně prázdný jako před ním.
- Rekvizita a trvalé smazání rekvizity mizí z `CONTEXT.md`; trvale se teď maže jen poznámka v koši.
- Obnovení stránky uprostřed průvodce nezanechá nic k úklidu, takže úklid při startu, výchozí stavy v `meta` i výjimka v synchronizačním enginu jsou pryč.
  Instalace, které prošly starým průvodcem, si mohou v `meta` ponechat zastaralý řádek `tourProps`, který nic nečte.
- Průvodce už neukazuje editor, nabídku lomítka ani zeď poznámek; to nesou vlastní ovládací prvky aplikace a zástupný text.
