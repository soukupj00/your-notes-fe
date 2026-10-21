# Položky a skupiny panelu nástrojů místo plochého seznamu tlačítek

Přizpůsobitelný panel nástrojů byl plánován jako `prefs.toolbar: string[]` s názvy rozšíření TipTapu, ale názvy rozšíření nejsou tlačítka (`heading` dává tři, `textAlign` tři, `history` dvě), takže tento tvar neumí vyjádřit „jen H1“, „všechny tři nadpisy“ ani „jednu rozbalovací nabídku nadpisů“.
Zavádíme registr **položek panelu nástrojů** s vlastním stabilním prostorem id, seskupujeme položky do **skupin**, které se zobrazují buď rozbalené, nebo sbalené, a pro každou **šířkovou třídu** ukládáme jedno **rozvržení panelu nástrojů** jako strukturované záznamy po skupinách místo plochého pole id.
Číslovaná rozhodnutí, která komentáře v kódu citují jako „ADR 0011, decision N“, jsou seznam v sekci [Rozhodnutí](#rozhodnuti).

## Zvažované možnosti

- **Ploché `string[]` názvů rozšíření.** Nejlevnější a odpovídá původnímu plánu, ale neumí adresovat jedinou úroveň nadpisu ani sbalenou skupinu a znovu připouští nepovolený stav „sbalená nabídka a vedle ní na stejném panelu její vlastní listy“, který model skupin činí nereprezentovatelným.
- **Jeden seřazený seznam s měřeným přetečením na mobilu.** Jediná věc ke konfiguraci a odpadne rozvržení `hideOnMobile`, o kterém rozhodují vývojáři, ale z „vypnuto“ a „nízko v pořadí“ dělá dva různé stavy, které musí jít oba nastavit, a vyžaduje `ResizeObserver` na panelu, který sedí nad klávesnicí měnící velikost viewportu.
- **Dvě rozvržení ze strukturovaných záznamů skupin** (zvoleno). Dvě věci ke konfiguraci a UI nastavení potřebuje přepínač šířkové třídy, ale každé rozvržení přímo popisuje jeden panel, bez jakéhokoli měření.

## Rozhodnutí

Přijato při důkladném rozboru návrhu (grilling session) 2026-08-03.
Slovník je v [`CONTEXT.md`](https://github.com/soukupj00/your-notes-fe/blob/main/CONTEXT.md) v sekci *Editing*: **Toolbar Family** (skupina), **Toolbar Item** (položka), **Toolbar Layout** (rozvržení panelu nástrojů), **Width Class** (šířková třída).

1. **Jednotkou je položka panelu nástrojů, ne název rozšíření.**
   Registr mapuje stabilní id na ikonu, popisek, skupinu a view tlačítka rozšíření, které se vykreslí.
   Chování zůstává u rozšíření (vzor A platí dál).
2. **Dvě rozvržení, jedno pro každou šířkovou třídu.**
   Ne jeden seznam s přetečením podle priority.
   Editor nastavení má nahoře přepínač „Kompaktní“/„Široké okno“ a upravuje vždy jedno rozvržení.
3. **`hideOnMobile` je smazáno.**
   Jeho informace se přesouvá do přednastavení pro úzkou třídu.
   V kódu rozšíření nezůstává nic o tom, která tlačítka zobrazuje telefon.
4. **Úzký panel je jeden řádek s vodorovným posouváním**, nikdy se nezalamuje.
   Je přilepený nad klávesnicí; ubírat poznámce svislé místo je jediná věc, kterou dělat nesmí.
   Žádné měření, žádný popover pro přetečení.
5. **Skupiny jsou jednotkou UI nastavení**, každá rozbalená, nebo sbalená.
   „Sbalená nabídka a vedle ní na stejném panelu její vlastní listy“ je nereprezentovatelné, nikoli jen nepovolené.
6. **Sbalená skupina ukazuje svůj stav.**
   Ikona spouštěcího tlačítka odpovídá aktuálnímu stavu skupiny (`¶` / `H2`, aktivní typ seznamu, aktuální zarovnání); skupiny obsahující jen akce použijí statickou ikonu.
   Sbalení stojí informaci a tohle ji vrací.
7. **Popover obsahuje skutečná tlačítka listů.**
   Stejné `ActionButton`y, stejné `isActive`, stejné tooltipy.
   Zapnutí a vypnutí jednotlivých listů platí i uvnitř sbalené skupiny a skupina se všemi listy vypnutými se nevykreslí.
8. **Chybějící znamená nové, ne skryté.**
   Slaďování s registrem při čtení: id z registru, která v blobu chybí, se připojí na svou pozici v registru s výchozím stavem, takže tlačítko vydané v příštím release se stávajícím uživatelům objeví.
   Id v blobu, která v registru chybí, zůstávají v úložišti, ale nevykreslují se, takže dočasně neregistrované rozšíření nemůže uspořádání vymazat.
9. **Přednastavení je razítko, ne režim.**
   Minimální / Vyvážené / Vše zapíší do aktuální šířkové třídy celé rozvržení.
   Neexistuje žádný stav „jsem pořád na přednastavení“ a Reset znamená znovu orazítkovat výchozí přednastavení šířkové třídy (na Compact Vyvážené, na Wide od 21. 10. 2026 Minimální).
10. **Dva vstupy, jedna komponenta.**
    Sekce v `Settings` a panel (sheet) vrstvený nad dialogem editoru, otevíraný koncovou položkou `⚙`.
    Cesta z editoru **nesmí navigovat**: editor může držet neuložený koncept a odchod jinam by ho buď zničil, nebo vynutil souběh s `ensureNoteId`, který Task 4 téhož slice odmítl pro archiv a koš.
    Připojení v sheetu navíc zadarmo dává živý náhled na skutečné poznámce.
11. **Editor nastavení se zanořuje.**
    Horní obrazovka obsahuje zhruba osm řádků skupin; klepnutí na jeden z nich přejde do plochého seznamu jejích tlačítek.
    Každý seznam je jednoúrovňový, takže vnořený drag-and-drop nikdy nevzniká.
12. **Přetahování pro změnu pořadí je základ, ne dodatek na později.**
    Pořadí je polovina toho, čím rozvržení je.
    `@dnd-kit/sortable` s jeho klávesovým senzorem, úchyt jako jediné místo, odkud jde přetahovat, žádná paralelní tlačítka nahoru/dolů.
13. **Registr vlastní id a prezentaci akce editoru; chování zůstává u každého povrchu zvlášť.**
    `SLASH_ITEMS` si ponechává vlastní `run` a `keywords`, ale klíčuje je podle id z registru a zahazuje svou duplicitní ikonu a popisek.
14. **Dva přizpůsobitelné povrchy, záměrně ne tři.**
    Panel nástrojů editoru (plný model) a rychlé zachycení (prostý seřazený seznam, bez skupin a bez šířkových tříd).
    Lišta v patičce karty **není** přizpůsobitelná: závisí na stavu poznámky a dovolit uživateli odebrat Obnovit by poznámku v koši připravilo o cestu zpět.
    Postranní panel je možný pozdější kandidát a je mimo rozsah.

## Důsledky

- **Id se stávají uloženými uživatelskými daty.** Po vydání je přejmenování id tlačítka migrací, a proto se id čistí (`Mathematics` → `math`, `backgroundColor` → `highlight`) ve stejné změně, která registr zavádí.
- **Absence musí znamenat „nové“, ne „skryté“.** Kdyby příslušnost znamenala viditelnost, každé tlačítko vydané poté, co uživatel poprvé otevře tuto obrazovku, by pro něj bylo navždy neviditelné.
  Skrytí se proto zaznamenává explicitně a slaďování připojuje neznámá id z registru na jejich výchozí pozici.
- **`hideOnMobile` je smazáno.** Která tlačítka telefon zobrazí, přestává být rozhodnutím vývojáře v kódu rozšíření a stává se přednastavením pro úzkou třídu.
- **Tlačítko nemůže opustit svou skupinu.** Tučné písmo nemůže stát mezi H1 a H2.
  Jde o záměrné omezení svobody, které zachovává seskupení, jež panel nástrojů potřebuje, aby zůstal čitelný, a právě díky němu se editor nastavení může zanořovat místo vnořeného drag-and-drop.
- Registr se stává jediným zdrojem id a prezentace akce editoru, takže nabídka lomítka (slash menu) pracuje se stejnými id, místo aby udržovala třetí paralelní seznam.
