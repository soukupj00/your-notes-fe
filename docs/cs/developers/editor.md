# Editor

Tělo poznámky se píše v editoru [TipTap 3](https://tiptap.dev) a ukládá se jako HTML.
Všechno bohatší než text, seznam úkolů, fotka, kresba, žije uvnitř tohoto těla.
Kód je v `src/components/editor/`; jeho [`CLAUDE.md`](https://github.com/soukupj00/your-notes-fe/blob/main/src/components/editor/CLAUDE.md) podrobně popisuje pasti.

## Každé tlačítko patří svému rozšíření

Každá schopnost je rozšíření a rozšíření, které má tlačítko na panelu nástrojů, si ho deklaruje samo ([ADR 0004](../adr/0004-canonical-editor-toolbar-pattern.md)).
Neexistuje žádný centrální seznam tlačítek, od kterého by se panel nástrojů mohl odchýlit.

Běžný případ je upstreamové rozšíření TipTapu plus volba `button`, sestavené pomocí `withButton`:

```ts
export const Bold = withButton(withoutKeys(TiptapBold, ['Mod-b', 'Mod-B']), ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    icon: 'Bold', // a key into src/components/icons/icons.ts
    tooltip: t('editor.bold.tooltip'),
    toggle: true,
  },
}));
```

- Značky a bloky s jedním tlačítkem jsou deklarace v `extensions/formatting.ts`.
- Rozšíření s něčím navíc, například s node view nebo pluginem, dostane vlastní složku, `extensions/<Name>/`.
- `icon` je textový klíč do `src/components/icons/icons.ts`; nikdy neimportujte komponentu ikony do konfigurace tlačítka.
- `withoutKeys` odebere původní klávesu: každá příkazová klávesa je zkratka uživatele, kterou váže jeden plugin čtoucí aktuální předvolbu ([ADR 0026](../adr/0026-shortcuts-are-one-preference-matched-by-one-key-name.md)).
  Nová akce s klávesou dostane řádek v `lib/shortcuts.ts` a položku v `extensions/Shortcuts/actions.ts`.
- `extensions/build.ts` vyjmenovává v jedné funkci každé rozšíření, které editor připojí, takže testy kontrolují panel nástrojů proti skutečné sadě.

## Panel nástrojů patří uživateli

Panel nástrojů se skládá z položek: jednoho tlačítka, nebo skupiny souvisejících tlačítek sbalené do jedné nabídky ([ADR 0011](../adr/0011-toolbar-items-and-families.md)).
Každá položka má stabilní id v `toolbar/registry.ts`, které ji mapuje na její ikonu, název, skupinu a tlačítko rozšíření, které vykresluje.
Nabídka lomítka používá stejná id, takže se ti dva nemohou rozcházet.

Které položky se zobrazí a v jakém pořadí, je předvolba s jedním rozvržením panelu nástrojů pro každou šířkovou třídu: úzkou pro úzká okna, širokou pro ostatní ([ADR 0016](../adr/0016-width-decides-layout-pointer-decides-affordances.md)).
`reconcileLayout` (`toolbar/resolveLayout.ts`) uvede uložené rozvržení do souladu s registrem, aniž by cokoli ztratil, takže položka přidaná v nějakém release zaujme své výchozí místo bez migrace.

## Dvě pravidla, která ho drží rychlý

- **`content` se čte jednou.**
  Editor se nikdy nevytváří znovu; pozdější změna se do dokumentu dostane přes `setContent`.
- **Nic, co se předává editoru, nesmí být reaktivní.**
  TipTap při každém renderu znovu kontroluje své volby, takže pole rozšíření i `editorProps` jsou memoizované.
  Živá hodnota se k rozšíření dostane přes stabilní getter a překlady se vyhledávají, až když se tlačítko vykresluje, nikdy se neukládají při sestavení.

## Přílohy

Pět druhů, obrázek, zvuk, video, soubor a kresba, jsou vlastní uzly z jedné továrny, `createAttachmentNode`.

- **Tělo poznámky ukládá jen id**, jako `data-attachment-id`, nikdy bajty ani URL.
  Bajty jsou v lokálním úložišti a node view z id udělá object URL, dokud je uzel na obrazovce.
- **Fakta o každém druhu jsou jeden řádek** `ATTACHMENT_SPECS` v `src/lib/attachments.ts`: jaké MIME typy přijímá, jeho limit velikosti, tag, jako který se zapisuje, a co nabízí výběr souborů.
- **Jedna cesta od souborů k uzlům**, `attachments/insert.ts`, slouží vložení ze schránky, přetažení, panelu nástrojů, nabídce lomítka i rychlým startům.
  Validuje, odvodí, co daný druh potřebuje (miniaturu, plakátek, délku), uloží a umístí uzel.
- **Bajty se nikdy nemění.**
  Opětovné uložení kresby vytvoří novou přílohu a přesměruje na ni tělo poznámky; stará se uklidí, jakmile na ni nic neodkazuje.
  Právě to umožňuje synchronizaci přenášet bajty bez jakéhokoli pravidla pro konflikty.

### Přidání druhu přílohy

Druhy jsou součástí kontraktu protokolu, takže nový druh začíná na serveru.

1. Přidejte druh do `AttachmentKind` v kontraktu v repozitáři serveru a pak zde spusťte `pnpm contract:pull`.
2. Přidejte ho do `ATTACHMENT_KINDS` v `src/models.ts` a dejte mu řádek v `ATTACHMENT_SPECS`.
3. Vytvořte `extensions/<Kind>/` s node view a továrnou podle vzoru `extensions/Video/`:

   ```ts
   export function createVideo(getDeps: () => AttachmentDeps) {
     return createAttachmentNode(getDeps, {
       kind: 'video',
       nodeView: VideoNodeView,
       button: pickerButton('video', 'FileVideo'),
     });
   }
   ```

4. Připojte ho v `extensions/build.ts` a dejte mu položku panelu nástrojů v `toolbar/registry.ts` a záznam v `SlashMenu/slashItems.ts`.
5. Pokud lze soubory tohoto druhu vkládat ze schránky nebo přetahovat, přidejte ho do `TRANSFER_KINDS` v `attachments/insert.ts`.
6. Rozhodněte, jak ho zobrazí karta (`src/components/cards/CardMedia.tsx`) a jak stránka odkazu pro sdílení (`src/components/share/sharedBody.ts`).
7. Přidejte jeho texty do obou jazyků a jeho řádky do tabulkových testů v `extensions/attachments/`.

## Seznamy úkolů

Seznam úkolů je task list TipTapu uvnitř těla poznámky.
Odškrtnuté položky propadají pod neodškrtnuté díky CSS pravidlu `order`, nikdy jejich přesunem v dokumentu ([ADR 0013](../adr/0013-checklist-sinking-is-presentation-not-storage.md)).
Uložené pořadí je pořadí, v jakém je uživatel napsal, a právě to přenáší záloha i synchronizace.
`extensions/TaskList/ChecklistFlip.ts` jen animuje přesun mezi oběma místy.

## Testování rozšíření

Rozšíření se testují headless: sestavte `new Editor({ extensions: [...] })` z `@tiptap/core`, ovládejte `editor.commands` a kontrolujte `editor.getHTML()` a `editor.isActive()`.
Šablonou je `extensions/formatting.test.ts`, jedna tabulka s řádkem pro každé rozšíření.
