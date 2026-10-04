# The server

The backend lives in a separate repository (`ni-dip-be`), but its architecture was decided here because it constrains this repo's code: [ADR 0018](../adr/0018-the-server-serves-the-pwa.md).

## The central decision: the sync server serves the PWA

The standard self-hosted shape - frontend deployed somewhere, backend somewhere else, and a "enter your server address" text field - is where a meaningful share of non-technical users give up.
Three browser facts constrain harder than preference:

1. **A LAN address is not a secure context.** On `http://192.168.x.x` a browser refuses the service worker, install, `storage.persist()` and `getUserMedia` - that is not a degraded PWA, it is no PWA, and it kills mic and camera capture. Only HTTPS and `localhost` qualify, and no zero-config trusted certificate exists for a private IP.
2. **Cross-origin cookies need `SameSite=None; Secure`**, so a separately hosted frontend cannot use cookie auth over plain-HTTP LAN at all; the fallback (a bearer token in IndexedDB) is script-readable and unrevocable without a server-side blocklist - a session table with extra steps.
3. **"Sign out my lost phone" is a real requirement**, and it wants server-side sessions.

Decision: **one container, one origin, one thing to run** - the server serves the built PWA.
Everything else falls out:

- No server-address screen: the app is always already at its server, because the server handed it to the browser. Two servers = two origins = two installs and two isolated IndexedDB databases, which is correct isolation, not a limitation.
- Auth is an **`HttpOnly`, `SameSite=Lax` session cookie**, one session row per Device, revocable from Settings. JavaScript never touches it; "am I signed in" is answered by asking the server once at startup, not by inspecting storage. The cookie also rides free on the hint stream's `EventSource`, which cannot send an `Authorization` header.
- **TLS is Caddy's job**, in the compose stack, three documented modes: **Tailscale** (the recommended happy path: real trusted cert, no domain, no port forwarding, works away from home), **DNS-01** with an owned domain, and Caddy's **internal CA** for the fully offline. Application code never knows which. `http://localhost` stays first-class for a same-machine server.

## Accounts

- The first visit to a fresh server creates the **Owner**; registration then closes; further Local Accounts are created by spending a one-time **Invite**.
- Accounts are **private silos**: no way to hand a Note to another Account; two people share the machine, not their Notes.
- **No email, no SMTP** anywhere in the project, hence no self-service password reset: the Owner resets a member's password from Settings; the Owner's own is reset with one command against the container.
- Sync is **opt-in**: the app is fully usable, Tour included, with no Account at all. Signing in is an upgrade, never a gate. (Adopt-on-sign-in / erase-on-sign-out semantics: [04-sync.md](./04-sync.md).)

## Stack

Chosen together, each choice constraining the next (see [`PLAN.md`](../../PLAN.md) M5):

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | The wire contract becomes one shared Zod file instead of two definitions that drift |
| HTTP | Fastify | Fast, schema-first, `@fastify/static` serves the PWA |
| Database | SQLite (`better-sqlite3`) + Drizzle | A self-hoster's backup should be "copy one file"; PostgreSQL and S3-compatible blob storage are optional backends since the storage rework (backend repo, `docs/setup-backends.md`) |
| TLS / edge | Caddy | The three modes above without application involvement |
| Packaging | One container via `compose.yml` | The non-programmer setup path; a single-executable build is a possible later path, not foreclosed |

## API style: REST with HAL

The brief commits to REST + HATEOAS, and ADR 0017 is what keeps that honest: nothing in the sync model needs a persistent socket.

- Responses are `application/hal+json`; the sync change feed is a hypermedia collection where the device stores the opaque `_links.next` URL as its cursor and never builds a query string.
- Change pages carry a strong `ETag` over their body and the server answers `304`, so revalidation is cheap; a page is not immutable, because a re-edited row moves to a new Sequence.
- The **contract is owned by the backend repo** and vendored here as one committed file (`pnpm contract:pull`); every response is validated with Zod at the boundary, which doubles as the drift alarm between repos.
- An SSE hint endpoint is part of the API (re-evaluated 2026-08-30, [04-sync.md](./04-sync.md)): `text/event-stream`, event `id` = the Account's change sequence, no payload; Caddy flushes it without configuration and the session cookie rides on it.
- Batch push reports an outcome per row; per-resource `PUT` with `If-Match` is later work.
- No maintained HAL library exists for Node, so `_links` / `_embedded` are hand-rolled per resource.
- Sessions are a table (one row per Device), because per-Device revoke needs server-side state that a stateless encrypted cookie cannot provide.

## What this repo holds for the connection

- `AccountProvider`: signed-in state and the current Device, with no token to hold and no URL to configure.
- `SyncProvider`, running the loop ([04-sync.md](./04-sync.md)); network logic stays out of components.
- The HAL client (`src/data/http/`), which validates every response against the vendored contract.
- Settings: sign in and out, Pairing Links, the Devices list with revoke, Members and Invites, Shared Notes, and one block answering "is my data safe here" (storage persistence, last sync, pending changes).
- `/pair`, where a Pairing Link signs a new Device in, and `/share/$token`, a Share Link's read-only page.
- The frontend image ([ADR 0006](../adr/0006-ci-cd-and-container-image-distribution.md)): the backend image builds from it and serves its assets.

## Security posture (for the paper's threat model)

- **In scope**: session revocation per Device, `HttpOnly` cookies (no script-readable credentials), closed registration + Invites, origin isolation between servers, TLS in all three modes.
- **Out of scope, documented rather than hand-waved**: end-to-end encryption. E2EE here would protect the server disk while the devices' IndexedDB and the zip backup stay plaintext - it defends only against an attacker who has the server but no device, on a box in the user's own home. Its real cost is recovery: with no email and no reset, a forgotten password means permanent total loss, and the Owner's member-password reset becomes an act of destruction. Recorded as future work; the setup guide states the household caveat plainly: *the person who runs the server can read the database*.
- Certificates remain the one honestly hard step; the design removes the typed-IP screen and the whole CORS failure class, not the physics of TLS on a home network.

## For the paper

- This chapter is a case study in *deployment topology driving application architecture*: secure-context rules and cookie semantics, not taste, force the single-origin design.
- The auth discussion (cookie vs. bearer-in-IndexedDB) and the E2EE trade-off are both defensible-decision write-ups with clear adversary models.
- The HAL cursor ("the URL is the cursor") is a concrete, honest HATEOAS benefit - rare enough in real systems to be worth a paragraph.
