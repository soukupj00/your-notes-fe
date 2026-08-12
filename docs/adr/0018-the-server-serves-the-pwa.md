# 0018 - The sync server serves the PWA, and that decides auth, pairing and TLS

- Status: Accepted
- Date: 2026-08-12

## Context

The brief asks for a self-hosted server that an average person can set up, and for the PWA to sync with it across their devices.
The standard shape - a frontend deployed somewhere, a backend deployed somewhere else, and a text field where the user types their server's address - is what most self-hosted note and media apps do, and it is where a meaningful share of non-technical users give up.

Three facts constrain the design harder than preference does.

**A LAN address is not a secure context.**
On `http://192.168.1.20:3000` a browser refuses to register a service worker, refuses to install the app, refuses `navigator.storage.persist()`, and refuses `getUserMedia`.
That is not a degraded PWA, it is not a PWA - and it also kills the microphone and camera capture M3 already shipped.
Only HTTPS and `localhost` qualify, and there is no zero-configuration trusted certificate for a private IP.

**Cross-origin cookies need `SameSite=None; Secure`.**
So a separately hosted frontend cannot use cookie auth over a plain-HTTP LAN at all, and the fallback - a bearer token in IndexedDB - is readable by any script on the page and cannot be revoked without a server-side blocklist, which is a session table with extra steps.

**"Sign out my lost phone" is a real requirement** for a personal note server, and it wants server-side sessions.

## Decision

**The sync server serves the built PWA from its own origin.** One container, one address, one thing to run.

Everything else follows from it rather than being chosen separately:

- **There is no "enter your server address" screen.** The app is always already at its server, because that server is what handed it to the browser. Two servers means two origins, two installs and two isolated databases, which is correct isolation rather than a limitation.
- **Auth is an `HttpOnly`, `SameSite=Lax` session cookie**, one row per Device, revocable from Settings. JavaScript never touches it. It also arrives for free on a future `EventSource`, which cannot send an `Authorization` header.
- **TLS is Caddy's job, not ours.** Caddy sits in the compose stack and offers three documented modes - Tailscale (the recommended happy path: a real trusted certificate, no domain, no port forwarding, works away from home), DNS-01 with a domain the user owns, and its internal CA for the fully offline. No application code knows which was chosen. `http://localhost` remains a first-class path for a server running on the machine being used, which is exactly the setup a supervised user test on a desktop wants.
- **Accounts are private silos.** The first visit to a fresh server creates the Owner; registration is then closed, and further Local Accounts are created by spending an Invite. There is no email and no SMTP anywhere in the project, so there is no self-service password reset: the Owner resets a household member's password from Settings, and the Owner's own is reset with one command against the container.
- **Signing in adopts, signing out erases.** A device that has never been attached to an Account uploads its existing Notes on first sign-in (ids are UUIDv4, so nothing collides). Once attached, signing out clears the local database - the server holds everything, and this is what stops the next person to sign in on a shared laptop from adopting someone else's Notes into their own Account. Sign-out is blocked while the Queue is non-empty, and offers the M4 zip backup first.
- **Sync is opt-in.** The app stays fully usable with no Account at all, Tour included. Signing in is an upgrade, never a gate.

## Consequences

- **The frontend container image published by [ADR 0006](./0006-ci-cd-and-container-image-distribution.md) changes purpose.** It is no longer the way a self-hoster runs the app; the backend image embeds the built assets. The frontend image remains useful for serving the PWA behind someone's own reverse proxy, which is now the advanced path and requires HTTPS plus CORS.
- **End-to-end encryption is out of scope for M5**, and the threat model is documented instead. E2EE here would protect a server disk while leaving the devices' IndexedDB and the zip backup in plaintext, so it defends only against an attacker who has the server but no device - narrow, on a box in the user's own home. Its cost is not the crypto but the recovery: with no email and no reset, a forgotten password would mean permanent, total loss, and the Owner's "reset a member's password" would become an act of destruction. Recorded as future work, with the household caveat stated plainly in the setup guide: the person who runs the server can read the database.
- **A self-hoster who will not install Docker has a path**, because a TypeScript server can ship as a single executable. Not built in M5, but not foreclosed.
- **Certificates remain the one hard step.** This decision removes the typed-IP screen and the CORS class of failure; it does not make TLS on a home network free. The documentation carries a single happy path rather than pretending there is no choice.
