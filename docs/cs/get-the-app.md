# Získat aplikaci

YourNotes není v žádném obchodě s aplikacemi.
Otevřete ji v prohlížeči, ze svého serveru nebo na vyzkoušení i bez něj, a odtud ji nainstalujete, takže dostane vlastní ikonu a okno.

## Vyzkoušení bez serveru

YourNotes můžete hned používat na adrese [your-notes-fe.vercel.app](https://your-notes-fe.vercel.app/), bez serveru a bez účtu.
Na tom jednom zařízení funguje naplno, i offline, a odtud si ji můžete nainstalovat, jak je popsáno níže.
Poznámky, které tam napíšete, zůstanou na tom zařízení: tato kopie se synchronizovat nemůže, to umí jen aplikace otevřená z vašeho vlastního serveru.
Pokud je později budete chtít přenést, uložte si v Nastavení zálohu a nahrajte ji do aplikace otevřené z vašeho serveru.

## 1. Otevřete ji ze svého serveru

Aplikace přichází ze serveru YourNotes, který někdo ve vaší domácnosti provozuje doma.
Pokud ho zatím nikdo nenastavil, web serveru má [návod krok za krokem](https://soukupj00.github.io/your-notes-be/cs/setup), psaný pro lidi, kteří nejsou programátoři.

Nejsnazší způsob, jak otevřít aplikaci na novém zařízení, je párovací odkaz, který zařízení zároveň přihlásí:

- **Vaše první zařízení** otevře odkaz, který server vypíše při prvním spuštění, a vy se stanete vlastníkem.
  Část návodu [Vytvoření vlastníka](https://soukupj00.github.io/your-notes-be/cs/setup#5-vytvoreni-vlastnika) vás tím provede.
- **Každé vaše další zařízení:** na zařízení, které už je přihlášené, otevřete Nastavení ikonou ozubeného kola nahoře, otevřete Účet a klepněte na „Přidat zařízení“.
  Naskenujte zobrazený QR kód fotoaparátem nového zařízení a pak klepněte na „Přihlásit se“.
- **Někdo další z vaší domácnosti:** vlastník otevře Nastavení, potom Účet, a klepne na „Pozvat člena“.
  Druhý člověk naskenuje QR kód a zvolí si vlastní uživatelské jméno a heslo.

Párovací odkaz funguje jednou a deset minut; pokud vyprší, požádejte o nový.
Jakmile je aplikace otevřená v prohlížeči, nainstalujte ji.

## 2. Nainstalujte ji

### iPhone a iPad

1. Otevřete aplikaci v **Safari**.
2. Klepněte na tlačítko Sdílet, čtverec se šipkou nahoru.
   Na novějších iPhonech je v nabídce za třemi tečkami.
3. Sjeďte dolů a klepněte na **Přidat na plochu**, pak na **Přidat**.

YourNotes je teď ikona na vaší ploše.

### Android

1. Otevřete aplikaci v **Chrome**.
2. Klepněte na nabídku, tři tečky vpravo nahoře.
3. Klepněte na **Nainstalovat aplikaci** (na některých telefonech je to **Přidat na plochu**), pak na **Nainstalovat**.

### Počítač

- **Chrome nebo Edge:** klikněte na ikonu instalace na pravém konci adresního řádku, pak na **Nainstalovat**.
  V Chrome je to malá obrazovka se šipkou.
  Když to prohlížeč dovolí, nabízí totéž úvodní stránka Nastavení v řádku „Nainstalovat YourNotes“, tlačítkem **Nainstalovat**.
- **Safari na Macu:** zvolte **Soubor**, pak **Přidat do Docku**.
- **Firefox** webové aplikace neinstaluje; nechte YourNotes v kartě, kde vše funguje stejně.

## Proč na adrese záleží

Do aplikace se nezadává žádná adresa serveru.
Aplikace se synchronizuje se serverem, ze kterého byla otevřena, a tak najde vaše poznámky.

Proto YourNotes vždy otevírejte a instalujte z adresy vlastního serveru.
Kopie otevřená z jakékoli jiné adresy je samostatná aplikace s vlastními poznámkami, které se na váš server nikdy nedostanou.

## Když je server mimo dosah

Nainstalovaná aplikace funguje dál, i když je váš server vypnutý nebo mimo dosah, například na telefonu mimo domácí Wi-Fi.
Vše zůstává na zařízení a vaše změny počkají, až server znovu odpoví.
