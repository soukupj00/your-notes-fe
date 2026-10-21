# 0019 - Import nahrazuje obnovení: jedna aditivní operace pro každý zdroj

- Stav: přijato
- Datum: 2026-08-21

## Kontext

Od M4 slice 1 má aplikace zip zálohu a obnovení, které vše nahradí: obnovení vymaže všechny tabulky a v jedné transakci zapíše řádky ze zálohy.
M4 odložila „slučovací import“ až na dobu před vydáním.

Aplikace teď chce přebírat poznámky z jiných aplikací - nejprve z Google Keep, potom z Obsidianu - protože se profiluje jako „alternativa ke Google Keep, kterou si hostujete sami“, a první, co přecházející uživatel udělá, je, že si přinese své poznámky.
Cizí soubor nelze obnovit: nikdo nechce, aby se mu smazaly vlastní poznámky, aby se uvolnilo místo pro archiv z Keepu.
Vedle destruktivní cesty tak měla vzniknout druhá, aditivní, se dvěma tlačítky v Nastavení, jejichž rozdíl by uživatel musel pochopit dřív, než stiskne kterékoli z nich.

## Rozhodnutí

**Existuje jedna operace, import, a pro každý zdroj je aditivní.
Obnovení nahrazující vše se odstraňuje.**

- Poznámka v souboru, kterou aplikace nikdy neviděla, se přidá.
- Poznámka, kterou aplikace už má - se stejným id - se bezpodmínečně přepíše verzí ze souboru, bez ohledu na to, která je novější.
  Uživatel si soubor vybral záměrně; „soubor vyhrává“ je pravidlo, které dokáže předvídat.
- Id, která aplikace pozná, nese jen její vlastní záloha.
  Poznámky z jakéhokoli jiného zdroje jsou vždy nové, takže dvojí import téhož cizího souboru vytvoří dvě kopie.
  Žádné cizí id se neukládá.
- Štítky se párují s existujícími štítky podle názvu bez ohledu na velikost písmen a chybějící se vytvoří.
- Nic se nikdy nevyprázdní.
  Poznámka vytvořená po záloze přežije; poznámka přesunutá do koše po záloze se vrátí.

Zdroj se rozpozná z obsahu zipu, nikdy se na něj neptá: `manifest.json` v kořeni znamená zálohu, `Takeout/Keep/*.json` je Google Keep, strom souborů `.md` je vault z Obsidianu.
Jedno tlačítko, jeden vstup pro soubor.

## Důsledky

- Případ užití „vrať toto zařízení přesně do stavu, který držela záloha“ zaniká.
  Co se místo toho vrátí, je dosažitelné: obnovená poznámka leží v koši nebo v přehledu a lze ji znovu zahodit.
  Přijato, protože to odstraňuje jediné destruktivní tlačítko v aplikaci a jediný způsob, jak by uživatel mohl jedním kliknutím přijít o všechno.
- Upsert podle id má stejný tvar jako pravidlo pro konflikty synchronizace v M5 ([ADR 0017](./0017-note-level-last-writer-wins-with-conflicted-copies.md)), takže se uživatel učí jediný model: poznámka má identitu a vyhrává to nejnovější, co s touto identitou záměrně uděláte.
- `restoreBackup` a jeho potvrzení „nejdřív uložit moje současná data“ přežívají v duchu: nabídka zálohy před importem zůstává a je ve výchozím stavu zaškrtnutá jen tehdy, když je zdrojem záloha (jediný zdroj, který může přepisovat).
- Opakovaný import cizího zdroje s ohledem na duplicity (přeskočit už importované poznámky) by vyžadoval uložené cizí id v poznámce a řešení jeho synchronizace.
  Odloženo, dokud o to někdo nepožádá.

## Zvažované alternativy

- **Ponechat obnovení a přidat vedle něj import.** Dvě cesty, dvě tlačítka, jedno z nich destruktivní. Zamítnuto z výše uvedeného důvodu.
- **Upsert jen tehdy, když je `updatedAt` v souboru novější.** Na papíře bezpečnější, v praxi nepředvídatelné: uživatel nevidí, kterých poznámek se import dotkl a které potichu přeskočil.
- **Ukládat cizí id a při opakovaném importu odstraňovat duplicity.** Užitečné, ale znamená to změnu schématu a otázku synchronizace kvůli scénáři druhého spuštění, který zatím nikdo nemá.
