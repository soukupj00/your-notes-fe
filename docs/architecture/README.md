# Architecture documentation

Reference documents for the software architecture paper.
Each file synthesizes what the repository, its ADRs and the M5 sync design have already decided, in a shape a report chapter can be written from.
They describe the system as built through M6 (2026-10): the PWA, Sync and the Self-hosted Server.

When these documents and the code disagree, the code and the ADRs win; fix the document.
Domain terms are canonical in [`CONTEXT.md`](../../CONTEXT.md) and are capitalized here (Note, Body, Revision, ...).

| Document | Covers |
|---|---|
| [01-architecture.md](./01-architecture.md) | System context, frontend layering, state model, PWA shell |
| [02-use-cases.md](./02-use-cases.md) | Actors and use cases, local and with a server |
| [03-database.md](./03-database.md) | IndexedDB/Dexie schema, versions, migrations, sync metadata |
| [04-sync.md](./04-sync.md) | The sync model: Revisions, conflicts, queue, tombstones |
| [05-server.md](./05-server.md) | The server: deployment, auth, accounts, API style |
| [06-technology.md](./06-technology.md) | Every package and technology used, with rationale |
| [07-requirements.md](./07-requirements.md) | Functional + non-functional requirements with traceability to the brief |
| [08-testing.md](./08-testing.md) | Testing strategy: levels, environment limits, deliberate manual gaps |
| [09-evaluation.md](./09-evaluation.md) | User-testing plan (DRAFT - open methodology questions) |
| [10-related-work.md](./10-related-work.md) | Research: Keep baseline, self-hosted competitors, the gap analysis |

Primary sources, in reading order for a newcomer:
[`PRODUCT.md`](../../PRODUCT.md) (who it is for),
[`CONTEXT.md`](../../CONTEXT.md) (the language),
[`PLAN.md`](../../PLAN.md) (the roadmap),
[`docs/adr/`](../adr/) (the decisions),
[`DESIGN.md`](../../DESIGN.md) (the visual contract).
