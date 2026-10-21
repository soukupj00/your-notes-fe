# 0012 - Pořadí v přehledu se drží, příslušnost je živá

- Stav: přijato
- Datum: 2026-08-07

## Kontext

`useNoteFeed` odvozuje přehled (feed) uvnitř `useMemo` nad Dexie `useLiveQuery`, takže **jakýkoli** zápis do tabulky `notes` znovu spustí komparátor a v dalším snímku přeuspořádá zeď karet.
Výchozí řazení je `updated desc` (`note-search-params.ts`) a `updateNote` bezpodmínečně posouvá `updatedAt` (`useNoteActions.ts`).

Tyto dvě skutečnosti dohromady znamenají, že se přehled přeřazuje jako přímý důsledek vlastních úprav uživatele na místě.
To už je ve vydané verzi, na dvou místech, a nikdo si toho nevšiml, protože obojí lze snadno mylně považovat za záměr:

- **Změna barvy karty ji pošle nahoru.** `NoteCard.tsx` volá `updateNote(note.id, { color })`.
- **Zeď se přeskládává za otevřeným editorem.** `NoteEditorDialog.tsx` ukládá automaticky s debounce, takže na desktopu se karta přesune dřív, než se modální okno zavře.

Navíc to rovnou blokuje třetí věc.
Zaškrtnutí políčka na kartě ([ADR 0013](./0013-checklist-sinking-is-presentation-not-storage.md)) zapisuje tělo poznámky, což pošle kartu na pozici 0, posune pod palec uživatele jinou kartu a další klepnutí dopadne na špatnou poznámku.
Chyba se násobí: každá úprava ztěžuje tu další, protože cíl se neustále hýbe.
Funkce pro úpravu karty na místě je bezcenná na zdi, která kartu v reakci na to přemístí.

Výjimečná hodnota zdi typu masonry je v tom, že se v ní orientuje *prostorově* - „nákupy jsou třetí shora vlevo“.
Přeřazování po každé úpravě ničí přesně to, v čem je masonry dobré.

## Rozhodnutí

**Příslušnost k přehledu je živá; pořadí se drží.**

- **Příslušnost** - které poznámky přehled obsahuje - je vždy živá.
  Poznámka, která přestane splňovat podmínky, okamžitě odchází (přesun do koše, archivace, vyfiltrování z vyhledávání), a poznámka, která je začne splňovat, okamžitě přibude (vytvoření, obnovení, shoda s dotazem).
  Zde se nic nemění.
- **Pořadí** - místo poznámky v přehledu - se drží.
  Poznámka, která už je na obrazovce, nemění místo kvůli něčemu, co s ní uživatel právě udělal.

Pořadí se přepočítává jen tehdy, když se uživatel nedívá:

1. Při připojení, což pokrývá každou změnu routy mezi přehledy.
2. Při změně search params (`q`, `sort`, `dir`, `tags`) - uživatel si řekl o jiné uspořádání, tak ho dostane.
3. Při `visibilitychange` zpět na viditelný stav, což pokrývá přesunutí PWA na pozadí i přepínání karet prohlížeče.
4. Při zavření editoru (doplněno 2026-10-21 po prvním uživatelském testu): uživatel byl v poznámce, ne v přehledu, a čekal, že se právě upravená poznámka při řazení podle poslední úpravy posune.
   Otevření editoru nepřepočítává nic, takže se zeď za ním nikdy nepřeskládá.

**Připnutí je jediná výjimka**, a musí být: pravidlo přímé manipulace (Direct-Manipulation Rule) v DESIGN.md je napsáno právě o připínání a přesun karty *je* požadovaná akce.
Strukturálně to nic nestojí, protože `floatPinned` (`useNoteFeed.ts`) už běží jako samostatný krok rozdělení oddělený od komparátoru - rozdělení na připnuté a nepřipnuté zůstává živé, zatímco pořadí *uvnitř* každé části se drží.

Poznámka, která není v mapě drženého pořadí (nově vytvořená, nově obnovená, nově odpovídající dotazu), se řadí normálně komparátorem, takže vytvoření stále okamžitě umístí poznámku nahoru.
„Držení“ se týká poznámek, které už jsou na obrazovce, nikdy pole jako celku.

## Zvažované možnosti

- **Neposouvat `updatedAt` při úpravách na místě.**
  Jednořádková změna bez předělávání přehledu: zaškrtnutí je „používání“ poznámky, ne její změna.
  Zamítnuto, protože tělo poznámky se skutečně změnilo a model by to pak popíral.
  Konečnými konzumenty `updatedAt` jsou synchronizace v M5 a fronta offline změn a protokol postavený na této hodnotě by každé zaškrtnutí tiše zahodil.
  Vyměnit problém v UI za tichou ztrátu dat při synchronizaci není žádná výměna.
  Navíc to vyžaduje taxonomii - někdo by musel průběžně rozhodovat, které úpravy se „počítají“ - a odpovědi by se mezi jednotlivými místy volání rozcházely.

- **Nechat zeď přeskládat; pružinová animace už existuje.**
  Žádná nová mašinerie, zcela poctivá data a pohyb se dá číst jako „tohle je poznámka, na které pracujete“.
  Zamítnuto kvůli výše popsanému násobení chyb a protože to odporuje hodnotám pohybu uvedeným v DESIGN.md („klidný pohyb, nic, co odvádí oko od textu“).
  Celá zeď poskakující kvůli zaškrtnutému políčku je přesně to, co ta věta zakazuje.

- **Přeřazovat navíc i po časovači nečinnosti.**
  Udržuje zeď aktuálnější, aniž by se hýbala pod aktivní rukou.
  Zamítnuto: karta by se pohnula, zatímco ji uživatel čte a na nic nesahá, což je přesně to překvapení, kterému má toto pravidlo zabránit.

- **Přeřazovat jen při připojení a změně search params, bez posluchače viditelnosti.**
  Nejméně mašinerie.
  Zamítnuto, protože karta s PWA zůstává otevřená celé dny, takže zastaralost je neomezená; posluchač viditelnosti stojí pár řádků a omezí ji na „od chvíle, kdy jste se naposledy podívali jinam“.

## Důsledky

- Pořadí na obrazovce už striktně neodpovídá řazení, které tvrdí URL.
  `?sort=updated&dir=desc` může nahoře ukázat kartu, která není naposledy upravená.
  Nesoulad se vždy týká jen poznámek, na které uživatel právě sáhl, a po návratu se sám opraví, ale je to skutečná nekonzistence a je třeba počítat s tím, že přijde jako hlášení chyby.
- Jako vedlejší efekt se opravují dvě vydané chyby: skok po změně barvy a přeskládání za otevřeným editorem.
- Přeskládání se ztrácí jako nechtěný signál „uloženo“.
  Každá dotčená akce proto musí nést vlastní lokální zpětnou vazbu: toast s možností vrátit zpět u akcí životního cyklu, vzorník u barvy a políčko/přeškrtnutí/propadnutí u zaškrtnutí.
- **Synchronizace v M5 s tím interaguje a záměrně se zde neřeší.**
  Poznámka změněná na jiném zařízení se správně objeví nebo zmizí (příslušnost je živá), ale nepřeřadí se, dokud se uživatel nepodívá jinam a zpět.
  Zda má změna přicházející zvenčí smět přeřadit okamžitě, je otázka pro M5; pravidlo, jak je napsané, říká ne, a to je konzervativnější výchozí stav.
- Po návratu na kartu prohlížeče přeskládání využije stávající pružinovou animaci místo teleportu, takže se zeď viditelně usadí a působí jako „dohnáno“.
- Slovník je v `CONTEXT.md` v sekci *The feed*: **Feed**, **Sort**, **Membership**, **Rank**.
  „Feed“ už nesl váhu v definici **Pinned** a nikdy nebyl definován.
