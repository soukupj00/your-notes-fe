# Related work: Google Keep and similar note managers

The brief's first mandated outcome ("Proveďte rešerši aplikace Google Keep a podobných správců poznámek").
Per the working method: first what the repository already records, then research notes gathered outside it.

> **Provenance note.** Section 2 onward is desk research (2026-08-20), partly from secondary sources (comparison articles, project sites).
> Before the paper is submitted, feature claims about competitors should be re-verified against each project's own documentation; secondary-source claims are marked.

## 1. What the repository already records

The repo positions against Keep but contains no competitor analysis - this document is that gap being filled.
What exists:

- **`PRODUCT.md`** defines Keep as the usability bar ("Keep's approachability is the bar to match, not to beat with complexity") and ranks the reasons users would switch: 1. no corporate account, 2. an easy interface, 3. owned offline-first sync - with customisability running through all three.
- **`PLAN.md`** frames M4 as reaching "Google-Keep parity" and enumerates what that meant here: lifecycle (pin/archive/trash), labels with colors, fuzzy search, quick capture, masonry feed.
- **The thesis assignment** ([07-requirements.md](./07-requirements.md)) names the motivating trend: corporations monetising user data, making self-hosting a privacy response.
- **[ADR 0018](../adr/0018-the-server-serves-the-pwa.md)** contains the one comparative observation in the repo: the "frontend somewhere, backend somewhere else, type your server address" shape is "what most self-hosted note and media apps do, and it is where a meaningful share of non-technical users give up".

## 2. Google Keep: the feature baseline

From current secondary sources plus product knowledge; Keep is the parity target, so this list doubles as a completeness check.

**Core:** free-form notes and checklists; drawings; image attachment; voice memos with transcription; flat labels (no folders, no nesting); per-note colors; pin; archive; cross-device sync via Google account; search including by attribute (color, type).
**Beyond this project's scope, by choice** ([07-requirements.md](./07-requirements.md) non-requirements): location-based reminders and two-way Calendar integration (time-based Reminders are in scope, handed one-way to the user's calendar - [ADR 0021](../adr/0021-reminders-are-handed-off-to-the-calendar.md)); real-time collaborative editing of a shared note; OCR text grab from images; Workspace integration.
**Commonly cited limitations** (secondary sources): light formatting only, poor for long-form writing; search and organisation weaken at scale; no edit history or diff; checklists are flat.

YourNotes' divergences from the baseline are deliberate and two-directional: it *adds* rich text (headings, math, code), video and arbitrary file attachments, Excalidraw scenes, full-database backup, and deep customisation; it *drops* collaboration, OCR and app-raised notifications.
The drops should be argued in the paper, not hidden: collaboration contradicts the private-silo account model.
Reminders, the most-missed Keep feature, are kept but reshaped: a web app without push cannot fire anything while closed, so a Reminder is recorded on the Note and its alarm is handed to the user's calendar ([ADR 0021](../adr/0021-reminders-are-handed-off-to-the-calendar.md)).

## 3. Self-hosted and open-source note managers

### 3.1 The established generation (own clients, own sync)

| App | Model | Sync and conflicts | Offline | Notes |
|---|---|---|---|---|
| **Joplin** | Markdown notes in notebooks (hierarchy), E2EE optional | Sync targets: Joplin Server/Cloud, Nextcloud, Dropbox, WebDAV, file system. Conflicts produce copies in a dedicated **"Conflicts" notebook** | Native desktop + mobile clients, fully offline | The closest philosophical relative: its conflict handling is the same "keep the loser, let the human resolve" family as [ADR 0017](../adr/0017-note-level-last-writer-wins-with-conflicted-copies.md) |
| **Standard Notes** | Plaintext/markdown notes, **E2EE by default** | Own server (self-hostable), encrypted sync | Native + web clients | The E2EE counter-example: shows the recovery cost ADR 0018 declines to pay (key loss = data loss) |
| **Trilium Notes** | Tree/graph knowledge base, notes have children and clones | Own sync server | Desktop-first; mobile weak (secondary sources) | A different genre (second brain), included as the boundary of "similar" |
| **Nextcloud Notes** | Markdown files in Nextcloud | Nextcloud sync (file-level) | App-dependent | Rides an existing platform; setup cost is "run Nextcloud" |

### 3.2 The Keep-likes (card walls, labels, colors)

| App | Model | Delivery | Observations (secondary sources) |
|---|---|---|---|
| **Memos** | Short timestamped markdown "memos" with hashtags | Server-first web app + PWA, Docker one-liner | The most popular of the class (tens of k GitHub stars); familiar to Keep users, but server-rendered: thin offline story |
| **Blinko** | Card-based quick notes, tags, AI features | Self-hosted web app, PWA installable | Same server-first shape |
| **Glass Keep** | Deliberate Keep clone: cards, checklists, drawings, colors, collaboration | Self-hosted web app | Feature-parity ambition, small project |
| **KeepLocal** | Keep-inspired: 12 colors, labels, todos | Self-hosted web app | Small project |

### 3.3 The gap YourNotes targets

Reading the two tables together, the niche is empty where this project sits:

1. **The Keep-likes are server-first.** Their web apps assume the server is reachable; none makes IndexedDB the source of truth with sync as the addition. YourNotes is fully functional with no server at all.
2. **The offline-first apps are not Keep-like.** Joplin and Trilium have real offline stories but notebook/graph models, markdown editing, and desktop-app ergonomics - not the card wall a Keep user recognises.
3. **Nobody optimises for the handed-to household member.** Every system in both tables addresses the self-hoster; the two-audience framing (depth for the operator, zero-explanation surface for their family, private silos per account) is this project's distinct product position - and ADR 0018's one-container, no-server-address design is its architectural expression.
4. **Conflict UX is mostly unexamined.** Joplin's Conflicts notebook is the only comparable mechanism surfaced by the research; evaluating conflict *comprehension* with users ([09-evaluation.md](./09-evaluation.md), Session C) appears to be novel ground.

## 4. Sources

Secondary sources consulted (2026-08-20), to be re-verified against primary documentation before submission:

- [Google Keep Note-Taking Guide 2026 (Geeky Gadgets)](https://www.geeky-gadgets.com/google-keep-beginners-tutorial/)
- [Google Keep Complete Guide (arekore.app)](https://arekore.app/en/productivity/google-keep-complete-guide)
- [Google Keep Review 2026 (ainotely)](https://ainotely.com/blog/google-keep-review/)
- [Self-Hosted Note-Taking: Standard Notes, Joplin, Trilium (dasroot.net)](https://dasroot.net/posts/2026/03/self-hosted-note-taking-standard-notes-joplin-trilium/)
- [Joplin vs Trilium (selfhosting.sh)](https://selfhosting.sh/compare/joplin-vs-trilium/)
- [Self-hosted note apps for homelabs (HomelabAddiction)](https://homelabaddiction.com/self-hosted-note-taking-apps-4-options-worth-running-in-2026-and-how-to-pick-the-right-one/)
- [Open Source Google Keep Alternatives (openalternative.co)](https://openalternative.co/alternatives/google-keep)
- [Glass Keep](https://alexjenkins.tech/apps/glass-keep/)
- [Memos replacing Keep (Android Police)](https://www.androidpolice.com/replaced-google-keep-with-open-source-note-taking-app/)
- [Blinko replacing Keep (XDA)](https://www.xda-developers.com/i-replaced-google-keep-with-this-lightning-fast-self-hosted-alternative/)

Primary documentation to consult for the paper: joplinapp.org (sync + conflict docs), standardnotes.com/help, github.com/TriliumNext/Notes, github.com/usememos/memos, nextcloud.com/notes.

## For the paper

- Structure the chapter as this document is structured: baseline (Keep), the two competitor classes, then the gap analysis - each gap claim traceable to a table row.
- The Joplin Conflicts-notebook parallel legitimises ADR 0017's model with precedent; the Standard Notes E2EE trade-off legitimises ADR 0018's refusal of it.
- State the research method honestly: desk research of documentation and secondary comparisons, not hands-on evaluation of every competitor (unless time permits installing the top three - Joplin, Memos, and one Keep-like - which would strengthen the chapter considerably).
