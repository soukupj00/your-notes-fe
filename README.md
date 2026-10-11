# YourNotes

A self-hosted, open-source note-taking app you run yourself, as an alternative to Google Keep.
Capture notes, checklists, drawings, photos, audio, video and files, organise them with labels and colours, and use it fully offline.
It is a PWA: open it in a browser and install it to the home screen or desktop.

This repository is the app.
The [YourNotes server](https://soukupj00.github.io/your-notes-be/) keeps your Devices in step and serves the app from your own home.

**The site, [soukupj00.github.io/your-notes-fe](https://soukupj00.github.io/your-notes-fe/), has the rest:** how it works, how to install it, and the guides for developers.

## Develop

Needs Node 24 and pnpm through corepack (`corepack enable`).

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # Vitest
pnpm test:e2e     # Playwright; first run needs `pnpm exec playwright install chromium`
pnpm check        # Biome: lint and format
pnpm build        # type-check and build into dist/
pnpm docs:dev     # the site, from docs/
```

For the account and sync screens, run the server's `pnpm dev` alongside; [For developers](https://soukupj00.github.io/your-notes-fe/developers/) has the details and the release steps.

## License

[MIT](./LICENSE).

<img src="https://fit.cvut.cz/static/images/fit-cvut-logo-en.svg" alt="FIT CTU logo" height="200">

This software was developed with the support of the **Faculty of Information Technology, Czech Technical University in Prague**.
For more information, visit [fit.cvut.cz](https://fit.cvut.cz/en).
