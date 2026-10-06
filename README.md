# YouNotes

A self-hosted, open-source note-taking app you run yourself, as an alternative to Google Keep.
Capture notes, checklists, drawings, photos, audio, video and files, organise them with labels and colours, and use it fully offline.
It is a PWA: open it in a browser and install it to the home screen or desktop.

This repository is the app.
The sync server that keeps your Devices in step is [`ni-dip-be`](https://gitlab.fit.cvut.cz/soukuj26/ni-dip-be).

## Syncing between your Devices

Without a server, the app keeps everything on the one Device it is installed on.
To sync between your phone and your laptop, you run the YouNotes server on a machine at home, and every Device opens the app from that server.

Follow the step-by-step guide, written for people who are not programmers: [Setting up YouNotes at home](https://gitlab.fit.cvut.cz/soukuj26/ni-dip-be/-/blob/main/docs/setup.md).
It covers the three ways to reach the server: Tailscale (recommended), your own domain, and only on your home Wi-Fi.

There is no server address to type into the app.
The server hands out the app itself, and the app syncs with whichever server it was opened from.
So always open and install it from your server's address; a copy installed from anywhere else does not sync with your server.

## Develop

Needs Node 24 and pnpm through corepack (`corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # Vitest
pnpm test:e2e     # Playwright; first run needs `pnpm exec playwright install chromium`
pnpm check        # Biome: lint and format
pnpm build        # type-check and build into dist/
```

For the account and sync screens (Settings, `/pair`), run the server's `pnpm dev` alongside, in the `ni-dip-be` repository checked out next to this one.
Vite forwards `/api` and `/health` to it on port 3000.
The Pairing Link the server prints points at port 3000, so open its `/pair#<code>` on port 5173 instead.

To try sync on a real phone, the server has to serve this app over `https`.
The server's README shows how, with `pnpm build` here and Tailscale: [Try it on your phone](https://gitlab.fit.cvut.cz/soukuj26/ni-dip-be/-/blob/main/README.md#try-it-on-your-phone).

## Release

The server's image is built from this repo's image, so this repo is released first.

1. Bump `version` in `package.json` and merge to `main`; CI publishes the image as `latest`.
2. Tag that commit `v0.x.y` and push the tag; CI builds, smoke-tests and publishes the image under that tag.
3. Release the server: its [README](https://gitlab.fit.cvut.cz/soukuj26/ni-dip-be/-/blob/main/README.md#release) has the steps.
   Its image takes whatever this repo's `latest` is when it builds, so tag it only after step 1's pipeline has finished.

## Storage

The app persists to IndexedDB (via Dexie) by default.
An in-memory store that persists nothing also ships, for tests and for deployments that want no persistence.
See [`src/data/CLAUDE.md`](./src/data/CLAUDE.md) for bringing your own store.
A Backup carries Notes, Tags and Attachments but not Preferences, which stay with the device.

## More

- [`PRODUCT.md`](./PRODUCT.md): who the app is for.
- [`CONTEXT.md`](./CONTEXT.md): what the words mean (Note, Tag, Attachment, Device, Sync).
- [`PLAN.md`](./PLAN.md): the roadmap.
- [`DESIGN.md`](./DESIGN.md): the visual design rules.
- [`docs/adr/`](./docs/adr/): the decisions and why.

## License

[MIT](./LICENSE).

<img src="https://fit.cvut.cz/static/images/fit-cvut-logo-en.svg" alt="FIT CTU logo" height="200">

This software was developed with the support of the **Faculty of Information Technology, Czech Technical University in Prague**.
For more information, visit [fit.cvut.cz](https://fit.cvut.cz/en).
