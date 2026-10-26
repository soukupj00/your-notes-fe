# 0016 - Šířka rozhoduje o rozvržení, ukazatel o nabízených ovládacích prvcích

Aplikace má jeden navigační breakpoint, `640px` (`useIsMobile`, ADR 0010), a ten začal potichu znamenat dvě různé věci: „toto okno je úzké“ a „toto je telefon“.
Telefon otočený na šířku má 844px, takže čáru překročil a dostal desktopové rozvržení i s desktopovými nápovědami klávesnice - odznak `⌘K` na vyhledávacím poli a krok průvodce, který sliboval zkratku, pro kterou zařízení nemá klávesu.

**Šířková třída rozhoduje, co se rozvrhne. Typ ukazatele rozhoduje, které ovládací prvky se nabídnou.**
Oba signály už existovaly (`useIsMobile` / `useWidthClass` čtou šířku; `useFinePointer` čte `(pointer: fine)`, opak vlastního `(pointer: coarse)` z pravidla 44px pro dotyk); chybělo pravidlo, že šířka nikdy nesmí zastupovat ukazatel.
Konkrétně: klávesová zkratka se ukazuje jen přesnému ukazateli a ovládací prvek se zvětší na 44px jen pro hrubý - a ani jedna otázka se nikdy nezodpovídá tím, že se zjišťuje šířka okna.

## Zvažované možnosti

**Přidat `(pointer: coarse)` do `useIsMobile`**, aby telefon na šířku zůstal u telefonního rozvržení.
Zamítnuto ze dvou důvodů.
Z notebooku s dotykovou obrazovkou by to udělalo trvale mobilní zařízení, což je špatně právě v tom jediném, v čem je šířka opravdu dobrá.
A `useIsMobile` čte navigace, panel editoru i panel nástrojů najednou, takže vložení ukazatele do něj by o všech třech rozhodlo z jednoho signálu - což je přesně ta záměna, kterou toto ADR existuje odstranit.
Kde jeden povrch ukazatel opravdu potřebuje, čte si ho sám; viz panel nástrojů v Důsledcích.

**Ponechat navigaci na šířku v širokém rozvržení** byla druhá polovina rozhodnutí a je to ta, kterou bude čtenář nejspíš chtít „opravit“.
PRODUCT.md uvádí mobil na šířku jako výslovný cíl a 844x390 má na lištu i inline lištu rychlého zachycení opravdu místo; vnutit tam telefonní rozvržení by promrhalo osu, kvůli které orientace existuje.

## Důsledky

Pravidlo 44px pro dotyk a sbalená navigační lišta teď musí koexistovat, ne se střídat.
`SideNav` nastavuje na svých skupinách `px-4`, což uvnitř 64px lišty nechalo přesně 32px obsahu - dost pro tlačítka lišty `size-8` a o 12px méně, než je minimum pro hrubý ukazatel, takže tlačítka přetekla doprava a vtáhla první znaky svých popisků do lišty, která má mít jen ikony.
Lišta si udělá místo (`px-2` ve sbaleném stavu), místo aby se minimu vyhnula: 44px oblasti zásahu při 36px rozteči lišty by se překrývaly se sousedními položkami navigace a špatné klepnutí v navigaci je horší než chyba, která se opravuje.

**Panel nástrojů editoru je jediná šířková třída, o které nerozhoduje jen šířka**, a je to druhé místo, kde se tatáž záměna skrývala.
`useWidthClass` teď odpovídá `compact`, když je okno úzké **nebo** je primární ukazatel hrubý.
Úzké rozvržení bylo vždy specifikováno v jednotkách ukazatele, ne šířky: jeho šest slotů má po 44px kvůli pravidlu pro dotyk z DESIGN.md a jeho pravidlo „jeden řádek, nikdy nezalamovat“ existuje proto, že jede nad virtuální klávesnicí.
Obojí jsou fakta o ukazateli, takže šířka jeden zastupovala - právě to zastupování, které toto ADR zakazuje.
Projevilo se to na telefonu na šířku: 844px šířky si koupilo široké rozvržení, které se zalamuje do čtyř řádků, na obrazovce vysoké 390px, kde se klávesnice chystá zabrat polovinu.
`useWidthClass` je jediný konzument signálu ukazatele, takže se od něj nic nemůže rozejít, a `(pointer: fine)` znamená, že myš je *primární* ukazatel - notebook s dotykovou obrazovkou a trackpadem si široké rozvržení ponechá a přepne se jen zařízení čistě dotykové.
Kapacita šesti slotů pro `foldMarker` zůstává aritmetikou pro 360px: je to minimum, které totéž rozvržení musí přežít v nejužší orientaci, a značka, která by se hýbala s aktuálním oknem, by uživateli řekla pokaždé něco jiného, kdykoli by při úpravě jednoho seznamu otočil zařízení.

Že se ptáme media query, a ne okna, je to, díky čemu nic z toho platí i na skutečném zařízení.
`useIsMobile` dřív poslouchal media query a pak odpovídal podle `window.innerWidth`, a při otočení na Androidu se tyto dvě věci rozcházejí: rozměry nemusí být aktualizované ve chvíli, kdy se query změní, a žádná druhá událost, která by špatnou odpověď opravila, nepřijde.
Telefon otočený na výšku si ponechal široký panel nástrojů - zalomený do čtyř řádků - přišpendlený ke spodku přes CSS, které se přepnulo správně, protože stylopis se ptá query.
Hook se teď ptá stejné query, takže JS a CSS nemohou odpovědět různě.
Cena se platí v testech: jsdom nevyhodnocuje žádné media query, takže nastavení `innerWidth` už viewport nesimuluje a dělá to místo něj `src/test/viewport.ts`.

## Doplněno 2026-10-25

Dotykový tablet v pouzdře s klávesnicí má hrubý ukazatel a všechny klávesy, takže ovládací prvky pro klávesnici teď následují i hardwarovou klávesu stisknutou v této relaci ([ADR 0028](./0028-a-hardware-key-earns-keyboard-affordances.md)).
Šířka dál nikdy nezastupuje ani jedno a šířková třída klávesnici nečte.
