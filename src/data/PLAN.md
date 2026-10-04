# PLAN - `src/data` (the Local Store)

What is left in the persistence layer.
Milestones and tickets are in the [root PLAN.md](../../PLAN.md).

The seam, the sync metadata and the Attachment transfer state have all shipped; how they work is in [`CLAUDE.md`](./CLAUDE.md).

- After the user test: one shared set of sync algorithms for both Local Stores, and the sync surface split off `LocalStore` (root PLAN.md, M6).
- The store tickets in the root PLAN.md: the Dexie and memory stores drift on a Note added again under a purged id, and `update` takes a change that can carry a new `id`.

Standing rule: bump the Dexie `version()` and write a migration whenever the schema changes.
