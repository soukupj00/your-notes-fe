# CONTEXT

Domain glossary for the note-taking app. This file defines the **language** of the project — the canonical meaning of each term. It is not a spec and contains no implementation detail; when code and this glossary disagree, one of them is wrong and must be fixed.

## Core entities

- **Note** — A single unit of content a user captures. Has an optional header, an optional plaintext description, a rich-text body (which may contain a Checklist), zero or more attachments, and zero or more tags. A Note is the central aggregate of the app.
- **Body** — The rich-text content of a Note, authored in the Editor and stored as HTML. This is the main writing surface, and it is where every richer element lives — attachments and the Checklist are authored inside it, not alongside it. Distinct from the **description** (a short plaintext subtitle).
- **Checklist** — A to-do list authored *inside* the Body: a list whose items each carry a checked/unchecked state. It is Body content, not separate structured Note data. Distinct from a plain bullet/ordered list, which has no checked state — the Checklist is the one with checkboxes. A Body may contain more than one Checklist. Checked items may optionally sink to the bottom of their list.
- **Tag** — A user-defined label (e.g. "Work", "Personal") used to group Notes. A Tag exists independently of any Note and can be attached to many Notes. May carry an optional **Color** (a palette token, resolved per-Theme like a Note's Color).
- **NoteTag** — The many-to-many association between a Note and a Tag. Attaching or detaching a Tag creates or removes a NoteTag; it never deletes the Tag itself.
- **Attachment** — Any non-text media belonging to a Note. An Attachment is authored **inside the Body**: the Body holds a lightweight reference to the Attachment (never the media bytes), and the Attachment's bytes and metadata are stored separately. The Body decides *which* Attachments a Note shows and *where*; the Attachment store owns the bytes. Five kinds, each a separate concept:
  - **Image** — a picture displayed inline in the Body.
  - **Audio** — a sound recording, optionally with a duration.
  - **Video** — a moving-image clip.
  - **File** — any other attached document, identified by filename, size, and MIME type.
  - **Drawing** — an Excalidraw scene authored inside the Note (created empty and edited in place, not attached from an existing file).
- **Preview** — A lightweight stand-in rendered on the note card in place of the full Attachment, so the feed never loads the full bytes. It is a downscaled raster for an Image, and an SVG snapshot for a Drawing. Audio, Video, and File have no Preview; the card shows a control button or icon instead. A Preview is a rendering optimisation, never the source of truth — the full Attachment remains authoritative.
- **Orphan Attachment** — An Attachment whose Note no longer references it (its reference was removed from the Body, or its Note was discarded/never saved). Orphans are reclaimed by a sweep, not deleted the instant a reference disappears (so an in-editor undo can bring the reference back).

## Note lifecycle

A Note is always in exactly one **State**, and may independently be **Pinned** and carry a **Color**.

- **State** — The single lifecycle stage a Note occupies: **Active**, **Archived**, or **Trashed**. Mutually exclusive; a Note is never two at once.
  - **Active** — The default. The Note appears in the main feed.
  - **Archived** — The user is done with the Note but wants to keep it. Hidden from the main feed to reduce clutter, never auto-deleted, still reachable and still found by Search. Distinct from Trashed: archiving is *keeping*, not *discarding*.
  - **Trashed** — The Note is on its way out. Held for a grace period during which it can be restored, then permanently purged by a sweep. Distinct from Archived: trashing is *discarding with an undo window*.
- **Pinned** — A flag, orthogonal to State, marking a Note the user wants surfaced at the top of the feed. Only meaningful while Active. Archiving or trashing a Note clears its Pinned status.
- **Color** — An optional label color a user assigns to a Note for visual grouping. Stored as a palette *token* (a named entry), never a raw color value, so the concrete shade resolves from the active Theme (including light, dark, and color-blind variants). A Note has at most one Color; the absence of one is the default surface.
- **Purge** — The permanent, irreversible removal of a Trashed Note (and its Attachments) once its grace period elapses. Performed by a sweep, the same way Orphan Attachments are reclaimed.

## Editing

- **Editor** — The rich-text surface (TipTap-based) used to write a Note's body. One Editor edits one Note's content.
- **Extension** — A self-contained editing capability plugged into the Editor (bold, lists, headings, image insertion, drawing, etc.). An Extension may contribute editing behavior, a Toolbar Button, or both.
- **Toolbar Button** — The control a user clicks to invoke an Extension's action (e.g. toggle bold). A Button belongs to its Extension and is identified to the user by a descriptive, recognizable icon.
- **Drawing** — A free-form sketch (Excalidraw-based) embedded in a Note as a kind of content authored inside the Editor.

## Presentation & accessibility

- **Theme** — A complete set of colors applied to the whole app. Includes light and dark, and accessibility variants tuned for color-blindness and other vision conditions. A user has exactly one active Theme at a time.
- **Locale** — The language the UI is presented in (e.g. `en`, `cs`).
- **Fallback** — The Locale used when the active Locale lacks a translation for a given string. The Fallback is always English (`en`).

## Sync & accounts (frontend perspective)

- **Local Account** — A user identity created on a self-hosted server that lets the same person's Notes sync across their devices. "Account" always means this sync identity — it is not the owner field of a Note and not an OS/browser user.
- **Sync** — Reconciling the device's local Notes with the self-hosted server so changes propagate across a user's devices. Sync is bidirectional.
- **Offline Mutation Queue** — The ordered record of local changes (create/update/delete) made while disconnected, held so they can be replayed to the server once connectivity returns.
- **Conflict Resolution** — Deciding the winning version when the same Note was changed both locally and on the server since the last Sync.
- **Self-hosted Server** — The backend instance, run by the user on their own network, that stores accounts and synced Notes. It lives in a separate repository and is out of scope for this frontend repo's code.
