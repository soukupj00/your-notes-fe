# CONTEXT

Domain glossary for the note-taking app. This file defines the **language** of the project — the canonical meaning of each term. It is not a spec and contains no implementation detail; when code and this glossary disagree, one of them is wrong and must be fixed.

## Core entities

- **Note** — A single unit of content captured in the app, almost always by the user and occasionally by the app itself. Has an optional header, an optional plaintext description, a rich-text body (which may contain a Checklist), zero or more attachments, and zero or more tags. A Note is the central aggregate of the app.
- **Body** — The rich-text content of a Note, authored in the Editor and stored as HTML. This is the main writing surface, and it is where every richer element lives — attachments and the Checklist are authored inside it, not alongside it. Distinct from the **description** (a short plaintext subtitle).
- **Checklist** — A to-do list authored *inside* the Body: a list whose items each carry a checked/unchecked state. It is Body content, not separate structured Note data. Distinct from a plain bullet/ordered list, which has no checked state — the Checklist is the one with checkboxes. A Body may contain more than one Checklist.
- **Sinking** — Presenting a Checklist with its checked items gathered at the bottom, below its unchecked ones. Sinking is a way of *showing* a Checklist, never a way of storing one: the order the user typed is what is kept, so unchecking an item returns it to exactly the place it was authored in. Applies to every surface a Checklist appears on, so the same list never reads two ways.
- **Tag** — A user-defined label (e.g. "Work", "Personal") used to group Notes. A Tag exists independently of any Note and can be attached to many Notes. May carry an optional **Color** (a palette token, resolved per-Theme like a Note's Color).
- **NoteTag** — The many-to-many association between a Note and a Tag. Attaching or detaching a Tag creates or removes a NoteTag; it never deletes the Tag itself.
- **Attachment** — Any non-text media belonging to a Note. An Attachment is authored **inside the Body**: the Body holds a lightweight reference to the Attachment (never the media bytes), and the Attachment's bytes and metadata are stored separately. The Body decides *which* Attachments a Note shows and *where*; the Attachment store owns the bytes. An Attachment's bytes never change once it exists: editing a Drawing produces a *new* Attachment and repoints the Body at it, rather than rewriting the old one. Five kinds, each a separate concept:
  - **Image** — a picture displayed inline in the Body.
  - **Audio** — a sound recording, optionally with a duration.
  - **Video** — a moving-image clip.
  - **File** — any other attached document, identified by filename, size, and MIME type.
  - **Drawing** — an Excalidraw scene authored inside the Note (created empty and edited in place, not attached from an existing file).
- **Preview** — A lightweight stand-in rendered on the note card in place of the full Attachment, so the feed never loads the full bytes. It is a downscaled raster for an Image, and an SVG snapshot for a Drawing. Audio, Video, and File have no Preview; the card shows a control button or icon instead. A Preview is a rendering optimisation, never the source of truth — the full Attachment remains authoritative.
- **Orphan Attachment** — An Attachment whose Note no longer references it (its reference was removed from the Body, or its Note was discarded/never saved). Orphans are reclaimed by a sweep, not deleted the instant a reference disappears (so an in-editor undo can bring the reference back).

## The feed

- **Feed** — A scoped, ordered wall of Notes: a scope (Active, Archived, Trashed, or one Tag), narrowed by Search, arranged by a Sort. Every Note-listing screen in the app is a Feed.
- **Sort** — The rule a Feed is arranged by (by when a Note was last updated, when it was created, or its title), in a direction. A Sort is part of the Feed's address, so a given arrangement is shareable and survives a refresh.
- **Membership** — Which Notes a Feed contains. Membership is always live: a Note that stops qualifying leaves at once, and one that starts qualifying arrives at once.
- **Rank** — A Note's place within a Feed. Distinct from Membership, and unlike it, Rank is **held**: a Note already on screen does not change place because of something the user just did to it. Rank is recomputed only when the user is not watching the Feed. Pinning is the one exception, because moving the Note *is* the action being asked for.

- **Card** — A Note as it appears on a Feed: its title, an excerpt of its Body, its Attachments' Previews, its Tags and its footer.
  A Card is read, not edited, with one exception: a Checklist on a Card can be ticked in place, and the box and the item's words are the control, so tapping an item's text ticks it rather than opening the Note; the empty run after the words is still the Card.
  Pressing and holding an item row opens the Note instead.
  _Avoid_: preview (a Preview is an Attachment's stand-in on the Card, not the Card itself)
- **Start** — One of the ways a new Note can be begun from a Feed: as text, as a Checklist, by recording Audio, by opening a Drawing, by choosing an Image, or by taking a picture with the Camera.
  A Start may carry an Intent that the Editor acts on as it opens.
  The user chooses which Starts are offered and in what order.
- **Intent** - The one-shot half of opening a Note: what the Editor does as it opens, beyond showing the Note.
  A Start may carry one (begin recording, open the Drawing, insert the chosen files, begin as a Checklist), and so may a Card (play the first clip).
  An Intent belongs to the gesture that opened the Note, so a reload, Back or Forward never repeats it.
  _Avoid_: open request, initial capture, initial files

## Note lifecycle

A Note is always in exactly one **State**, and may independently be **Pinned** and carry a **Color**.

- **State** — The single lifecycle stage a Note occupies: **Active**, **Archived**, or **Trashed**. Mutually exclusive; a Note is never two at once.
  - **Active** — The default. The Note appears in the main feed.
  - **Archived** — The user is done with the Note but wants to keep it. Hidden from the main feed to reduce clutter, never auto-deleted, still reachable and still found by Search. Distinct from Trashed: archiving is *keeping*, not *discarding*.
  - **Trashed** — The Note is on its way out. Held for a grace period during which it can be restored, then permanently purged by a sweep. Distinct from Archived: trashing is *discarding with an undo window*.
    Opened, a Trashed Note is a read-only preview: it is restored to be edited.
- **Pinned** — A flag, orthogonal to State, marking a Note the user wants surfaced at the top of the feed. Only meaningful while Active. Archiving or trashing a Note clears its Pinned status.
- **Color** — An optional label color a user assigns to a Note for visual grouping. Stored as a palette *token* (a named entry), never a raw color value, so the concrete shade resolves from the active Theme and Vision Mode. A Note has at most one Color; the absence of one is the default surface.
- **Reminder** — A time the user wants to be brought back to a Note, optionally repeating (daily, weekly, monthly, yearly). Orthogonal to State, and a Note has at most one.
  A Reminder is a time *on the clock*, not an instant: "09:00" means nine in the morning wherever the user is, and stays nine across a daylight-saving change.
  The app **records** a Reminder and never sounds it - the alarm belongs to the user's calendar (see **Hand-off**).
  _Avoid_: notification, alarm, alert (the app raises none), due date (a Note is not a task)
- **Hand-off** — Giving a Reminder to the user's calendar as an event, which is what makes it fire whether or not the app is running. Setting a Reminder *is* handing it off; there is no Reminder the calendar was never offered.
  The Hand-off is one-way: the calendar keeps its own copy, which the app can offer to replace but can never see, change or remove. The event carries the Note's title and a link back to it, never its Body.
  _Avoid_: sync (the calendar is not a synced store), export (that is Backup's word)
- **Purge** — The permanent, irreversible removal of a Note and its Attachments, performed by a sweep the same way Orphan Attachments are reclaimed.
  Only a **Trashed** Note is purged: once its grace period elapses, when the trash is emptied, or when the user deletes it forever from its preview.

## Editing

- **Editor** — The rich-text surface (TipTap-based) used to write a Note's body. One Editor edits one Note's content.
- **Draft** - The Editor's working copy of a Note for the life of one open: what the user has typed, whether or not the Local Store has caught up yet.
  A Draft has its id from the moment the Editor opens, so the address can name it before a row exists, and it earns its row on the first real change or the first act that needs one (a label, an Attachment, a Reminder).
  A Draft that closes empty leaves nothing behind.
  _Avoid_: unsaved note, new note (a Draft of an existing Note is still a Draft)
- **Extension** — A self-contained editing capability plugged into the Editor (bold, lists, headings, image insertion, drawing, etc.). An Extension may contribute editing behavior, a Toolbar Button, or both.
- **Toolbar Button** — The control a user clicks to invoke an Extension's action (e.g. toggle bold). A Button belongs to its Extension and is identified to the user by a descriptive, recognizable icon.
- **Toolbar Family** — A named group of related Toolbar Buttons that answer the same question (headings, lists, alignment, media). A Family is shown either **expanded**, as its individual Buttons, or **collapsed**, as a single menu standing in for all of them. Families with one member are always expanded.
- **Toolbar Item** — One control occupying one slot on the toolbar: either a single Toolbar Button, or a collapsed Family's menu. This is the unit a user turns on, turns off, and orders.
- **Toolbar Layout** — A user's chosen arrangement of Toolbar Items: which Families appear, in what order, expanded or collapsed, and which of their Buttons are on. A Layout belongs to a Width Class, so a user has two.
- **Width Class** — Which of the two toolbar arrangements is in effect, decided by the window's width rather than the device: **Compact** for narrow windows, **Wide** for the rest. A resized desktop window changes Width Class.
- **Drawing** — A free-form sketch (Excalidraw-based) embedded in a Note as a kind of content authored inside the Editor.

## Presentation & accessibility

- **Theme** — The light the whole app is rendered in: light or dark. A user has exactly one active Theme at a time.
- **Vision Mode** — An accessibility modifier that composes *with* a Theme rather than replacing it, re-valuing the Note identity colors so they carry identity on lightness first and hue second. It is independent of Theme: a user may have dark and a Vision Mode at once, because color vision and a preference for a dark room are unrelated. Distinct from a Theme: a Theme re-lights everything, a Vision Mode re-values only the Note identity colors.
- **Locale** — The language the UI is presented in (e.g. `en`, `cs`).
- **Fallback** — The Locale used when the active Locale lacks a translation for a given string. The Fallback is always English (`en`).
- **Pointer Class** — Whether the primary input is a mouse (**Fine**) or a finger (**Coarse**).
  It is independent of Width Class, and the two disagree in both directions: a phone held sideways is a wide window with a Coarse pointer, and a touchscreen laptop is a wide window that is Fine but can still be tapped.
  Width Class decides what the app *lays out*; Pointer Class decides which *affordances* it offers - the 44px minimum a control grows to, and whether a keyboard shortcut is named at all.
  A shortcut is never shown to a Coarse pointer, because that device has no key to press: showing one is a promise the hardware cannot keep.
- **Destination** — A place the nav lists and can reach directly, in the rail or the drawer.
  Every Destination shows the nav control in its top-left corner; a page that is *not* one shows Back, because it has a parent it was opened from.
  A Destination is not the same thing as a surface with a Feed: managing labels is a Destination and has no Feed, and Settings has neither.

- **Preference** - A user's choice about how the app behaves on one Device: its Theme, Locale, density, toolbar arrangement, and the like.
  A Preference is how the user holds the app, not something the app holds for the user, so it lives with the Device rather than in the Local Store: it is not part of a Backup and it does not Sync.
  _Avoid_: setting (the page is Settings; what it edits are Preferences)

## Onboarding

- **Welcome** — The one overlay a new user sees at first launch: a greeting and a few marks, each pointing at a control and saying what it is for.
  It is shown once and dismissed with one press; nothing in it steps, so it is not a Tour.
- **Tour** — A short, ordered demonstration of a part of the app, offered once when the user first reaches it and replayable on demand.
  A Tour *points at the real app* rather than describing it, and the user only advances, retreats, or skips.
  It is therefore always in the user's own Locale, Theme, Vision Mode and Width Class, because there is nothing to be in but the app itself.
  A Tour never asks the user to act and never waits on them; a step that required the user to do something would be a different concept.
  A Tour creates and changes no Notes, and ends where it began.

## Backup & import

- **Backup** - A complete copy of everything the app holds (Notes, Tags, Attachments, settings) saved to a file the user keeps.
- **Import** - Bringing Notes from a file into the app, alongside what is already here.
  Import never empties anything: a Note from the file that the app has never seen is added, and a Note the app already holds (same identity) is overwritten by the file's version, whichever of the two is newer.
  Only a Backup can carry identities the app recognises; Notes from any other Source are always new, so importing the same foreign file twice yields two copies.
  Imported Tags are matched to existing Tags by name (ignoring case) and created when no match exists.
  There is no replace-all "restore": putting a Backup back is an Import like any other.
- **Source** - Where an Import's file comes from: this app's own Backup, or another app (Google Keep, Obsidian, ...).
  The user picks one file; the app tells the Sources apart from the file's contents, never by asking.

## Sync & accounts (frontend perspective)

- **Local Account** — A user identity created on a self-hosted server that lets the same person's Notes sync across their devices. "Account" always means this sync identity — it is not the owner field of a Note and not an OS/browser user.
  A Local Account is a private silo: its Notes are visible to it alone, and there is no way to hand a Note to another Account.
  Two people sharing a Self-hosted Server share the machine, not their Notes.
- **Owner** - The first Local Account created on a Self-hosted Server, and the only one that can invite others or reset their password.
  There is exactly one, it cannot be transferred, and it is a role on the server rather than a property of any Note.
- **Invite** - A one-time permission to create a Local Account on a server that otherwise refuses to create them.
  It is how a household member joins: the Owner issues one, the newcomer spends it, and it is then gone.
  An Invite is carried by a Pairing Link.
- **Pairing Link** - A one-time address of the Self-hosted Server that signs in whoever opens it, shown as a QR code to scan or as text to type.
  It is how a Device joins without a password being typed on it: the server prints one when it is first started (the person who opens it becomes the Owner), a signed-in Device shows one to add another Device of the same Local Account, and the Owner shows one to carry an Invite.
  A Pairing Link works once and expires unopened; the password remains the way in when no Device is left to show one.
  _Avoid_: QR code (a rendering of the Link, not the thing itself), token, magic link
- **Pairing** - Signing a Device in by opening a Pairing Link.
  It is a way of signing in, not a different kind of Account or Device.
- **Share Link** - A read-only address of one Note on the Self-hosted Server that anyone who can reach the server may open, signed in or not.
  Opening one shows the Note as the server last synced it and writes nothing to the viewer's Local Store; the Note's owner can end it at any time.
  A Share Link shows a Note to a person; it never hands the Note to another Local Account, so Accounts stay private silos.
  _Avoid_: public link (the server may not be public), sharing (too broad), Pairing Link (that one signs a Device in)
- **Device** - One installed copy of the app signed in to one Local Account.
  A Device is the unit the user recognises ("my phone") and the unit of revocation: signing out a lost Device ends its access without touching the Account or any other Device.
- **Local Store** - The copy of everything the app holds on one Device, and the only copy the app ever reads or writes directly.
  It is the source of truth while offline, and the app is complete with a Local Store alone: a Remote is an addition, never a requirement.
  _Avoid_: database, cache, storage, IndexedDB (an implementation, not the concept)
- **Remote** - The place a Local Store is reconciled with so that the same person's other Devices see the same Notes.
  The app never reads or writes a Remote directly; it is reached only through Sync, and it is the part a self-hoster may replace with something of their own.
  The Self-hosted Server is the Remote this project ships.
  _Avoid_: backend, cloud, storage
- **Sync** — Reconciling a Device's Local Store with a Remote so changes propagate across a user's devices. Sync is bidirectional.
- **Live Update** - A Device that is open learning of a change made on another Device while it stays open, without the user doing anything.
  It is a quality of Sync, not a separate mechanism: how quickly the laptop shows what the phone just wrote.
- **Catch-up** - A Device reconciling everything it missed at the moment it opens or regains connectivity.
  Every Device catches up; whether it also receives Live Updates while open, and how promptly, is what distinguishes one Sync design from another.
- **Offline Mutation Queue** - The **set** of local changes the server has not yet accepted, sent when connectivity returns.
  It is a set and not an ordered log: what the server is owed is the *current state* of each changed thing, not the history of how it got there, so editing one Note ten times offline owes the server one change, not ten.
  A deletion is owed the same way, as a Tombstone.
  The Queue is therefore never a separate record that could disagree with the Notes themselves - it is a way of reading them.
- **Revision** - The server's count of how many accepted changes a synced thing has had.
  A device holds the Revision its copy was last in agreement with, which is what lets the server tell a change made *from* the current version from one made from a stale one.
  A Revision belongs to the server alone: a device never invents one, it only reports the one it was given.
- **Conflict Resolution** - Deciding the winning version when the same Note was changed both locally and on the server since the last Sync.
  The server's version wins and becomes the Note; the device's own version is kept beside it as a **Conflicted Copy**.
  Sync therefore never discards anything a user wrote: resolving a conflict is reading two Notes and discarding one, which is a thing the user does, not a thing the app does.
- **Conflicted Copy** - An ordinary Note holding the version that lost a Conflict Resolution.
  It is a Note in every respect from the moment it exists; nothing about it is special except how it was born and how it is titled.
- **Tombstone** - The record that something was deleted, kept after the thing itself is gone so that the deletion can reach devices that were offline when it happened, carrying the Revision the device last agreed with so a stale deletion cannot discard a newer edit.
  Without one, a device returning from offline cannot tell "deleted elsewhere" from "not yet uploaded", and would resurrect what the user discarded.
- **Self-hosted Server** — The backend instance, run by the user on their own network, that stores accounts and synced Notes. It lives in a separate repository and is out of scope for this frontend repo's code.
