# M5 - Share Links - Implementation Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner of a Note can share it read-only with anyone who can reach the server, find every open link again, and end any of them; the person who opens the link sees the Note and its Attachments without signing in and without anything being written to their Local Store.

**Architecture:** `AccountService` gains three share methods over the root's `shares` link.
The public read is not on `AccountService`, because it needs no Account: `src/data/http/publicShare.ts` fetches the shared Note and builds blob URLs from its `_links.blobs` template.
`/share/$token` is a page that renders outside the app shell, and the Note editor's bar gains a Share button with a small dialog.

**Spec:** `CONTEXT.md` "Share Link", backend `src/routes/shares.ts` (one share per Note, a second mint returns it, 404 "Nothing is shared here" for revoked, unknown or trashed, public routes rate limited, no cookie touched), backend ADR 0005 (tokens in clear, so the same link can be copied again), backend `docs/setup.md` section 11 (the words a user has read).

## Decisions

- **Service.** `share(noteId)` is `POST` to the root's `shares` link, `shares()` is `GET` on it, `revokeShare(id)` is `DELETE` on the share's own `self` link, found through the list (the `revokeDevice` pattern), so no route is written down.
  `Share` in `Remote.ts` is the contract's `Share` without `_links`.
- **Public fetch.** `fetchSharedNote(token)` answers the parsed `SharedNote`, `'gone'` on 404, and throws a `ProblemError` otherwise (a 429 included).
  Its own URL, `/api/public/shares/<token>`, is the one address written by hand: the HAL root does not list the public route, and a stranger has no link to follow to it.
  It sends no credentials; the page needs no identity.
  `sharedBlobUrl(shared, id)` fills the page's `_links.blobs` template; it takes the fetched page rather than the token, because the template lives on the page.
- **The route avoids the store.** Two small changes, both needed:
  - `routes/__root.tsx` renders a `/share/` path as a bare `<Outlet />`: no startup sweeps (they write), no Tour (it seeds Props), no `SyncProvider` loop, no app shell (a stranger has nothing to navigate to).
  - `main.tsx` hands the app an in-memory Local Store when the first load is a `/share/` path, so a stranger's browser never even opens IndexedDB.
    Making the providers tolerate it instead would have touched four of them.
- **Body.** A new `SharedNoteBody`, not a flag on `NoteBody` (whose comment asks for exactly that).
  It sanitizes with the same DOMPurify configuration, now exported from `NoteBody.tsx` as `sanitizeBody`, then resolves each attachment node from the Note's `attachments`: images inline at full size with `loading="lazy"`, video with its poster from `thumbnailId`, audio with controls, a file as a link with its name, an Excalidraw drawing as its `preview` SVG through the same `DOMPurify.sanitize` call `ExcalidrawNodeView` makes.
  A node the Note does not list is dropped.
  Every link opens in a new tab with `rel="noopener noreferrer"`, and checkboxes are disabled.
- **Share button.** In `NoteEditorBar` beside the Reminder, because the editor has no overflow menu and archive and trash live only on the card's foot rail.
  It renders only while signed in and while the Note is not trashed.
  A tap saves the draft (`ensureNoteId`), mints, and opens the dialog; a 404 (the Note has not reached the server) runs a sync and tries once more, then says so.
  An already shared Note carries the pin's pressed mark, and its label reads "Shared".
- **Dialog.** The `PairingLinkButton` dialog's shape: the setup guide's sentence, the link as selectable code, "Stop sharing", "Copy link" and "Done".
- **Settings.** A "Shared Notes" section after Devices: one row per share with the Note's header from the Local Store, and "Stop sharing".

## Tasks

- [x] **1. Contract.** `pnpm contract:pull` to backend `e2024d7`; the `TODO contract:pull` line goes with it.
- [x] **2. Service and fake.** `Remote.ts`, `HalAccountService.ts`, `publicShare.ts`, the fake server's four share routes and public blob route; tests.
- [x] **3. Public page.** `pages/share.tsx`, `routes/share.$token.tsx`, `SharedNoteBody.tsx`, `__root.tsx`, `main.tsx`; tests.
- [x] **4. Share button and dialog.** `ShareButton.tsx`, `NoteEditorBar.tsx`, one prop in `NoteEditorDialog.tsx`; tests.
- [x] **5. Settings.** `SharesSection.tsx`; i18n in both locales.
- [x] **6. The real run.** Backend on a scratch `DATA_DIR`, the built PWA, a signed-in context and a cookieless one.
- [x] **7. Docs.** Root `PLAN.md` and `CLAUDE.md`, `src/data/CLAUDE.md`, `src/context/CLAUDE.md`.

## Deviations and ceilings

- `sharedBlobUrl(shared, id)` rather than `(token, id)`: the template is on the fetched page, so the token alone cannot reach it without assembling the URL by hand.
- A Note that has not reached the server answers 404 to a mint; the button runs one sync and tries again, then says "This Note has not reached your server yet".
  ponytail: `syncNow` joins a run already in flight, which may predate the save, so a fresh draft can need a second tap.
- The shared page shows the Note as the server last synced it (CONTEXT.md), so edits still queued on the owner's Device are not in it yet.
- "Stop sharing" ends the link without a confirm, as the lead's brief asked; the token cannot be restored, and a new share mints a new link.
- The service worker still installs for a stranger (it registers from `App.tsx`), precaching the app shell only; it caches no `/api` response, so no shared blob.
- No Playwright spec: `e2e/` runs against `pnpm dev` with no backend.

## The real run

Backend `pnpm exec tsx src/main.ts` on a scratch `DATA_DIR`, port 3320, serving the built PWA itself (`PUBLIC_DIR=dist`), and two Playwright contexts.
A, at 1280x860, created the Owner from the printed Pairing Link, wrote "Beach trip" with a line of text and a 1200x800 PNG, and tapped Share: the dialog showed `http://localhost:3320/share/<token>`, "Copy link" put exactly that on the clipboard, and after "Done" the button carried the accent mark and reopened the same link.
B, at 390x844 with no cookies, opened the link: the title, the text and the image (loaded from `/api/public/shares/<token>/blobs/<id>`, natural size 1200x800), the footer, no `contenteditable`, no cookies set, and `indexedDB.databases()` empty.
After A's "Stop sharing", B's reload showed "Nothing is shared here", and A's Settings listed "No Note is shared."
