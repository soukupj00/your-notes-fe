import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';

const repo = 'https://github.com/soukupj00/your-notes-fe';
const adrDir = new URL('../adr/', import.meta.url);

// Read from the folder, so a new ADR reaches the sidebar without an edit here.
const decisions = readdirSync(adrDir)
  .filter((file) => /^\d{4}-.+\.md$/.test(file))
  .sort()
  .map((file) => {
    const heading = readFileSync(new URL(file, adrDir), 'utf8').split('\n', 1)[0];
    const title = heading.replace(/^#\s*(\d{4}\s*[\u2014-]\s*)?/, '').replaceAll('`', '');
    return { text: `${file.slice(0, 4)} ${title}`, link: `/adr/${file.replace(/\.md$/, '')}` };
  });

const forDevelopers = [
  {
    text: 'For developers',
    link: '/developers/',
    items: [
      { text: 'The Local Store', link: '/developers/local-store' },
      { text: 'Sync', link: '/developers/sync' },
      { text: 'The editor', link: '/developers/editor' },
      { text: 'Languages', link: '/developers/i18n' },
      { text: 'Design', link: '/developers/design' },
      { text: 'Testing', link: '/developers/testing' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Architecture', link: '/architecture/01-architecture' },
      { text: 'Database and schema', link: '/architecture/03-database' },
      { text: 'Sync', link: '/architecture/04-sync' },
      { text: 'The server', link: '/architecture/05-server' },
      { text: 'Technology and packages', link: '/architecture/06-technology' },
      { text: 'Testing strategy', link: '/architecture/08-testing' },
    ],
  },
  { text: 'Decisions', link: '/adr/', collapsed: true, items: decisions },
];

const config = withMermaid(
  defineConfig({
    title: 'YouNotes',
    description:
      'Notes, checklists, drawings and photos, on your devices, synced by a server you own.',
    base: '/your-notes-fe/',
    // Agent context and thesis-only chapters stay in the repository, off the site.
    srcExclude: [
      'superpowers/**',
      'research/**',
      'thesis/**',
      'sync-evaluation.md',
      'architecture/README.md',
      'architecture/02-use-cases.md',
      'architecture/07-requirements.md',
      'architecture/09-evaluation.md',
      'architecture/10-related-work.md',
    ],
    // Natural size; the theme's CSS scrolls a diagram wider than the page.
    mermaid: {
      flowchart: { useMaxWidth: false },
      sequence: { useMaxWidth: false },
      er: { useMaxWidth: false },
    },
    themeConfig: {
      nav: [
        { text: 'Home', link: '/' },
        { text: 'How it works', link: '/how-it-works' },
        { text: 'Get the app', link: '/get-the-app' },
        {
          text: 'For developers',
          link: '/developers/',
          activeMatch: '^/(developers|architecture|adr)/',
        },
      ],
      socialLinks: [{ icon: 'github', link: repo, ariaLabel: 'The app on GitHub' }],
      sidebar: {
        '/developers/': forDevelopers,
        '/architecture/': forDevelopers,
        '/adr/': forDevelopers,
        '/': [
          {
            text: 'For everyone',
            items: [
              { text: 'How it works', link: '/how-it-works' },
              { text: 'Get the app', link: '/get-the-app' },
              {
                text: 'Set up the server',
                link: 'https://soukupj00.github.io/your-notes-be/setup',
              },
            ],
          },
        ],
      },
      outline: [2, 3],
      search: { provider: 'local' },
      footer: {
        message: `Released under the <a href="${repo}/blob/main/LICENSE">MIT License</a>.`,
        copyright:
          '<img src="https://fit.cvut.cz/static/images/fit-cvut-logo-en.svg" alt="FIT CTU logo" style="height: 56px; margin: 8px auto">Developed with the support of the <a href="https://fit.cvut.cz/en">Faculty of Information Technology, Czech Technical University in Prague</a>.',
      },
    },
  })
);

export default config;
