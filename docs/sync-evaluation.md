# Sync evaluation notes (M5, re-evaluated 2026-08-30)

Working notes behind the thesis section `ni-dip-thesys/text/design/sync.tex`.
Frame agreed in a `/grill-with-docs` session on 2026-08-30; findings and scores are filled in below as research lands.
ADR 0017 and ADR 0018 are *inputs* to this evaluation, not its conclusion: the candidate set is wider than the one they compared, and the verdict may amend them.

## Frame

### Given (not re-opened)

- ADR 0018: the server serves the PWA from one origin; auth is an `HttpOnly`, `SameSite=Lax` session cookie per Device; Owner + Invites; Caddy for TLS.
  Candidates are scored on how well they *accommodate* this (C8), not on whether it is right.
- REST + HATEOAS is a weighted criterion (C5), not a gate: it comes from the project's own stack notes, not from the assignment text.
- Non-requirements stand: no real-time collaboration, no sharing between Accounts.
- Scenario every candidate must tell concretely: same Account, phone and laptop both open, phone edits, laptop updates (Live Update); and both edit the same Note while one is offline (Conflict).
- Closed-app propagation is a low-weight nice-to-have; Web Push is rejected on the privacy gate (third-party push relay) unless that is revisited.

### Gates (pass/fail)

- G1 Open source, self-hostable, no external service at runtime (NFR2).
- G2 Runs from one `compose.yml` a non-programmer can follow (NFR8).
- G3 Local-first: the Local Store stays the source of truth offline; the network is an addition (NFR1, ADR 0001).
- G4 No silent loss of user writing (NFR10).

### Weighted criteria

| # | Criterion | Weight |
|---|---|---|
| C1 | Operational simplicity: containers, one-file backup, upgrades | 5 |
| C2 | Conflict behaviour: what each user sees, repair cost | 5 |
| C3 | Catch-up robustness: long absence, tombstones, full resync, queue | 5 |
| C4 | Fit with the existing frontend: LocalStore seam, HTML Body, blob attachments | 4 |
| C5 | REST/HATEOAS fit | 4 |
| C6 | Live Update latency on an open Device | 3 |
| C7 | Attachment transfer: large blobs, previews first, bytes on demand | 3 |
| C8 | Security posture: cookie sessions, per-Device revoke, closed registration | 3 |
| C9 | Mobile battery and network cost | 1 |

Dropped deliberately: maturity (evidenced through C3), implementation effort (project rule: quality over development cost).
Method: gates first, then a 1-5 score per criterion, weighted sum, a one-line justification per cell, and the two scenarios told for each finalist.

### The five server-model sub-decisions

- SD1 Change identity: device timestamps / server Revision counter / revision hashes and trees / hybrid logical clock / vector clocks / CRDT metadata.
- SD2 Change log shape: current rows + cursor-able change feed / append-only event log / CRDT update stream.
- SD3 Conflict handling: last-writer-wins (row or field) / keep both (Conflicted Copy) / deterministic winner + conflict flag / three-way merge / text CRDT.
- SD4 Entity identity: UUIDv4 (current) / UUIDv7 / ULID / server integers.
- SD5 Attachment transfer: in-band with the document / separate immutable blob endpoint / chunked or resumable.

### Candidates

Transports (scored): short polling; long polling; SSE; WebSocket; MQTT over WebSocket; hybrid REST data + hint channel; REST + Background Sync for outbound retry.
Mentioned only: Web Push, Periodic Background Sync, HTTP/2 server push, WebTransport.

Server side (scored): build (thin TypeScript server, Revision + change feed); CouchDB + PouchDB; RxDB replication; ElectricSQL; PowerSync; Zero; Triplit; Yjs + Hocuspocus / y-sweet; Automerge Repo; PocketBase; Appwrite; Supabase self-hosted; Dexie Cloud (expected to fail G1).
Prior art, not candidates: Joplin Server, Nextcloud Notes, Google Keep.

## Findings

Research done 2026-08-30 by five agents against fetched primary sources; raw files (with per-claim URLs and bib entries) are kept with the thesis material, outside this repository, and their bib blocks move into the thesis bib in step 4.
Claims the agents could not verify from a primary source are marked *unverified* here as they were there.

### Transports

Properties (all pass G1-G3; G4 is a data-layer property, not a transport one):

| Transport | Cookie | Resume | Caddy | Idle cost | Data path |
|---|---|---|---|---|---|
| Short polling | yes | n/a | none | 1 req / interval | is REST |
| Long polling | yes | manual | raise timeout | 1 held conn | awkward GET |
| SSE | yes | native, `Last-Event-ID` | auto-flush | ~0 | notify only |
| WebSocket | handshake | app-owned | auto-upgrade | ping/pong | ad hoc protocol |
| MQTT over WS | **no**, own credential | QoS, sessions, retained | 2nd upstream | ping | replaces or duplicates |

Support and gaps:

- SSE: every browser incl. iOS Safari 5+; the 6-connection HTTP/1.1 cap is lifted by HTTP/2, which Caddy enables with TLS.
- Background Sync: no Safari desktop or iOS at all ("not Baseline"); outbound retry only; SW killed after 30 s idle. An enhancement, never the G4 guarantee.
- Web Push: routes through Google/Mozilla/Apple relays (RFC 8291 hides the payload, not timing or existence); iOS needs Home Screen install. Fails G1.
- Periodic Background Sync: Chromium only, engagement-gated. WebTransport: Baseline only since March 2026.
- Background tabs throttle timers (Chrome after 10 s, Firefox after 30 s); open WebSocket connections are exempt, EventSource presumably too (*unverified*).
- `Last-Event-ID` is a cursor: the SSE `id:` can be the change-feed sequence and the server replays from it on reconnect.

### Server-side candidates: gates

| Candidate | G1 | G2 | G3 | G4 | Verdict |
|---|---|---|---|---|---|
| Build (Fastify + SQLite) | pass | pass | pass | pass | scored |
| CouchDB + PouchDB | pass | pass | pass | pass | scored |
| RxDB + our server | pass | pass | pass | custom handler | scored |
| Yjs + Hocuspocus | pass | pass | pass | pass | scored |
| PocketBase | pass | pass | ours | hooks needed | scored |
| Zero | pass | marginal | *unverified* | mutators | scored |
| ElectricSQL | pass | marginal | via TanStack DB | our API | scored |
| PowerSync | **FSL** | heavy | pass | our code | scored |
| Triplit | AGPL | *unverified* | ? | ? | not scored |
| Automerge Repo | pass | demo server | pass | pass | not scored |
| Appwrite | pass | **15-20 containers** | ours | ? | out |
| Supabase | pass | 11 containers | ours | ours | out |
| Dexie Cloud | **closed** | - | - | - | out |
| Couchbase | **BSL** | - | - | - | out |

Notes on the gate cells:

- RxDB's default `conflictHandler` "drops the fork state and uses the master state" - silent loss unless overridden.
- PocketBase has no revision, no `If-Match`, no change feed and no tombstones; only an `updated` timestamp and SSE events. Passing G4 means writing the protocol inside its ES5 hook runtime.
- PowerSync's service is Functional Source License (Apache after a delay): source-available, not open source today.
- Automerge's reference sync server is "an unsecured Express app, partly for demonstration".
- Dexie Cloud: free tier is hosted; the paid self-host tier ships closed or under a non-compete licence.

### What each candidate answers for the sub-decisions

Identity and log:

| Candidate | SD1 change identity | SD2 change log |
|---|---|---|
| Build | server Revision per row, `ETag`/`If-Match`; per-Account sequence | rows + cursor feed, tombstone window |
| CouchDB | `N-hash` revision tree | `_changes` with `since`, 4 modes |
| RxDB | height + instance token | app checkpoint, pull/push handlers |
| Yjs | CRDT metadata | update stream over WS |
| PocketBase | `updated` timestamp | none; poll `updated > X` + SSE |
| Zero | Postgres via CVR | replication log |
| Electric | Postgres txid | shape log, `offset` |
| PowerSync | bucket op ids | bucket op log |

Conflict, ids and attachments:

| Candidate | SD3 conflict | SD4 ids | SD5 attachments |
|---|---|---|---|
| Build | keep both | UUIDv4 kept | separate immutable blob, idempotent PUT |
| CouchDB | deterministic winner + `_conflicts` | any string | in-document, base64 or multipart |
| RxDB | `conflictHandler`, LWW default | any | plugin; per-transport support unclear |
| Yjs | character merge | our id | not addressed |
| PocketBase | none | 15-char; UUID *unverified* | file fields, thumbs on the fly |
| Zero | mutator re-run | ours | not addressed |
| Electric | our API | ours | not addressed |
| PowerSync | our upload code | ours | first-class queue + blob store |

Prior art: Joplin Server keeps both in a "Conflict" notebook; Nextcloud Notes uses `ETag` + `If-Match` -> 412; Dropbox "conflicted copy" and Syncthing `.sync-conflict` are the same strategy for files; Google Keep is undocumented.
The Medium article's opId + logical-timestamp + LWW pattern solves retries and silently drops one of two concurrent offline edits.

### Facts that bear on the given ADR 0018

- CouchDB cookie sessions are stateless: `DELETE /_session` clears the client cookie only; no per-Device revoke.
- PocketBase is bearer-JWT, no sessions, no logout; an `HttpOnly` cookie needs a minting gateway. Appwrite has real cookie sessions and costs 15-20 containers.

### Build-option facts

- No maintained HAL library for Node (`hal` 8 years stale, `halson` inactive, `traverson-hal` client-only): hand-roll `_links`.
- `VACUUM INTO` is a consistent one-file backup from a live SQLite; Litestream optional.
- `node:sqlite` is Release Candidate (Node 25.7); `better-sqlite3` mature but native; matters only for a single executable (Bun `--compile` simpler than Node SEA).
- `@fastify/secure-session` is stateless, so per-Device revoke needs a session table anyway.
- Caddy needs no configuration for SSE or WebSocket upgrades.

## Scoring

Scores 1-5; weighted max 165.

### Server side

| Criterion | w | Build | Couch | RxDB | Yjs | PB | Zero | Elec | PSync |
|---|---|---|---|---|---|---|---|---|---|
| C1 operations | 5 | 5 | 3 | 4 | 3 | 5 | 2 | 2 | 1 |
| C2 conflict | 5 | 4 | 3 | 4 | 5 | 2 | 4 | 3 | 3 |
| C3 catch-up | 5 | 4 | 5 | 4 | 3 | 2 | 4 | 3 | 4 |
| C4 fit | 4 | 5 | 2 | 2 | 1 | 3 | 2 | 2 | 2 |
| C5 REST | 4 | 5 | 3 | 3 | 2 | 2 | 3 | 4 | 3 |
| C6 live | 3 | 4 | 4 | 4 | 5 | 4 | 5 | 4 | 4 |
| C7 blobs | 3 | 4 | 3 | 3 | 4 | 4 | 2 | 2 | 5 |
| C8 security | 3 | 5 | 2 | 4 | 4 | 2 | 4 | 3 | 3 |
| C9 battery | 1 | 4 | 4 | 4 | 3 | 4 | 3 | 4 | 3 |
| **Total** | | **148** | **106** | **117** | **109** | **99** | **106** | **95** | **99** |

Why, per candidate (the cell reasons):

- **Build**: one container, `VACUUM INTO`; keep both = no loss, one duplicate, repair by deleting; catch-up designed (tombstone window, cursor-too-old, dirty set) but unproven, hence 4; `Remote.ts` already declared against it; HAL hand-rolled, feed link is the cursor; SSE hint then GET; immutable blob PUT, no resumable; session table, revoke, Invites.
- **CouchDB + PouchDB**: Erlang container plus an app container for the PWA, sessions and Invites; backup is a data directory or `_replicate`; nothing lost but the loser is invisible until the app asks `conflicts=true` and builds the surface; decade-old protocol earns the only 5 on catch-up; PouchDB replaces the Local Store and every row becomes a `_rev` document (server-only variant with a hand-written replication client: fit 3); REST-ish without hypermedia; attachments travel inside documents, so full bytes are eager unless split; stateless cookie, no revoke.
- **RxDB + our server**: our container, but `rxdb-server` tier unclear; conflicts detected, keep-both only via custom handler; checkpoint iteration proven, server needs soft deletes; RxDB replaces the Local Store and `Live<T>`; pull/push JSON of fixed shape; `pullStream$` over SSE; attachment replication per transport unverified; our endpoints, our cookie.
- **Yjs + Hocuspocus**: a WebSocket process beside (or inside) the REST one, two stores; character-level merge, no repair; one document per Note to reconnect and metadata needs a second sync path; HTML Body becomes derived and previews, search, backup and attachment references all read HTML; WS-native; attachments unchanged; `onAuthenticate` sees the cookie; one socket per open document.
- **PocketBase**: one binary, built-in backup, thumbs; no conflict detection without hook code; no cursor feed, no tombstones; Local Store stays, id format risk; fixed URLs; SSE built in; bearer JWT, no logout.
- **Zero / Electric / PowerSync**: two to four services before our own API; Postgres backups; writes are ours in all three; each replaces Dexie with a client replica or TanStack DB; Electric's shapes are conditional GETs (REST 4); PowerSync alone has a first-class attachment queue.

Sensitivity: without C4, Build 128, RxDB 109, Yjs 105, CouchDB 98, Zero 98.
Yjs wins only if C2 is the sole criterion.

### Transports

| Criterion | w | Short poll | Long poll | REST + SSE | REST + WS | WS data | MQTT |
|---|---|---|---|---|---|---|---|
| C1 operations | 5 | 5 | 4 | 5 | 4 | 4 | 2 |
| C3 catch-up | 5 | 4 | 3 | 5 | 3 | 3 | 5 |
| C5 REST | 4 | 5 | 3 | 5 | 5 | 2 | 2 |
| C6 live | 3 | 2 | 4 | 5 | 5 | 5 | 5 |
| C8 security | 3 | 5 | 5 | 5 | 5 | 5 | 2 |
| C9 battery | 1 | 2 | 3 | 4 | 4 | 4 | 4 |
| **Total** (max 105) | | **88** | **77** | **104** | **93** | **77** | **68** |

Short polling at 5 s scores 91 (C6 3, C9 2): the honest runner-up, and the fallback in the winning design.

### The two scenarios for the finalists

Live Update (phone edits Note X, laptop tab open):

- Build + SSE: phone `PUT` with `If-Match` -> 200, sequence 41; `id: 41` on every open stream; laptop pulls from its cursor; one round trip after the push.
- CouchDB: phone writes rev 5; laptop's `_changes` longpoll returns; same latency.
- Yjs: keystrokes stream; the laptop shows text as it is typed.
- RxDB: `pullStream$` event; same as Build.

Conflict (both edit Note X, phone offline, then online):

- Build: laptop pushed rev 5 first; phone's `If-Match: "4"` gets 412 plus the server row; phone keeps its text as a new Note tagged Conflicts, named after the phone and the time; the user deletes one. No text lost, one duplicate.
- CouchDB: both leaves stored; an arbitrary deterministic winner shown everywhere; the loser invisible until fetched; we would build the same Conflicted Copy surface with less say over the winner.
- Yjs: both edits merged character by character; where they touched the same paragraph the text interleaves. No duplicate, no repair, occasionally surprising text.
- RxDB: conflict detected on push; our handler makes the Conflicted Copy; same as Build.

## Proposed verdict

**Build** (thin TypeScript server, Revision + change feed, keep-both) wins by a margin that survives removing the fit criterion, so ADR 0017 and ADR 0018 stand.
The wider candidate set did not turn up a ready-made stack that beats it: the two that come closest each win on a single criterion (CouchDB on catch-up maturity, Yjs on merge quality) and lose on operations, security posture and fit.

The evaluation does change five things, which is what "amend, not confirm" looks like:

1. **SSE is part of the design, not a follow-up.** ADR 0017 and `04-sync.md` made polling primary and an SSE hint a "slice-5 follow-up if it still looks worth it". The transport matrix says the opposite: SSE costs nothing to operate behind Caddy, the cookie rides free, `Last-Event-ID` is the feed cursor for free, iOS supports it, and it removes the C6-vs-C9 trade that polling has. Polling stays as the Catch-up trigger (focus, `online`, visibility) and as the fallback while the stream is down. *Your stated lean was polling; this is the one place the research argues against it, and the numbers are above.*
2. **Stale pushes are `412 Precondition Failed` against `If-Match`, not a 409.** RFC 9110's conditional-request machinery is exactly this check, and Nextcloud Notes already ships it. The Revision travels as the row's `ETag`. Batch pushes report the same outcome per row.
3. **The change feed has its own per-Account sequence**, distinct from per-row Revisions (CouchDB's `update_seq` vs `_rev`). The `_links.next` cursor and the SSE `id:` are that sequence. ADR 0017 left the cursor opaque; the design should name the two numbers.
4. **Background Sync is a Chromium-only enhancement, never the guarantee.** The dirty set retried on `online` and on open is the guarantee on every browser; Web Push is rejected on G1 (a third-party relay).
5. **Entity ids stay UUIDv4.** RFC 9562 recommends v7 for index locality and ULID is the same idea, but every existing row is v4, the server's tables are household-sized, and v7 leaks creation time we already store in `createdAt`. Recorded as a considered non-change.

Also recorded as considered and kept: attachment bytes are a separate immutable blob endpoint with idempotent `PUT` (CouchDB's in-document attachments would force eager full bytes, and PowerSync's queue is the only ready-made equivalent); no resumable upload (tus / the IETF draft are the upgrade path); Yjs remains the Body-only upgrade path inside the same Revision framework.

## Checkpoint outcome (2026-08-30)

- Verdict accepted: Build wins; ADR 0017 and ADR 0018 stand with the five amendments above.
- Amendment 1 accepted: SSE is the primary Live Update channel; polling is the Catch-up trigger (focus, `online`, visibility) and the fallback while the stream is down.
  Implementation delta: one optional `hints` method on `Remote`, one `text/event-stream` endpoint on the server, one extra trigger in the sync loop; a Remote without `hints` is polled.
- Raw research kept with the thesis material, outside this repository.
- Scores unchanged; tables reshaped for A4 (numbers-only matrices, reasons as bullets).
- Unverified claims stay out of the thesis text or are marked as such: CouchDB's backup story and signup lock-down, `rxdb-server`'s licence tier, PocketBase's static-serving page and id constraint, EventSource background-tab throttling.
- Written up as `ni-dip-thesys/text/design/sync.tex`; repo docs reconciled in `docs/architecture/04-sync.md`, `05-server.md`, ADR 0017 (amended) and ADR 0018 (re-evaluated note).

## Sources

Bib entries are in the `## Bib entries` blocks of the raw research files, kept with the thesis material, and land in `ni-dip-thesys/text/bib-database.bib` in step 4.
Reading record: MDN (EventSource, WebSocket, Background Sync, Periodic Sync, Push, Page Visibility, RequestInit, WebTransport, the two PWA guides), WHATWG SSE, RFC 6455, 8288, 9110, 9111, 9562, 8291, OASIS MQTT 5.0, Mosquitto, Caddy, caniuse, WebKit blog; CouchDB docs (protocol, conflicts, `_changes`, auth, CORS, peruser, purge, compaction, Docker), PouchDB, RxDB docs and pricing, Couchbase BSL post; ElectricSQL, TanStack DB, PowerSync, Zero, Triplit, Yjs, Hocuspocus, y-sweet, Automerge, Replicache; PocketBase, Appwrite, Supabase, Dexie Cloud pricing, Joplin specs, Nextcloud Notes API, Fastify, Drizzle, Node sqlite/SEA, Bun, SQLite, Litestream; Lamport 1978, Fidge 1988, Kulkarni et al. 2014, Shapiro et al. 2011, Kleppmann et al. 2019, DDIA, Fowler (Event Sourcing, RMM), Fielding 2000/2008, HAL draft, tus, IETF resumable uploads, Dropbox, Syncthing, the Medium article.
