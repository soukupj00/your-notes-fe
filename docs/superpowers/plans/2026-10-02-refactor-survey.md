# Refactor survey, 2026-10-02

Evidence behind PLAN.md milestone M6 and ADR 0022: four read-only surveys of the code on the day's `main` (merge ddc5e9d).
File:line references are as of that commit and will drift; the per-slice plans restate what they need.
Delete this file once the M6 slices and the tickets have landed.


Four read-only Explore agents. Paths relative to repo root unless noted. Nothing was edited.

## Repo-wide facts (my own greps)

- 319 non-test ts/tsx files, 166 test files, 23,663 non-test lines.
- 121 `interface` declarations; 5 classes (AttachmentError, BackupError, ProblemError, NotesDB extends Dexie, ErrorBoundary); 0 `implements`; 22 exported `create*` closure factories.
- No decorators enabled in tsconfig. HOC-style `with*` wrappers: withStore (test), withReceived (syncRows), withDerivedAttachmentData (insert.ts), withUndo (NoteCard local).
- 11 mark/block extensions are 26-29 line files differing from Bold.ts by ~9 lines each (name, command, shortcut, icon, key).
- Thesis (ni-dip-thesys, 24 .tex) has zero mentions of OOP / design patterns / SOLID.

## A. Data + sync (explore-data)

Bugs/drift:
- CONFIRMED (run in vitest): note gets rev 3 via applied; purged unpushed; notes.add reuses id. Dexie dirty() shows rev=undefined, Memory rev=3. Cause: Dexie add uses owed(note, undefined) at DexieLocalStore.ts:100 (tags.add same at :146); Memory write() at :47 takes the Tombstone's rev. No contract test covers it. Low reachability today.
- "What is owed" computed 3 ways: engine owedForServer :132 applies exclude (Tour Props); SignOutButton.tsx:36 calls sync.dirty() without exclude; pending() counts excluded rows. UNVERIFIED: leftover Props may block sign-out.
- loop.ts:1/:73 imports ProblemError from http for 401; :83 treats fetch TypeError as offline. HalRemote translates 410/413/404 at :38/:76/:84 but not 401/network.

Inventory:
- LocalStore (LocalStore.ts:68): 2 impls (DexieLocalStore.ts:21, MemoryLocalStore.ts:34), 3 contract suites. Dexie builds sync half separately (dexie/sync.ts:19 createDexieSync); Memory inline at :285.
- Live<T> live.ts:7: 3 impls (dexie/live.ts, memory :77, emptyLive live.ts:14).
- Remote (Remote.ts:55) and AccountService (:102): ONE impl each (HalRemote, HalAccountService). No in-memory Remote; engine/loop tests run real HalRemote over fetch-level fakeServer (engine.test.ts:40-44, loop.test.ts:36-40). Remote.identity() has no production caller.
- HalClient hal.ts:26, SyncEngine engine.ts:24, SyncLoop loop.ts:9: single-impl types.
- newNote lib/new-note.ts:8 is the only entity factory; Tag/NoteTag/Attachment literals built inline.
- main.tsx:16-17 picks memory store by URL path (a runtime switch, contra ADR 0020 wording).

Dexie vs Memory parallel control flow (syncRows.ts shares row transforms, NO control flow):
- sync.applied: sync.ts:51-85 / Mem :294-320 (~35/27 lines)
- sync.applyPage: sync.ts:87-130 / Mem :321-359 (~44/39)
- write-owed-and-take-back-Tombstone: Dexie writeNote :38, writeTag :44, addLinks :51 (two copies); Memory generic write() :47
- remove-leaving-Tombstone: Dexie inlined 4x :124,:156,:183,:199; Memory remove() :53
- tags.merge: Dexie :158-186 / Mem :182-200
- replaceAll keeping revs: Dexie :295-322 / Mem :411-428
- attachment add/update/delete with noteOwed: Dexie :222-240 / Mem :226-246
- resetClean/adoptAll/pending/transfers/onServer/tooLarge/received: sync.ts:131-181 / Mem :360-403
- NOT duplicated: readFeed/tagsFor, live mechanics, meta, transaction scoping.
- Total ~150 Dexie + ~110 Memory parallel lines.

Action hooks:
- `new Date().toISOString()` at 10 sites: useNoteActions :56/:77/:101/:121, useTagActions :23/:37/:52, useAttachmentActions :22/:55/:79; both stores' merge also stamps (:169/:185, contra "store stamps nothing").
- updateNote :54-57 and transition :75-78 repeat update+stamp.
- Two id minters: uuid pkg (new-note.ts, useTagActions :24, useAttachmentActions :24/:31/:58/:84) vs crypto.randomUUID (conflictedCopy :21/:39/:51, sync/attachments :88, NotesView :67).
- Entity literals duplicated: Tag useTagActions :24 vs conflictedCopy :22; NoteTag :53 vs :70; Attachment clone useAttachmentActions :53-70 vs conflictedCopy :57-62 (different semantics: hook re-stamps + slices blob, copy keeps timestamps).
- useTagActions not memoized (others are). updateTag non-atomic get-then-put :30/:39 (notes have atomic update(id, change)).

Engine: plain closures over LocalStore+Remote; run coalescer engine.ts:211-225; attachments.ts pure plan() :24 + executor :76; no retry logic (loop backoff :96-101; transfers re-plan :106/:117); resolve() :110-130 is 20 lines of branching.

HTTP adapters: hal.json(schema,url,init) already generic (hal.ts:40-46, :57-71). Repeats: catch ProblemError status N -> sentinel 4x (HalRemote :38/:76/:84, HalAccountService :49); list-find-throw404-follow 3x (revokeDevice :67-74, resetPassword :101-110, revokeShare :121-127); resetPassword hand-builds JSON :106-110; publicShare.ts:11-25 re-implements json() with credentials omit and no problem+json; :30 re-implements template expansion from hal.ts:87.

Seam leaks: 8 files outside hooks/data call useLocalStore (SyncProvider, TourProvider, BackupSection legit). tag.$id.tsx:12 and useTopbar.ts:24-26 both `useLive(() => store.tags.watch(id))` (missing useTag). NoteEditorDialog.tsx:129, SharesSection.tsx:25 one-shot notes.get. SignOutButton.tsx:36/:43 sync.dirty()+store.clear(). Components import ProblemError from http: AccountForm :6, ShareButton :17, pair.tsx :7. Dead surface: notes.list, notes.put, tags.list, attachments.list only in contract tests; Remote.identity no caller.

Ranked: 1 shared sync algorithms via read/decide/write split (store reads, pure fn returns puts+deletes, store executes; keeps Memory sync + Dexie in-tx). 2 seam-level errors on Remote (SignedOut, Unreachable) so loop.ts drops http import. 3 split SyncStore off LocalStore (ISP) + engine-owned owed query with exclude. 4 newTag/newLink/cloneAttachment with one id source. 5 tags.update(id, change). 6 two HAL combinators (onStatus, find-then-follow) + export template expander. 7 delete dead surface.
Ceremony: store factory/DI; abstract BaseLocalStore; Strategy/State for resolve/loop; Repository wrappers; generic DTO mapper; retry decorator; useStoreLive.

Docs drift: data/CLAUDE.md "only src/sync calls sync.*" (SignOutButton :36, SyncProvider :71); "store stamps nothing" (merge stamps); "no runtime switch" (main.tsx URL path); Remote.ts:59 identity-in-meta claim (adopt gets accountId from session, SyncProvider :147); Remote.ts:57 S3 claim; ADR 0020 memory-for-hook-tests vs test/store.tsx:7-8 defaults Dexie; hooks/data/CLAUDE.md: useNoteActions mints ids (newNote does), attachment table omits watchAttachment/updateAttachment, addTagToNote check now in store; hooks/data/PLAN.md per-entity sync state contradicts store-private; data/PLAN.md seeder refactor (deleted).

## B. Editor (explore-editor; paths relative to src/components/editor/)

Bugs:
- Slash-menu video item (SlashMenu/slashItems.ts:115) calls generic insertAttachmentFiles; toolbar/paste/drop use insertVideoAttachmentFiles which stores poster + pixel size. Not run in browser.
- Mic error toast repeats every keystroke: editor.tsx:422 passes `getDeps={() => attachmentDepsRef.current}` (new fn per render); AudioRecorderHost.tsx:44 lists getDeps as effect dep; shouldRerenderOnTransaction on (editor.tsx:283). Reproduced with throwaway component test (3 toasts for 3 renders). Fix: pass existing stable getAttachmentDeps.
- Video and File have no loading placeholder (Image has one ImageNodeView.tsx:60).

Inventory:
- Pattern A `button` (button-types.ts:12-15): 25 extensions, consistent. ButtonView only allows ActionButton but 10 of 31 registry items render custom components -> 5 local XButtonView copies (Color.ts, Highlight.ts, FontFamily.ts, FontSize.ts, Link.ts); createAttachmentNode returns unknown (:15). 22 `as unknown as` casts in extensions.
- createAttachmentNode: 5 users, sound (schema, attachmentId attr, parse/render, NodeView hookup, insert command with cursor advance, button binding).
- getDeps factories: createImage/Audio/Video/File/Excalidraw/SlashMenu/Mathematics take getters; createLink(t) does not.
- Registry (toolbar/registry.ts): 31 items, 10 families; id space for bar, Settings, preview strip, slash menu. Slash registry 15 items keyed by toolbar id.
- Adapters EditorColorPickerButton / EditorTextStyleSelect: 2 variants each behind config record; each variant has a 13-15 line wrapper fixing `variant` (TextColorButton, HighlightButton, FontFamilyButton, FontSizeButton).
- ActionButton everywhere except EditorTextStyleSelect.tsx:100-120 hand-rolls trigger+tooltip.

Simple extensions: 11 files (Bold, Italic, Strike, Underline, Code, CodeBlock, Blockquote, HorizontalRule, BulletList, OrderedList, TaskList) ~296 lines; ~19 boilerplate lines each. `withButton(Upstream, ctx => props)` -> ~8 lines each, removes 11 casts; also serves Heading/TextAlign/History arrays. Five mark tests -> one describe.each.

Attachments still copied per kind: command type augmentation 6 lines x5 (Image.ts:6-12, Video.ts:7-13, File.ts:7-13, Audio.ts:15-26, Excalidraw.ts:7-13; needed for typing); inline button param types 8 lines x4 (Image relies on inference; 32 lines deletable); NodeView preamble ~35 lines x3 (Image/Video/File: deps, state, canDelete, delete button, remote+missing branches; Image vs Video differ in one fallback key); Audio builds delete button twice (:24, :98) + own missing state; Excalidraw re-implements live row subscription (ExcalidrawNodeView.tsx:21 vs attachments/useAttachmentObjectUrl.ts:24); picker buttons ImageButton/VideoButton/FileButton 27-29 lines differing in icon/accept/insert fn; insert routing in 4 places (3 buttons, slashItems.ts:89-131, editor.tsx:87-112 + :338, AudioRecorderHost.tsx:67 which bypasses pipeline and maps every failure to insert-failed); insertAttachmentFiles unused `_editor` (insert.ts:50).

Registry vs extensions: registry copies icon, shortcut, labelKey. Shortcuts pinned both ways (shortcuts.test.ts:85-101). Icons unpinned (registry.test.ts:74 existence only; :95 five array buttons); hand-compared 31, none drifted. 10 custom items hardcode icon in component (LinkButton.tsx:70, ImageButton.tsx:20, EditorColorPickerButton VARIANT_CONFIG). Per-extension registry entries would break Settings/ToolbarPreviewStrip/slash (all read registry without live editor; preview strip must keep TipTap out of settings bundle, ToolbarPreviewStrip.tsx:14-16). Keep registry as source; at most icon pin or resolveItemButton injects icon.

Non-component logic: editor.tsx 457 lines holds Excalidraw session open/save (:145-190, :356-382 -> useExcalidrawSession), autoplay first-audio scan (:295-325 -> pure firstAudioId(doc)), paste/drop router (:87-112). ExcalidrawDialog.tsx 238: fingerprint fns :26-48 pure -> scene.ts; pointer clamp :88-117 -> hook. EditorToolbar useEdgeFade :35-66 fine. Button factories run several times per render (EditorToolbar.tsx:95, ToolbarFamilyMenu.tsx:52, :35, ToolbarLeaf); Heading builds 3 views to return one, every keystroke (unmeasured). useAudioRecorder.ts 186 lines state machine hook: leave.

getDeps: editor.tsx three ref+getter triples (attachmentDepsRef :218-220, animateChecklistRef :224-226, editorRef inline); unstable getter :422. `t` arrives 3 ways (BuildOptions capture, deps.t, ButtonContext.t). useLatest(value) hook replaces triples and fixes :422 by construction. Don't fold getEditor/animate into AttachmentDeps.

Ranked: 1 strategy table keyed by kind for inserts (one insertFiles(kind, editor, files, deps); removes Image/insert.ts, Video/insert.ts, 3 button onFiles, 3 slash bodies, editor.tsx:87-112; fixes slash video bug; insert.test.ts covers). 2 template-method NodeView shell (shared hook: deps/state/delete button + shell drawing remote/missing with ready slot; ~100 lines from Image/Video/File; Audio needs inline-delete option; leave Excalidraw out). 3 withButton helper for 11 simple ext (~200 lines, 11 casts; risk TipTap generic typing on .extend). 4 generic ButtonView<C> (removes 5 XButtonView + unknown). 5 delete 4 variant wrappers (pass variant via componentProps). 6 useLatest. 7 LinkButton.tsx:41-63 repeats applyLink from linkPrompt.ts:33-51.
Ceremony: generic Coordinator<T> over the 3 coordinators (different semantics, linkPrompt.ts:9-11); strategy classes for 2-variant adapters; base class/interface over createAttachmentNode; layout files already small pure; slash renderer and ActionButton single product.

Docs drift: CLAUDE.md:57 "mismatch to fix in M1" (M1 done); :86 Attachment/Selection stubs don't exist; :136 FontSection vs :23 sections gone; :139 Clear listed as toggle w/ highlight but Clear.ts:21 has no isActive; :61 Pattern A list omits Code/CodeBlock/HorizontalRule/TextAlign/Link; PLAN.md:24/:30/:35 describe ExtensionButtonBar/hideOnMobile/Separators/popover TextColorButton (gone), :32-33 media to-do (shipped); ADR 0004 "toolbars stop importing Lucide" but ToolbarFamilyMenu.tsx:2, ToolbarPreviewStrip.tsx:1, ToolbarLayoutEditor.tsx:1 do; ADR 0004 single shared button vs EditorTextStyleSelect own trigger; toolbar/types.ts:30 vs ToolbarFamilyMenu.tsx:35 icon source; slashItems.ts:41 "and vice versa" false (16 items have none; test one direction); src/types.ts:1-6 second looser button contract used only by ActionButton for two fields.

## C. UI, pages, providers (explore-ui)

Repeated patterns:
- Async effect with cancel flag: 10 sites (ShareButton.tsx:40-50, DevicesSection.tsx:37-46 (+ copy as load 26-33), MembersSection.tsx:109-119, SharesSection.tsx:30-39, AccountProvider.tsx:48-63 + 68-90 (identical then bodies 51-56 vs 75-80), pair.tsx:32-41, share.tsx:26-37, SyncStatusSection.tsx:24-35, NoteEditorDialog.tsx:125-144).
- Remote action try/toast.success/catch toast.error('account.errors.unknown'): 6 sites (ShareButton.stop 78-89 and SharesSection.stop 43-51 same call+keys; DevicesSection.remove 49-57; SignOutButton.erase 31-51; PairingLinkButton.show 48-60; ShareButton.mint 54-76). Generic key 9x.
- Pick save target + write zip + toast exported: BackupSection.tsx:42-59, :90-95, SignOutButton.tsx:53-62 (verbatim).
- Copy link + toast: ShareButton.tsx:92-95, PairingLinkButton.tsx:62-66; no clipboard rejection handling; both dialogs repeat code-block+Copy+Done footer (ShareButton 113-133, PairingLinkButton 72-104).
- Confirm then act: ConfirmDialog at BackupSection:156, DevicesSection:89, SignOutButton:77, trash.tsx:34, labels.tsx:146; ConfirmDeleteButton labels.tsx:136; idiom `onOpenChange={(o)=>{if(!o)setX(null)}}` 4x.
- Lifecycle+snapshot+undo: NoteCard.tsx:57-71 withUndo (5 uses). Editor pin NoteEditorDialog.tsx:224-233 no undo. Optimistic no-revert: NoteEditorDialog 214-233, NoteCard 225. Reminder deliberately not optimistic (useNoteReminder.ts:20-44).
- Hidden file input: useStartPicker.tsx:27-40, BackupSection.tsx:143-150, AttachmentFilePickerButton.tsx:22-31.
- Busy button (Spinner+label): 7 sites.
- Media-query hook: useFinePointer.ts:5-22 and useReducedMotion.ts:6-16 identical subscribe/getSnapshot; use-mobile.tsx:8-25 third style.
- localStorage state: themeProvider.tsx:51-53,79-81 (unvalidated `as Theme`), viewModeProvider.tsx:25-32, useSidebarOpen.ts:7-15, PreferencesProvider (zod, cross-tab).
- Latest-value ref: SyncProvider.tsx:82-87,91,108,125-128; PwaUpdatePrompt.tsx:10-15.
- stopPropagation in Card: 8 sites (CardActions:48,62; CardPin:28; TagPills:39; CardMedia:250; NoteColorButton:30,34; NoteCard:98).
- Sticky toast: SyncProvider.tsx:111-123, PwaUpdatePrompt.tsx:24-35.

Logic in components:
- NoteEditorDialog.tsx:87-283 ~140 logic lines: draft persistence state machine, six refs (id, header/body mirrors, dirty, timer, saveChain); persist 146-160, ensureNoteId 164-181 (re-implements persist's create 149-151 vs 167-173), enqueueSave 190-196, autosave 236-248, close 269-283 (flush, purge if empty+no reminder, else collectOrphans). id leaks as `noteId|null + ensureNoteId` pair to NoteEditorBar, ShareButton, Editor (360), NoteTagsBar (own resolvedId copy NoteTagsBar.tsx:24-37).
- TourProvider.tsx 506 lines (>500 rule): index/busy mirrored in state+ref (77/79 vs 95/96, setRunning 273); write queue 119, sweep 142, goTo/end/start 278-389, nav guard 431, keys 448. makeStage 169 already adapts TourStage over router+store; driverConfig 220 adapts driver.js. Re-implements waitForTarget (steps.ts:52 private) at :260 and editor-gone wait (steps.ts:102) at :191.
- SyncProvider.tsx two jobs: loop lifecycle 139-170; reports->toasts/nav 91-124; lastSyncedAt read duplicated 92-94, 147-149.
- CardMedia.tsx:145-183 useVideoPosterBackfill: store-writing backfill from feed render, module-level Set guard.
- SignOutButton.tsx:31-51 orchestrates sync.dirty, signOut, sync.stop, store.clear, setSession.
- BackupSection.tsx:42-103 export/parse/confirm + safety copy.
- MembersSection.tsx:31-44 copies AccountForm.tsx:97-108 submit.
- NotesView.tsx:64-75 copies NoteOpenRequest into OpenIntent field by field; NoteOpenRequest (22-31) and OpenIntent (37-44) near-duplicates; intent travels as 4 loose props with renames NotesView 140-146 -> NoteEditorDialog 53-59 -> Editor 364-367.
- Leave: labels.tsx:59-66,152-156; pair.tsx:51-68; ShareButton.tsx:54-76.

Providers: App.tsx:39-63 LocalStore > Theme > ErrorBoundary > Preferences(+DocumentPreferences) > Motion > PwaInstall > Tooltip > ViewMode > Account > Router; __root.tsx:33-41 Tour > Sync > Layout. Throw outside: useLocalStore (LocalStoreProvider.tsx:23), usePreferences (:170), useViewMode (viewModeProvider.tsx:45), useTour (TourProvider.tsx:496). useTheme documented to throw but never does (context default themeProvider.tsx:20; check :89 dead). Default outside: useTourActive (505), useAccount (AccountProvider.tsx:114), useSync (SyncProvider.tsx:190), usePwaInstall (PwaInstallProvider.tsx:81). ThemeProvider value not memoized (82-88). Theme and ViewMode are Preferences per CONTEXT.md yet separate providers+storage.

Settings: 13 sections; all use SettingsSection, 11 SettingsRow; SegmentedSetting/SwitchSetting (SettingsSection.tsx:40-95) used 4 and 3 times. Per-preference-row boilerplate (usePreferences, value, onChange, options map). AppearanceSection.tsx 110 lines for 5 rows with 4 near-identical subcomponents (40-108); same at QuickCaptureSection.tsx:37-46, SyncStatusSection.tsx:84-91. 7 sections early-return null; 7 unused default exports. Only ~7 of ~30 rows are data-shaped: whole-page schema = ceremony; key-bound PreferenceSwitch/PreferenceSegmented = win.

Starts: one table quickCaptureActions.ts:35-69. Branches: picker-vs-direct DesktopCaptureBar.tsx:108 + QuickCaptureBar.tsx:79-80 (dup); useStartPicker.tsx:18,21; quickCaptureLayout.ts:44 (`key !== 'text'`); editor.tsx:330-341; NoteEditorDialog.tsx:89,100 (initialBody); key lookups quickCaptureLayout.ts:33, QuickCaptureSection.tsx:26,49. Shape fine; payload (open intent) is the smell.

Toasts: 32 call sites in 11 files + 4 editor; no helper; success 10 / error 15 / info 2 / plain 5 (4 with action). Undo only NoteCard.tsx:62.

Ranked: 1 NoteDraft session object (id, ensureId(), save(h,b), close(h,b,reminder)); removes 6 refs, dup create, 4-child id threading, NoteTagsBar resolvedId; testable w/o React; ~750 test lines cover. 2 fold Theme/ViewMode/sidebar into Preferences (delete 3 storage layers + ViewModeProvider; legacyPreferences precedent). 3 key-bound settings rows (~60 lines off Appearance). 4 useAsync hook (10 sites). 5 remote-action helper + shared LinkDialog. 6 exportBackup(store, suffix) facade. 7 open-intent parameter object + picker.start(action). 8 TourController + thin React adapter (under 500 lines, ends mirroring; HIGH risk: StrictMode/scroll/fonts races).
Ceremony: command objects for undo; Strategy per Start kind; Strategy/registry per AttachmentKind for rendering (Card, sharedBody.ts:51-89, editor render 3 different things); declarative settings schema; toast Notifier adapter; generic provider factory; routes (4-22 lines; trash.tsx 71 has EmptyTrashButton inline).

Docs drift: root CLAUDE.md:118 4 providers vs 10; :143 "one hidden input both bars share" false (each bar calls useStartPicker; both mounted NotesView 99,106); :156 NoteEditorDialog longest file (TourProvider 506, editor 457); context/CLAUDE.md useTheme throws (no); useAccount readers list incomplete (Shares, ShareButton, PairingLinkButton, SignOutButton, SyncProvider); context/PLAN.md useNotes/setQuery gone; CLAUDE.md "IDs: uuid v4" but NotesView uses crypto.randomUUID; :152 TagPills via NoteColorPicker (uses noteColorAttrs); no section for viewMode/motion/PwaInstall providers.
Smells: ThemeModeToggleButton.tsx:11 Sun while 'system' on dark OS; EntityActionButtons hardcodes English Save/Delete/Edit, EditButton unused; ColorPickerPanel.tsx:128 "Custom" untranslated; labels.tsx create/merge/delete no error path.

## D. lib, utils, test helpers (explore-lib)

Inventory highlights (LOC, purity): backup 323 S+D; reminder-ics 108 P; attachments 99 P; video-poster 90 D no test; long-press 76 D; note-feed-layout 74 P; note-search-params 66 P (8 importers); flip-rows 62 D; format-attachment 57 P; reminder 54 P (7 importers); note-attachments 54 P; tour/steps 194 D; tour/props 153 S; utils.ts 19 (cn 46 importers); utils/platform 26 D-at-load; move-by-id 19 P no test. floatingBottomBar.ts lives in components/notes.

Overlap:
- UA sniffing twice: utils/platform.ts:3-10, lib/deviceName.ts:11-19.
- Byte formatting twice: format-attachment.ts:30-46 (hand-rolled, dot decimal) vs SyncStatusSection.tsx:10-18 (Intl).
- Date locale inconsistent: reminder.ts:47 app locale; MembersSection.tsx:20, DevicesSection.tsx:11, SyncStatusSection.tsx:9 pass undefined (probable Czech-UI-English-dates bug, unverified).
- editor.tsx:253 `html.includes('data-attachment-id')` vs bodyHasAttachment attachment-html.ts:7.
- MIME base + audio list: attachments.ts:61/:38 restated in AudioRecorderHost.tsx:25-31,63.
- Preview pipeline twice: 512px edge, WebP 0.75, canvas draw, toBlob in image-thumbnail.ts:1-2,21-33 and video-poster.ts:1-2,68-77.
- Coded error class twice: AttachmentError attachments.ts:17-25, BackupError backup.ts:28-36.
- downloadBlob (backup.ts:259) and requestSaveTarget (:295) not backup-specific; hand-off.ts:1 imports backup.ts for downloadBlob; saveTarget.test.ts tests a nonexistent saveTarget.ts (imports backup.ts).
- Class-string recipes split: lib/chrome-controls.ts, lib/note-controls.ts, components/notes/floatingBottomBar.ts.
- Not duplicated: cn, stripHtml, moveById, reconcileOrder (3 sites).

Loose primitives:
- Reminder: regex at contract/index.ts:18 and reminder.ts:8; repeat list 3x (models.ts:8, contract/index.ts:31, reminder.ts:6); 7 files touch raw string; reads gated by reminderOf (reminder.ts:20-29); writes unvalidated (ReminderButton.tsx:48-51).
- NoteState 3x: models.ts:5, contract/index.ts:30, backup.ts:42.
- AttachmentKind: type models.ts:47 + contract/index.ts:32; per-kind facts over ~7 files: attachments.ts:3-59 lists/caps, :75-98 if-chain (unknown kind fails at runtime :96), insert.ts:42-46 MIME_PREFIX, editor.tsx:94-111 prefix routing, note-attachments.ts:15-21 tag->kind, AudioRecorderHost.tsx:25-31,63, useAudioRecorder.ts:5 (comment link to attachments.ts:37).
- Body HTML vocabulary: li[data-type="taskItem"] at checklist.ts:6, NoteCard.tsx:93,147; task-list markup flip-rows.ts:7, tour/props.ts:40-46, noteDrafts.ts:3; data-attachment-id parsed outside TipTap in attachment-html.ts, note-attachments.ts, conflictedCopy.ts:55, sharedBody.ts:21-22, editor.tsx:253.
- Row construction: new-note.ts:4 "the one place"; Tag inline useTagActions.ts:23-24, conflictedCopy.ts:21-22; NoteTag stamps useTagActions.ts:52-53, conflictedCopy.ts:66-68; Attachment useAttachmentActions.ts:22-38,55-64; conflictedCopy.ts:39-45 builds Note copy without newNote.
- Sound already: palette tokens (7 sites via noteColorAttrs; models.ts:17,31 type color as string not NoteColor); search params (8 importers through resolve/to/validate); LifecycleSnapshot; ids (noteTagId). comparatorFor (useNoteFeed.ts:25-44) ends in default: (new sort field silently sorts by updated).

Tour lib: already an object model. TourStep steps.ts:33 interface with enter/exit + continues; TOUR_STEPS :75 data; changesScene/leaveScene :170-180 pure; TourStage :19 port with 2 impls (TourProvider.tsx:169 makeStage, steps.test.ts:77 paper app). Consistent. TourProvider dup: :260 re-implements waitForTarget (steps.ts:52 private); :191 repeats editor-gone wait (steps.ts:102). TOUR_PROPS_META_KEY dup on purpose (legacyPreferences.ts:7, tour/props.ts:23).

Test helpers: fakeServer.ts 395 (10 test files), fakeSync.ts 224. decide fakeSync.ts:18-38 == ni-dip-be/src/modules/sync/decide.ts:20-43 (imports nothing; could vendor via contract:pull). Four stale backend path comments: fakeSync.ts:15, :129, fakeServer.ts:189, :328. fakeServer replies parsed by contract (shape drift caught); rule copies unchecked (blob order :328, sharedNote :117, tombstone cascade fakeSync.ts:129). No real overlap with MemoryLocalStore (client vs server side). renderRoute.tsx:23 "Same provider stack as App.tsx" false (omits ErrorBoundary, DocumentPreferences, AppMotionProvider, PwaInstallProvider, TooltipProvider, AccountProvider, Toaster); store.tsx:24-31 re-inlines withStore.

PLAN.md items: PLAN.md:135 editor.tsx >500 (stale, 457); :94/:92 remainders; hooks/data/PLAN.md:7 unify timestamps (still dup), :24 per-entity sync state (not impl), :25 Conflicted Copy via createNote+addTagToNote (conflictedCopy writes rows directly); data/PLAN.md:8 seeders (deleted); context/PLAN.md:7-8 high-contrast; :23 useNotes/setQuery; editor/PLAN.md:24, :32 cites nonexistent src/db/PLAN.md. None of the refactors planned anywhere.

Boundaries: Biome enforces only Dexie privacy (biome.json:56-72; off for src/data/**, main.tsx, test/store.tsx :100-108); src/contract excluded (:17). Convention only: data must not import lib (legacyPreferences.ts:5-6, yet :1 imports src/context); lib purity (backup.ts:3, tour/props.ts:7 import LocalStore type; locales.ts:1 React flags; motion.ts motion/react); sync must not import UI (holds, unenforced); contract untouched (PLAN.md:122 hand edit); recorder MIME list ⊂ allowed; tourProps key 2 places; supportedLngs vs public/locales (i18n.ts:13); 500-line rule.

Ranked: 1 AttachmentKind descriptor table in lib/attachments.ts (prefix, allowed MIMEs, cap, body tag, extension; replaces if-chain, insert.ts:42-46, note-attachments.ts:15-21, AudioRecorderHost.tsx:25-31,63; compile-time exhaustiveness). 2 one Body HTML module (selectors, attribute, strip/extract, checklist builders, EMPTY_CHECKLIST_BODY). 3 derive NoteState/ReminderRepeat/remindAt regex from contract; vendor decide.ts via contract:pull; fix 4 stale paths. 4 newTag/newNoteTag/newAttachment beside newNote with one id minter (crypto.randomUUID needs secure context; NotesView already relies). 5 shared AppProviders for App.tsx + renderRoute. 6 SaveTarget out of backup.ts (already 2-impl strategy backup.ts:270-323; matches saveTarget.test.ts). 7 shared Preview canvas helper; locale-aware byte/date formatters; export Tour waits. 8 fold utils/platform.ts into lib, delete src/utils.
Ceremony: Reminder value object; NoteColor/NoteSearchParams classes; branded ids; class-based Tour steps; router abstraction in fakeServer; LifecycleSnapshot.
Smells: backup filename "ruflo-backup-..." (backup.ts:254) vs YouNotes (reminder-ics PRODID); ASSIGNABLE_NOTE_COLORS test-only export; move-by-id, video-poster untested.
