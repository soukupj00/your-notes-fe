# The editor

A Note's Body is written in a [TipTap 3](https://tiptap.dev) editor and stored as HTML.
Everything richer than text, a Checklist, a photo, a drawing, lives inside that Body.
The code is in `src/components/editor/`; its [`CLAUDE.md`](https://github.com/soukupj00/your-notes-fe/blob/main/src/components/editor/CLAUDE.md) holds the traps in detail.

## Every button belongs to its extension

Each capability is an Extension, and an Extension that has a toolbar button declares it itself ([ADR 0004](../adr/0004-canonical-editor-toolbar-pattern.md)).
There is no central list of buttons for the toolbar to drift from.

The common case is the upstream TipTap extension plus a `button` option, built by `withButton`:

```ts
export const Bold = withButton(TiptapBold, ({ editor, t }) => ({
  component: ActionButton,
  componentProps: {
    action: () => editor.commands.toggleBold(),
    isActive: () => editor.isActive('bold'),
    icon: 'Bold', // a key into src/components/icons/icons.ts
    shortcutKeys: ['Mod', 'B'],
    tooltip: t('editor.bold.tooltip'),
    toggle: true,
  },
}));
```

- One-button marks and blocks are declarations in `extensions/formatting.ts`.
- An extension with more, such as a node view or a plugin, gets its own folder, `extensions/<Name>/`.
- `icon` is a string key into `src/components/icons/icons.ts`; never import an icon component into a button config.
- `extensions/build.ts` lists every extension the editor mounts, in one function, so tests check the toolbar against the real set.

## The toolbar is the user's

The toolbar is made of Toolbar Items: a single button, or a Family of related buttons collapsed into one menu ([ADR 0011](../adr/0011-toolbar-items-and-families.md)).
Each Item has a stable id in `toolbar/registry.ts`, which maps it to its icon, name, Family and the extension button it renders.
The slash menu uses the same ids, so the two cannot disagree.

Which Items show, and in what order, is a Preference with one Layout per Width Class: Compact for narrow windows, Wide for the rest ([ADR 0016](../adr/0016-width-decides-layout-pointer-decides-affordances.md)).
`reconcileLayout` (`toolbar/resolveLayout.ts`) brings a stored Layout up to date with the registry without losing anything, so an Item added in a release takes its default place with no migration.

## Two rules that keep it fast

- **`content` is read once.**
  The editor is never recreated; a later change reaches the document through `setContent`.
- **Nothing passed to the editor may be reactive.**
  TipTap re-checks its options on every render, so the extensions array and `editorProps` are memoised.
  A live value reaches an extension through a stable getter, and translations are looked up when a button renders, never stored at build time.

## Attachments

The five kinds, Image, Audio, Video, File and Drawing, are custom nodes from one factory, `createAttachmentNode`.

- **The Body stores only an id**, as `data-attachment-id`, never the bytes or a URL.
  The bytes are in the Local Store, and a node view turns the id into an object URL while it is on screen.
- **Each kind's facts are one row** of `ATTACHMENT_SPECS` in `src/lib/attachments.ts`: which MIME types it takes, its size cap, the tag it is written as, and what the file picker offers.
- **One path from files to nodes**, `attachments/insert.ts`, serves paste, drop, the toolbar, the slash menu and the quick-capture Starts.
  It validates, derives what the kind needs (a thumbnail, a poster, a duration), stores, and places the node.
- **Bytes never change.**
  Saving a Drawing again creates a new Attachment and points the Body at it; the old one is swept when nothing references it.
  That is what lets Sync move bytes without any conflict rule.

### Adding an Attachment kind

The kinds are part of the wire contract, so a new one starts on the server.

1. Add the kind to the contract's `AttachmentKind` in the server's repository, then run `pnpm contract:pull` here.
2. Add it to `ATTACHMENT_KINDS` in `src/models.ts` and give it a row in `ATTACHMENT_SPECS`.
3. Create `extensions/<Kind>/` with a node view and a factory, following `extensions/Video/`:

   ```ts
   export function createVideo(getDeps: () => AttachmentDeps) {
     return createAttachmentNode(getDeps, {
       kind: 'video',
       nodeView: VideoNodeView,
       button: pickerButton('video', 'FileVideo'),
     });
   }
   ```

4. Mount it in `extensions/build.ts`, and give it a Toolbar Item in `toolbar/registry.ts` and an entry in `SlashMenu/slashItems.ts`.
5. If files of this kind can be pasted or dropped, add it to `TRANSFER_KINDS` in `attachments/insert.ts`.
6. Decide how a Card shows it (`src/components/cards/CardMedia.tsx`) and how a Share Link page does (`src/components/share/sharedBody.ts`).
7. Add its strings to both locales, and its rows to the table-driven tests in `extensions/attachments/`.

## Checklists

A Checklist is TipTap's task list inside the Body.
Ticked items sink below unticked ones by a CSS `order` rule, never by moving them in the document ([ADR 0013](../adr/0013-checklist-sinking-is-presentation-not-storage.md)).
The stored order is the order the user typed, and it is what a Backup and Sync carry.
`extensions/TaskList/ChecklistFlip.ts` only animates the travel between the two places.

## Testing an extension

Extensions are tested headless: build a `new Editor({ extensions: [...] })` from `@tiptap/core`, drive `editor.commands`, and check `editor.getHTML()` and `editor.isActive()`.
`extensions/formatting.test.ts` is the template, one table with a row per extension.
