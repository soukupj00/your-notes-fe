# 0026 - Klávesové zkratky jsou jedna předvolba s jedním názvem klávesy

- Stav: přijato
- Datum: 2026-10-22

## Kontext

První uživatelský test si vyžádal klávesové zkratky, které si uživatel může změnit.
Do té doby byly klávesy editoru výchozí klávesy TipTapu, klávesu vyhledávání obsluhoval `react-hotkeys-hook` a klávesa pro novou poznámku byla jednopísmenná předvolba porovnávaná s `event.key`.
Tři různá rozpoznávání pojmenovávala stisk klávesy třemi způsoby, takže se nedalo spolehnout, že klávesa nahraná v Nastavení zafunguje tam, kde se používá.
Klávesové mapy TipTapu jsou pevně dané při sestavení editoru, a poznámka přitom může zůstat otevřená, zatímco uživatel mění klávesu na jiné kartě.

## Rozhodnutí

**Každá zkratka, editoru i obě celoaplikační, je jedna položka jedné předvolby a každý stisk klávesy se pojmenuje jedním způsobem.**

- `lib/key-combo.ts` pojmenuje stisk stejně jako ProseMirror (`Mod-Shift-8`, `Mod-b`, `n`), pomocí `w3c-keyname`.
  Nahrávání v Nastavení i každé rozpoznávání používá tento název, takže co se nahraje, to se spustí.
- Předvolba ukládá jen změny uživatele, `null` pro vymazanou zkratku; výchozí hodnoty jsou v `lib/shortcuts.ts`.
  Je to předvolba, takže patří zařízení, stejně jako rozložení panelu nástrojů.
- Editor neváže žádnou příkazovou klávesu sám.
  Původní vazby každé přizpůsobitelné akce jsou odstraněné a jeden plugin (`extensions/Shortcuts/`) čte aktuální vazby při každém stisku, takže změna se do otevřené poznámky dostane hned.
  Původní zůstávají jen klávesy pro psaní a úpravy: výběr všeho, schránka, Enter a Backspace s Mod a Mod-Alt-0 pro odstavec.
- Kombinace je jedinečná v rámci rozsahu: `app` (nová poznámka, vyhledávání) a `editor`.
  Ctrl+K je tedy vyhledávání mimo poznámku a odkaz uvnitř ní.
  Duplicitu Nastavení odmítne a nabídne ji převzít od jejího vlastníka.
- Jedna klávesa na akci.
  Znovu je jen Ctrl+Shift+Z; druhá vazba TipTapu, Ctrl+Y, zmizela.
- Na Windows je Ctrl+Alt zároveň AltGr.
  Stisk, který tam napíše znak, je psaní, nikdy zkratka, a Nastavení ho odmítne nahrát.
- Klávesy, které si nechává prohlížeč (Ctrl+W, Ctrl+T, Ctrl+N a podobné), jsou odmítnuté.
  Zkratka editoru potřebuje Ctrl, Cmd nebo Alt; celoaplikační může být jediná klávesa, která se ale v poli nikdy nespustí.

## Zvažované možnosti

- **Ponechat klávesové mapy TipTapu a při změně klávesy editor sestavit znovu.**
  Zamítnuto: nové sestavení ztratí výběr a historii zpět v otevřené poznámce.
- **Ukládat všechny zkratky včetně výchozích.**
  Zamítnuto: změněná výchozí hodnota by se nikdy nedostala k uživateli, který si uložil jakoukoli klávesu.
- **Povolit více kláves na akci.**
  Zamítnuto: Nastavení by potřebovalo seznam v každém řádku, pro potřebu, kterou nikdo nevznesl.

## Důsledky

- Ctrl+Y už nic neopakuje.
- Nápověda tlačítka ukazuje klávesu uživatele, nebo žádnou, když je vymazaná, protože panel nástrojů čte stejnou předvolbu.
- Přidat akci editoru se zkratkou znamená řádek v `SHORTCUTS`, položku v `EDITOR_ACTIONS` a odstranění její původní klávesy; `shortcuts.test.ts` selže, pokud nějaká příkazová klávesa zůstane navázaná.
