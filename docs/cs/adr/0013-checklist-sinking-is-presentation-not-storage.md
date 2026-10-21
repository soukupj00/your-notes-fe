# 0013 - Propadání v seznamu úkolů je způsob zobrazení, ne uložení

- Stav: přijato
- Datum: 2026-08-07
- Nahrazuje implementaci rozhodnutou v úkolu 5b plánu M4 Slice 4, identita a pohyb (2026-08-05).

## Kontext

Seznam úkolů má dva povrchy a každý se vykresluje z něčeho jiného.
Editor vykresluje dokument ProseMirror; karta vykresluje uložené HTML těla poznámky přes `dangerouslySetInnerHTML` v `NoteBody`.
Jakékoli pravidlo o tom, jak seznam úkolů vypadá, musí platit na obou, jinak se tentýž seznam čte dvojím způsobem podle toho, kde se na něj člověk dívá.

Úkol 5b dodal propadání jako `CheckedSink.ts`, plugin `appendTransaction`, který v dokumentu fyzicky **přesouvá přepnutou položku**.
To funguje v editoru, ale ke kartě se vůbec nedostane, protože karta nemá žádnou instanci ProseMirror.
Navíc bylo ve výchozím stavu vypnuté, s výslovným zdůvodněním: *„seřazený seznam možností chce mít pořadí přesně tam, kam ho uživatel dal, a tiše toto pořadí přepisovat by znamenalo, že aplikace ztrácí uživatelovu práci.“*

Nezávisle na tom byla zaškrtávací políčka na kartě znehybněna pomocí `[&_input]:pointer-events-none` (`NoteCard.tsx`) s komentářem *„zaškrtávací políčka v náhledu jsou obrázek poznámky, ne ovládací prvek“*.
**To nefunguje.** `renderHTML` z TipTapu (`@tiptap/extension-list`) generuje `<li data-type="taskItem" data-checked><label><input type="checkbox"><span></span></label><div>…</div></li>` a kliknutí na `<span>` uvnitř labelu aktivuje input přes sémantiku label-for bez ohledu na `pointer-events` inputu.
Klepnutí na zaškrtávací políčko na kartě tak políčko v DOM přepnulo, nic nezapsalo, probublalo ke kartě a otevřelo editor s nezměněným stavem.
Ovládací prvek nebyl neaktivní; byl rozbitý.

Chceme, aby zaškrtávací políčka na kartě byla opravdu živá, a to znamená, že pravidlo propadání teď musí platit i na povrchu, kam se plugin nedostane.

## Rozhodnutí

**Propadání je způsob, jak seznam úkolů zobrazit, nikdy ne způsob, jak ho uložit.**
Tělo poznámky vždy drží pořadí, v jakém ho uživatel napsal.

Oba povrchy zobrazují zaškrtnuté položky na konci pomocí CSS `order` ve flex sloupci, v jediném pravidle omezeném na `.prose`, které editor a karta už sdílejí:

```css
ul[data-type="taskList"] { display: flex; flex-direction: column; }
ul[data-type="taskList"] > li                      { order: -1; }
ul[data-type="taskList"] > li[data-checked="true"] { order:  1; }
ul[data-type="taskList"]::after { content: ''; order: 0; border-top: 1px solid var(--border); }
```

`CheckedSink.ts` a jeho test jsou smazány, spolu s jeho registrací v `build.ts` a předáváním refů v `editor.tsx`.

Tři části stojí za zaznamenání, protože každá sama o sobě překvapí.

**Oddělovač je pseudoelement zaparkovaný na `order: 0`.**
Sourozenecké kombinátory čtou pořadí v *DOM*, zatímco `order` mění jen *vizuální* pořadí, takže `li[data-checked="false"] + li[data-checked="true"]` by čáru nakreslil na špatném místě.
Žádný CSS selektor neumí vyjádřit „první prvek s `order: 1`“.
Pseudoelement na `ul` je sám flex položkou a může dostat `order`, takže ho lze zaparkovat přesně na švu.
Do uloženého těla poznámky nic nepřidává a uvnitř `contenteditable` je bezpečný, protože pseudoelement nelze vybrat ani smazat a ProseMirror ho nikdy nevidí.
`:has(> li[data-checked="true"])` ho skryje u seznamu, který je celý zaškrtnutý nebo celý nezaškrtnutý; kombinátor potomka je nosný, jinak by položky vnořeného seznamu úkolů spouštěly oddělovač rodiče.

**Pořadí v DOM a vizuální pořadí se uvnitř `contenteditable` záměrně liší.**
Svislý pohyb kurzoru se řídí vizuálním pořadím v prohlížeči, takže šipky fungují správně.
Kopírování, vkládání a serializace používají pořadí v DOM, což je tu z definice správně, protože pořadí v DOM *je* napsané pořadí.
Jedinou skutečnou zvláštností je tažení výběru textu přes šev, kdy rozsah v DOM zahrnuje položky, které vizuálně nenavazují.
Přijato, s tím, že se to před sepsáním pravidla ověří ve skutečném prohlížeči.

**Odškrtnutí je přesné, ne přibližné.**
Protože se nikdy nic nepřesunulo, vrátí se položka přesně na místo, kde byla napsána.
Starý plugin ji uměl vrátit jen na *začátek bloku zaškrtnutých*, což byla heuristika zastupující informaci, kterou předtím zahodil.

## Zvažované možnosti

- **Ponechat změnu dokumentu a znovu ji implementovat pro kartu.**
  Co vidíte, to je uložené, takže pořadí ponese i export surového HTML nebo budoucí protějšek synchronizace.
  Zamítnuto: totéž pravidlo by žilo na dvou místech, napsané proti dvěma různým reprezentacím (dokument ProseMirror a HTML řetězec), což je přesně ten rozchod, který tento codebase odstraňuje.
  Navíc zachovává destruktivní vlastnost, kvůli které byla předvolba ve výchozím stavu vypnutá.

- **Ponechat změnu, ale přesunout řazení do jedné čisté funkce nad HTML řetězcem, kterou volají oba povrchy.**
  Jediný zdroj pravdy pro pořadí.
  Zamítnuto: editor by musel při každém ticku serializovat, řadit a znovu parsovat, což by rušilo kurzor a znečišťovalo historii undo, a stejně by přepisoval pořadí, které uživatel napsal.

- **Karta propadá, editor ukazuje skutečné pořadí.**
  Nulové riziko pro `contenteditable`.
  Zamítnuto: většina odškrtávání se děje v editoru, takže by funkce chyběla právě na povrchu, který ji potřebuje nejvíc, a oba povrchy by pro tentýž seznam ukazovaly různé pořadí.

- **Nechat zaškrtávací políčka na kartě neaktivní (opravit únik přes label pořádným vypnutím inputu).**
  Zamítnuto jako výklad původního záměru, který stárne nejhůř.
  Zaškrtávací políčko, které vypadá jako zaškrtávací políčko a odmítá se zaškrtnout, je horší náhled než žádné políčko, a celý smysl zdi poznámek je pracovat s poznámkami bez jejich otevírání.

## Důsledky

- **`sinkCheckedItems` má výchozí hodnotu `true`.**
  Zdůvodnění pro `false` bylo, že propadání ničí uživatelovo pořadí; to už neplatí.
  Předvolba zůstává pro případ, kdy pořadí *je* obsahem (kroky receptu, seřazené možnosti), což je skutečný, ale menšinový případ.
  To vyžaduje migraci, nejen výchozí hodnotu ve schématu: `setPreference` zapisuje celý naparsovaný blob, takže každý stávající uživatel, který kdy změnil jakékoli nastavení, už má na disku `sinkCheckedItems: false`.
- **Celý blok CSS je podmíněný předvolbou** přes atribut `data-sink-checked`, který na `<html>` zapisuje `DocumentPreferences`, což odpovídá zdokumentovanému testu pro to, co tam patří („zda hodnotu potřebuje stylopis“).
- **Zaškrtávací políčka na kartě se stávají ovládacími prvky, takže pravidlo 44px pro dotyk se dostává i na kartu - ale jako oblast zásahu, ne jako výška řádku.**
  Pravidlo bylo na kartu nejprve uplatněno celé, obě poloviny, a to byla chyba, kterou ukázala až obrazovka.
  Naměřeno na viewportu 390px: text řádku má 20px, takže minimum 44px nechávalo na každém řádku 24px prázdného místa a třířádkový seznam úkolů utratil **72px z 216px karty** za nic.
  Karta je jediný povrch, kde je svislé místo opravdu vzácné, a dřívější omezení jen na `.tiptap` to říkalo; na tom zdůvodnění nebyla špatně úvaha, ale závěr.

  Pravidlo si tedy ponechává oblast zásahu a zahazuje minimum.
  Cíl je 44px široký a vysoký jako jeho vlastní řádek, ukotvený k řádku, ne vycentrovaný na zaškrtávací políčko - takže po sobě jdoucí cíle se stále přesně skládají vedle sebe bez překryvu, a právě toto skládání mělo minimum zaručovat.
  Šířku si mohou dovolit oba povrchy; výšku ani jeden.

  Nejprve se to uplatnilo jen na kartu, s teorií, že řádek editoru je řádek, do kterého se píše, a za svou výšku tedy už platí.
  Neplatil: editor na šířku telefonu působil jako s dvojitým řádkováním ze stejného důvodu a seznam úkolů by neměl působit jako jiný ovládací prvek podle toho, jestli ho čtete, nebo píšete.
  **Jedno zpracování, oba povrchy.**
  Řádky karty klesly ze 44px na 22px a řádky editoru ze 44px na 26px; samotná karta klesla z 216px na 188px a přitom ukazuje *více* řádků, ne méně.
  Ověřeno klepáním: když viditelné zaškrtávací políčko končí 19px od začátku řádku, klepnutí na x=38 na spodním okraji řádku se stále přiřadí k labelu toho řádku a přepne ho.

- **Zkrácené tělo na kartě se rozplývá, místo aby bylo useknuté.**
  `max-height` končí tělo ostrým řezem skrz jakýkoli glyf, na který limit padne, což působí jako chyba vykreslování, ne jako „je tu toho víc“.
  Gradient `mask-image` text místo toho rozpouští a uplatní se jen tehdy, když `NoteCard` naměří skutečné přetečení.
  Maska, a ne gradient namalovaný přes text, protože povrch karty je tematizovaný a přebarvený podle barvy poznámky, takže překryv by musel tu barvu znát, aby s ní splynul; rozpuštění textu na barvě nezávisí a je správné u každé identity v obou motivech.
- Karta zapisuje **obojí**, `data-checked` na `li` i `checked` na `input`.
  `data-checked` je to, co TipTap zpětně parsuje; `checked` je to, co kreslí kartu.
  Zapsat jedno bez druhého znamená, že se oba povrchy rozejdou.
- **Blok zaškrtnutých se čte v napsaném pořadí, ne v pořadí zaškrtnutí.**
  `order: 1` dává všem zaškrtnutým řádkům stejnou hodnotu a remízu rozhoduje pořadí v DOM, takže nově zaškrtnutá položka přistane tam, kde byla napsána, a ne na konci bloku.
  Starý plugin skládal podle času zaškrtnutí, protože měl dokument, kam to zaznamenat; prezentační pravidlo to nemá kam uložit a přidání uloženého času zaškrtnutí kvůli obnovení starého chování by znovu zavedlo zápis, který toto rozhodnutí odstraňuje.
  Blok je díky tomu stabilní napříč zaškrtnutími, což je lepší kompromis, ale oproti úkolu 5b je to viditelná změna chování.
- Zaškrtnutí je přímá manipulace a odpověď na ni přijde ve stejném snímku tím, že se *nevolá* `preventDefault`: nativní zaškrtávací políčko se přepne okamžitě.
  Na round-trip přes Dexie čeká jen přesun řádku, protože ozvěna live query znovu spustí `dangerouslySetInnerHTML` a nahradí každý uzel - optimistická úprava DOM by tak o svou animaci přišla právě kvůli přestavbě, se kterou závodila.
  FLIP proto běží až po přestavbě, z layout efektu, a právě to umožňuje korespondence podle indexu.
- Animace přesunu je FLIP podle **korespondence indexů**, ne identity uzlů, a díky tomu jeden pomocník slouží oběma povrchům.
  Editor si svůj uzel ponechává (`update()` nastaví `listItem.dataset.checked` na místě a vrátí stejný `dom`), zatímco karta nahrazuje každý uzel přes `innerHTML` - ale protože se změnil jen atribut, k-tý `li` před a po je tatáž logická položka.
- Přeškrtnutí se neanimuje.
  `text-decoration` animovat nelze a předstírat to škálovaným gradientem by nakreslilo čáru přes text ve stejném okamžiku, kdy řádek klouže dolů: dvě animace soupeřící o jedno oko.
  `line-through` naskočí okamžitě, zatímco `color` přechází na `--muted-foreground`, takže řádek při propadání ustupuje do pozadí.
- Pojem se v `CONTEXT.md` objevuje jako **Sinking** v části *Core entities*.
