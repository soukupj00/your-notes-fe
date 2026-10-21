# 0021 - Připomenutí se předávají do kalendáře; aplikace nikdy neposílá oznámení

- Stav: přijato (ruší nepožadavek „připomenutí/oznámení u poznámek“ v [07-requirements.md](https://github.com/soukupj00/your-notes-fe/blob/main/docs/architecture/07-requirements.md))
- Datum: 2026-09-20

## Kontext

Připomenutí byla výslovně mezi nepožadavky, a přitom jsou nejvíce postrádanou funkcí Keepu ([10-related-work.md](https://github.com/soukupj00/your-notes-fe/blob/main/docs/architecture/10-related-work.md)).
Překážkou nikdy nebylo UI, ale doručení: webová aplikace má přesně tři způsoby, jak vyvolat oznámení ve zvolený čas, a žádný z nich není k dispozici.
Web Push funguje i se zavřenou aplikací, ale potřebuje server (M5) a relay třetí strany, který už [ADR 0017](./0017-note-level-last-writer-wins-with-conflicted-copies.md) zamítlo.
Notification Triggers (`showTrigger`) by se spouštěly lokálně, ale Chrome je opustil a nikdy nevyšly.
Časovač ve stránce nebo v service workeru běží jen při otevřené aplikaci - prohlížeč zastaví worker pár sekund po zavření poslední záložky - takže by se připomenutí spustilo jen uživateli, který připomínat nepotřeboval.

Rozhodl tento požadavek: připomenutí se musí na telefonu nebo tabletu spustit **bez ohledu na to, zda aplikace běží**.
To může slíbit jen něco, co plánuje sám operační systém, a jediná taková věc, na kterou webová aplikace dosáhne bez serveru, je uživatelův kalendář.

## Rozhodnutí

**Připomenutí je pasivní záznam v poznámce; alarm patří uživatelovu kalendáři, kam se dostane předáním.**

1. **Aplikace nikdy neposílá oznámení.**
   Žádné oprávnění k oznámením, žádné změny service workeru, žádné časovače, žádný úklid prošlých připomenutí, žádný stav „potvrzeno“.
   Kdyby oznamoval kalendář i aplikace, každé připomenutí by při náhodou otevřené aplikaci zabzučelo dvakrát, a právě spouštění uvnitř aplikace s sebou táhne všechno výše uvedené.
2. **Dvě volitelná pole v poznámce**, `remindAt` a `repeat` (`daily | weekly | monthly | yearly`), ne samostatné úložiště.
   Jedno připomenutí na poznámku.
   Díky tomu, že je v poznámce, se zadarmo veze se zálohou, košem, trvalým smazáním i synchronizací na úrovni poznámek z M5; žádné z polí není indexované, takže se nezvyšuje verze Dexie.
   Nastavení nebo zrušení připomenutí zvýší `updatedAt`, stejně jako připnutí.
3. **Nastavit znamená předat.**
   Jediná primární akce popoveru uloží pole *a* týmž klepnutím předá kalendáři soubor `.ics`; připomenutí, které nebylo kalendáři nabídnuto, uložit nelze.
   Alternativa - uložit a exportovat v oddělených krocích - nechává na kartě čip, který vypadá aktivně, ale nic nespustí.
   Sledování „bylo exportováno“ bylo zamítnuto: stojí pole a několik stavů a stejně nemůže vědět, zda uživatel dokončil potvrzovací obrazovku samotné kalendářové aplikace.
4. **Předání je jednosměrné a říká to.**
   `UID` události je id poznámky a její `SEQUENCE` je čas předání v sekundách, takže opakované předání událost *nahradí* v klientech, kteří to respektují (Apple ano; import v Googlu je nekonzistentní).
   Zrušení připomenutí nemůže odstranit událost v kalendáři; popover uživateli řekne, ať ji odstraní tam.
   Soubor s `METHOD:CANCEL` se nenabízí, protože jeho ruční import je téměř k ničemu.
5. **Událost nese název a odkaz zpět, nikdy tělo poznámky.**
   `SUMMARY` je záhlaví (se záložním použitím prvních ~60 znaků prostého textu, pak pevného řetězce); `URL` a `DESCRIPTION` jsou `<origin>/?note=<id>`, což poznámku otevře, protože otevřená poznámka žije v URL ([ADR 0014](./0014-the-open-note-lives-in-the-url.md)).
   Kalendář je obvykle cloud třetí strany a tato aplikace je soukromé silo.
6. **`remindAt` je lokální řetězec času na hodinách (`YYYY-MM-DDTHH:mm`), ne okamžik v ISO** - záměrná výjimka z konvence „všechna časová razítka jsou ISO řetězce“.
   Připomenutí je čas na hodinách, ne okamžik: uložené v UTC by denní připomenutí v 09:00 po změně letního času ukazovalo 08:00, zatímco kalendář by ho dál spouštěl v 09:00.
   Hodnota je přesně to, co `<input type="datetime-local">` vydává a přijímá, a do `.ics` se zapisuje jako plovoucí čas (bez `Z`, bez `VTIMEZONE`).
   Opakování je jeden řádek `RRULE:FREQ=`; protože spouštění obstarává kalendář, aplikace nemá vůbec žádnou aritmetiku pro posouvání termínů dopředu.
7. **Umístění se řídí existujícím testem lišty editoru** - „může se to týkat poznámky, která ještě nemá kartu?“.
   Koncept může nést připomenutí, takže zvonek sedí v `NoteEditorBar` vedle barvy a připnutí a id konceptu získává přes `ensureNoteId` (od M6 slice 5, 2026-10-03, přes `ensureSaved()` konceptu).
   Karta zobrazuje jen čip pro čtení a žádný ovládací prvek nezískává; neexistuje cíl navigace pro připomenutí ani filtr přehledu.
   Vstupy jsou nativní `datetime-local` a `select`, takže telefon použije svůj vlastní výběr a nepřidává se žádná knihovna pro výběr data.

## Důsledky

- **Jak se soubor dostane do kalendáře, není na zařízení ověřené**, a proto je to izolované za jedinou funkcí `handOff(file)`: soubor se sdílí, když to `navigator.canShare({ files })` dovolí, jinak se stáhne.
  Zda nainstalovaná samostatná PWA na Androidu otevře obrazovku kalendáře pro přidání události z některé z těchto cest, lze změřit jen v nainstalované aplikaci; pokud ani jedna, oprava patří dovnitř této funkce (známou třetí možností je odkaz na šablonu Google Kalendáře).
- Google Kalendář údajně při importu ignoruje `VALARM` a použije výchozí oznámení uživatele, takže aplikace řídí, *kdy událost je*, ne nutně kdy telefon zabzučí.
- Jednorázové připomenutí, jehož čas uplynul, zůstává na kartě přeškrtnuté **po dobu jednoho dne** a poté se poznámka tváří, jako by připomenutí neměla: žádný čip, zhasnutý zvonek, prázdný popover (doplněno 2026-09-20; původně zůstávalo do zrušení a stěna přeškrtnutých čipů je nepořádek).
  Jde o způsob, jak poznámku *zobrazit*, nikdy o zápis, stejně jako propadání u seznamu úkolů.
  Aby pole mazala sama aplikace, bylo zamítnuto: zvýšilo by to `updatedAt`, přeuspořádalo přehled řazený podle poslední úpravy, v M5 by se to synchronizovalo jako úprava a potřebovalo by to úklid - právě ten časovač, kterému se tento návrh vyhýbá.
  Cenou jsou dvě zastaralá pole v řádku, dokud je nepřepíše další připomenutí; cestují se zálohou i synchronizací a nic neznamenají.
- Opakované připomenutí nikdy nepropadne, protože ho kalendář stále spouští.
- Pokud se M5 někdy k push vrátí, pole se nezmění; spouštění by bylo přidaným kanálem, ne novým modelem.
