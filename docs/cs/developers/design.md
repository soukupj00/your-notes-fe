# Design

Vizuální kontrakt je [`DESIGN.md`](https://github.com/soukupj00/your-notes-fe/blob/main/DESIGN.md), sepsaný na základě měření, ne dojmu.
Tato stránka je jeho krátká verze: myšlenka, kde žijí tokeny, a pravidla, která každá změna UI dodržuje.

## Ve dne stůl, v noci obchod

Jeden stůl, vyfocený dvakrát: dopoledne s otevřeným oknem a o půlnoci s rozsvícenou lampou.
Aplikace se do tmavého motivu nepřevrací, mění své světlo.

- Ve dne je plátno teplý pergamen a poznámka je jemně tónovaný papír s vlasovým okrajem a slabým stínem.
- V noci je plátno téměř černá místnost a barva poznámky přestává být pigmentem a stává se neonovým okrajem a září.
- Kostra se nikdy nehýbe: stejné 16px rohy, písmo, rozestupy i pohyb v obou motivech.

Stěna poznámek je produkt.
Poznámky se přelétají pohledem, nečtou se jedna po druhé, takže barva poznámky je index: lidé poznámku znovu najdou, protože si pamatují, že byla ta zelená.

## Tokeny

Každá barva je vlastní CSS vlastnost v OKLCH v `src/styles/globals.css`, jediném zdroji pro oba motivy.
Žádný `tailwind.config.js` neexistuje; Tailwind 4 čte svou konfiguraci z tohoto CSS.

- **Jeden akcent**, ve výchozím stavu Lamplight Amber, sytý ve dne a jasný v noci.
- **Devět barev poznámek** plus žádná, uložené na poznámce nebo štítku jako token, například `green`, nikdy jako hodnota.
  Token přeloží na hodnotu motiv a paleta pro barvoslepé, takže stejná poznámka má všude správnou barvu.
- **Dvě písma**, obě přibalená: Bricolage Grotesque pro nadpisy a Work Sans pro text.
  Aplikace za běhu neposílá žádné požadavky, takže CDN s písmy nepřipadá v úvahu.

`src/styles/globals.test.ts` selže na jakékoli hodnotě `oklch()` mimo sRGB, protože prohlížeč takovou barvu potichu stáhne zpět do rozsahu a dodaná barva pak není ta, která je zapsaná.

## Pravidla, která změna dodržuje

- **Neon je pro chrome, nikdy pro text.** Barva poznámky se smí dotknout jejího okraje, čipů a záře, nikdy jejího titulku ani těla poznámky.
- **Jeden akcent, jen na chrome:** značka, aktivní položka navigace, tlačítko pro zachycení a fokusový rámeček.
- **Dotykové cíle 44px** pro každý ovládací prvek na dotykové obrazovce; kompaktní hustota zmenšuje text a rozestupy, nikdy plochy pro klepnutí.
- **Pořadí v DOM je pořadí čtení.** Zděná (masonry) stěna se rozmísťuje v JavaScriptu, aby karty zůstaly v pořadí čtení i tabulátoru.
- **Dvě rozvržení přehledu, Masonry a Stack,** s jednou anatomií karty; přepnutí mezi nimi je animované.
- **Omezený pohyb vypne všechny animace** a každý hover, který zvětšuje, mění i výplň nebo stín, takže stav je vidět i bez pohybu.
- **Záře jen v noci, stín jen ve dne.**
- **Popisky nejsou nikdy menší než 11px.**
- **Hierarchie přežije záložní písmo.** Řecké, cyrilské a další nelatinkové nadpisy přecházejí na systémové písmo, takže hierarchii nese velikost, tloušťka i barva, ne samotný řez písma.

## Paleta pro barvoslepé

Paleta pro barvoslepé je modifikátor, ne třetí motiv: kombinuje se se světlým i tmavým.
Přiřazuje devíti barvám poznámek nové hodnoty tak, aby se lišily nejdřív světlostí a až potom odstínem, protože při barvosleposti samotný odstín slévá modrou a fialovou do jedné barvy.
Její čísla a audit, který je třeba znovu spustit před změnou jakékoli hodnoty palety, jsou v `DESIGN.md`.
