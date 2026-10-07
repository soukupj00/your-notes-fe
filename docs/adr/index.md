# Decisions

Each record says what was decided, why, and what it costs.
A record that amends an earlier one says so at the top.
Decisions about the server itself are on [the server's site](https://soukupj00.github.io/your-notes-be/adr/).

| Record | Decision |
|---|---|
| [0001](./0001-local-first-storage-with-dexie.md) | Local-first storage with Dexie and IndexedDB |
| [0002](./0002-separate-frontend-backend-repositories.md) | Separate frontend and backend repositories |
| [0003](./0003-testing-stack-vitest-and-playwright.md) | Testing stack: Vitest and Playwright |
| [0004](./0004-canonical-editor-toolbar-pattern.md) | Editor toolbar buttons belong to their extensions, icons come from a registry |
| [0005](./0005-biome-replaces-eslint-prettier.md) | Biome replaces ESLint and Prettier |
| [0006](./0006-ci-cd-and-container-image-distribution.md) | CI/CD and container-image distribution |
| [0007](./0007-blob-over-base64-for-attachment-payloads.md) | Blob over base64 for attachment payloads |
| [0008](./0008-tanstack-router-over-react-router.md) | TanStack Router over React Router |
| [0009](./0009-note-lifecycle-model.md) | Note lifecycle model: state, pin, colour, trash |
| [0010](./0010-shadcn-sidebar-as-nav-shell.md) | The shadcn `Sidebar` as the nav shell |
| [0011](./0011-toolbar-items-and-families.md) | Toolbar Items and Families over a flat button list |
| [0012](./0012-feed-rank-is-held-membership-is-live.md) | Feed rank is held, membership is live |
| [0013](./0013-checklist-sinking-is-presentation-not-storage.md) | Checklist sinking is presentation, not storage |
| [0014](./0014-the-open-note-lives-in-the-url.md) | The open Note lives in the URL |
| [0015](./0015-the-tour-drives-the-app-on-disposable-props.md) | The Tour drives the app on disposable Props |
| [0016](./0016-width-decides-layout-pointer-decides-affordances.md) | Width decides layout, pointer decides affordances |
| [0017](./0017-note-level-last-writer-wins-with-conflicted-copies.md) | Note-level last-writer-wins, with the loser kept as a Conflicted Copy |
| [0018](./0018-the-server-serves-the-pwa.md) | The sync server serves the PWA, and that decides auth, pairing and TLS |
| [0019](./0019-import-replaces-restore.md) | Import replaces Restore: one additive operation for every Source |
| [0020](./0020-the-local-store-seam.md) | The app reads and writes a Local Store interface, never Dexie |
| [0021](./0021-reminders-are-handed-off-to-the-calendar.md) | Reminders are handed off to the calendar; the app never notifies |
| [0022](./0022-interfaces-and-closures-not-classes.md) | Interfaces and closure factories, never classes |
