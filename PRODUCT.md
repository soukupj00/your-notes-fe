# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two audiences of equal weight, using the same install:

- **The self-hoster.** Technically comfortable, runs the sync server on their own network, cares about data ownership, and is the one who sets up accounts and backups. Tolerates density and configuration.
- **The people they hand it to.** Household members, a partner, a friend. They never see the server and do not want to. For them the app must feel as immediate and unintimidating as Google Keep on first open.

Design decision that follows: the **daily surface is designed for the non-technical user**; technical depth lives in Settings, reachable but never in the way. Neither audience is the "secondary" one - the self-hoster's needs are met by depth on demand, not by making the feed harder.

Mobile-first is a product fact, not a preference: capture happens on a phone, one-handed, often in a hurry. Desktop and tablet are the second and third targets, including mobile landscape.

## Product Purpose

A self-hosted, open-source note-taking PWA - a Google Keep alternative you run yourself. Users capture notes, checklists, drawings, photos, audio, video, and files; organise them with labels and colours; and archive, pin, or trash them. Everything works fully offline on the device via IndexedDB, and syncs across that person's devices through a self-hosted server they control.

Success is a person who used Google Keep switching to this and not feeling like they downgraded - and being able to hand it to someone non-technical without explaining anything.

## Positioning

Ranked by the user, in this order:

1. **No online account with a corporation.** Nothing leaves your network. No corporate identity to create, nothing mined from your notes. This is the reason people arrive.
2. **An easy interface.** Keep's approachability is the bar to match, not to beat with complexity. If the privacy story costs usability, the switch does not stick.
3. **Your sync, offline-first.** The app is complete with no server at all; sync is an addition the user owns, not a dependency the product imposes.

Running through all three: **large customisability - make it your own.** The name is *YouNotes*. Themes (light, dark, colour-blind), density and font size, a user-configurable editor toolbar, note-create button alignment, choice of quick-capture actions, per-note and per-label colours. The product's claim is not "we chose well for you", it is "this one is yours" - a claim a hosted service structurally cannot make.

## Operating Context

- **Capture is fast and interrupted.** Phone, one hand, mid-task. Quick-capture starts (note, checklist, photo, audio, drawing) exist because the cost of opening the app must be near zero.
- **Reading is scanning.** The feed is a masonry or list wall of many cards at once. Colour and shape are how a note is found again, which is why colour is a first-class, per-note property.
- **The network is not assumed.** Offline is the normal case, not the error case. A mutation queue replays when connectivity returns.
- **Installation is a PWA install**, often prompted on a phone, from a server on the local network. App weight is a real cost the user feels.
- **Two locales ship from day one:** `en` and `cs`, with `en` as fallback. Every new string ships in both.

## Capabilities and Constraints

Domain terminology is canonical in [`CONTEXT.md`](./CONTEXT.md) - Note, Body, Checklist, Tag, NoteTag, Attachment (Image / Audio / Video / File / Drawing), Preview, State (Active / Archived / Trashed), Pinned, Color, Purge, Theme, Locale, Sync, Offline Mutation Queue.

Built and shipping:

- Notes with a rich TipTap body: marks, headings, lists, task lists, blockquote, colour and highlight, font family and size, maths (KaTeX).
- Inline attachments end to end - images, audio (with in-app recording), video, arbitrary files, Excalidraw drawings - stored as bytes in Dexie, referenced from the body, with cascade delete, undo, and orphan GC.
- Feed with masonry/list toggle, URL-driven search and sort and label filters, pin, archive, trash with undo.
- Labels with colours and a manage view (rename, recolour, merge, delete).
- Full-database backup and restore as a `.zip`.
- Light/dark theming in OKLCH, i18n (en/cs), PWA install prompt and update flow.

Technical constraints future work must respect:

- React 19 SPA, TypeScript, Vite, pnpm. TanStack Router (file-based). Tailwind v4 (CSS-based config). Radix/shadcn as the component base, customised. Dexie over IndexedDB. Biome for lint and format. Vitest + React Testing Library; Playwright deliberately deferred, UI verified manually.
- Colours are stored as **palette tokens, never raw values**, so every colour resolves through the active theme including the colour-blind variants.
- Timestamps are ISO strings; IDs are uuid v4.
- **No external network requests at runtime.** No font CDN, no analytics, no remote assets - the app must be complete on a local network with no internet. Anything typographic must be self-hosted and bundled.
- **Bundle weight is a product constraint.** The user has explicitly asked that any fonts added during exploration be pruned to only the ones the final design uses.
- Motion is the animation library of record. All motion must be gated on the reduced-motion preference.

Not yet built, and must not be described as existing: the sync server, accounts, the offline mutation queue, conflict resolution, and the colour-blind themes.

## Brand Commitments

- **Name: YouNotes.** In use in the PWA manifest. The "You" is the positioning - it is your data, your server, your configuration.
- Open source and self-hosted, distributed as a container image; setup must be approachable for a non-programmer.
- Icons must be **descriptive and recognisable**, an accessibility commitment from the original brief rather than a style choice.
- The current `#7257dc` manifest theme colour and shadcn-default look are **incumbent, not committed**. They are explicitly the thing M4 Slice 4 exists to replace.

## Evidence on Hand

- Real product content and code in this repository; the identity lab at `/prototype/identity` (dev-only route) with three exploratory directions.
- Domain glossary `CONTEXT.md`, roadmap `PLAN.md`, decision records `docs/adr/`.
- The thesis assignment and the brief's stack decisions, in `docs/architecture/07-requirements.md`.

Absent, and not to be fabricated: no users yet, no testimonials, no case studies, no benchmarks, no press, no pricing or licensing claims beyond "open source", no deployment or install numbers. **User testing with real participants is a required deliverable of the thesis and has not happened yet** - no finding may be attributed to it.

## Product Principles

1. **Approachable first, deep second.** A person handed this app must be productive without a tour. Power lives one layer down, never in the path of capture.
2. **The device is enough.** Every feature works with no server and no network. Sync extends the product; it never gates it.
3. **Colour and shape are navigation.** In a wall of notes, visual identity is how a note is found - so colour is data, stored as a theme-resolved token, never decoration bolted on.
4. **Make it theirs.** Customisation is the differentiator a hosted service cannot copy. Prefer a preference over a decision imposed on every user - but ship a default that is good enough that most never change it.
5. **Nothing leaves the network.** No remote fetch, no telemetry, no CDN. This is an architectural constraint before it is a promise.
6. **Accessibility is scope, not polish.** Colour-blind themes, recognisable icons, reduced motion, keyboard reachability, and en/cs parity are requirements the design must satisfy, not options.
