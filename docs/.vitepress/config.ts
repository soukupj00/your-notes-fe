import { readdirSync, readFileSync } from 'node:fs';
import { defineConfig } from 'vitepress';
import { withMermaid } from 'vitepress-plugin-mermaid';
import {
  czechFooter,
  czechRedirect,
  czechSearch,
  czechThemeConfig,
  keepCzechPrepositionsAttached,
} from './czech';

const repo = 'https://github.com/soukupj00/your-notes-fe';
const base = '/your-notes-fe/';

// Read from the folder, so a new ADR reaches the sidebar without an edit here.
function decisionsIn(locale: '' | '/cs') {
  const adrDir = new URL(`..${locale}/adr/`, import.meta.url);
  return readdirSync(adrDir)
    .filter((file) => /^\d{4}-.+\.md$/.test(file))
    .sort()
    .map((file) => {
      const heading = readFileSync(new URL(file, adrDir), 'utf8').split('\n', 1)[0];
      const title = heading.replace(/^#\s*(\d{4}\s*[\u2014-]\s*)?/, '').replaceAll('`', '');
      return {
        text: `${file.slice(0, 4)} ${title}`,
        link: `${locale}/adr/${file.replace(/\.md$/, '')}`,
      };
    });
}

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
  { text: 'Decisions', link: '/adr/', collapsed: true, items: decisionsIn('') },
];

const forDevelopersCzech = [
  {
    text: 'Pro vývojáře',
    link: '/cs/developers/',
    items: [
      { text: 'Lokální úložiště', link: '/cs/developers/local-store' },
      { text: 'Synchronizace', link: '/cs/developers/sync' },
      { text: 'Editor', link: '/cs/developers/editor' },
      { text: 'Jazyky', link: '/cs/developers/i18n' },
      { text: 'Design', link: '/cs/developers/design' },
      { text: 'Testování', link: '/cs/developers/testing' },
    ],
  },
  {
    text: 'Reference',
    items: [
      { text: 'Architektura', link: '/cs/architecture/01-architecture' },
      { text: 'Databáze a schéma', link: '/cs/architecture/03-database' },
      { text: 'Synchronizace', link: '/cs/architecture/04-sync' },
      { text: 'Server', link: '/cs/architecture/05-server' },
      { text: 'Technologie a balíčky', link: '/cs/architecture/06-technology' },
      { text: 'Strategie testování', link: '/cs/architecture/08-testing' },
    ],
  },
  { text: 'Rozhodnutí', link: '/cs/adr/', collapsed: true, items: decisionsIn('/cs') },
];

const config = withMermaid(
  defineConfig({
    title: 'YourNotes',
    description:
      'Notes, checklists, drawings and photos, on your devices, synced by a server you own.',
    base,
    head: [
      ['link', { rel: 'icon', type: 'image/png', href: `${base}note-128.png` }],
      ['script', {}, czechRedirect(base)],
    ],
    locales: {
      root: { label: 'English', lang: 'en' },
      cs: {
        label: 'Čeština',
        lang: 'cs',
        title: 'YourNotes',
        description:
          'Poznámky, seznamy úkolů, kresby a fotky na vašich zařízeních, synchronizované serverem, který vlastníte.',
        themeConfig: {
          ...czechThemeConfig,
          nav: [
            { text: 'Úvod', link: '/cs/' },
            { text: 'Jak to funguje', link: '/cs/how-it-works' },
            { text: 'Získat aplikaci', link: '/cs/get-the-app' },
            {
              text: 'Pro vývojáře',
              link: '/cs/developers/',
              activeMatch: '^/cs/(developers|architecture|adr)/',
            },
          ],
          socialLinks: [{ icon: 'github', link: repo, ariaLabel: 'Aplikace na GitHubu' }],
          sidebar: {
            '/cs/developers/': forDevelopersCzech,
            '/cs/architecture/': forDevelopersCzech,
            '/cs/adr/': forDevelopersCzech,
            '/cs/': [
              {
                text: 'Pro všechny',
                items: [
                  { text: 'Jak to funguje', link: '/cs/how-it-works' },
                  { text: 'Získat aplikaci', link: '/cs/get-the-app' },
                  {
                    text: 'Nastavení serveru',
                    link: 'https://soukupj00.github.io/your-notes-be/cs/setup',
                  },
                ],
              },
            ],
          },
          footer: czechFooter(repo),
        },
      },
    },
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
    markdown: { config: keepCzechPrepositionsAttached },
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
      search: { provider: 'local', options: { locales: { cs: czechSearch } } },
      footer: {
        message: `Released under the <a href="${repo}/blob/main/LICENSE">MIT License</a>.`,
        copyright:
          '<img src="https://fit.cvut.cz/static/images/fit-cvut-logo-en.svg" alt="FIT CTU logo" style="height: 56px; margin: 8px auto">Developed with the support of the <a href="https://fit.cvut.cz/en">Faculty of Information Technology, Czech Technical University in Prague</a>.',
      },
    },
  })
);

export default config;
