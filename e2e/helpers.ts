import { expect, type Page } from '@playwright/test';

/**
 * A fresh context is offered the Welcome and, in Settings, the Tour, both of which make the app
 * `inert`, so both offers are recorded as made in the Preferences schema's own shape. A string, not
 * a function: `tsconfig.node.json` has no DOM lib, so a callback naming `localStorage` would not
 * typecheck.
 */
export async function skipTour(page: Page) {
  const seen = '2026-01-01T00:00:00.000Z';
  await page.addInitScript(
    `localStorage.setItem('preferences', ${JSON.stringify(
      JSON.stringify({ version: 2, onboardingSeenAt: seen, welcomeSeenAt: seen })
    )});`
  );
}

/**
 * A server that answered with nobody signed in on this Device; `setupNeeded` keeps the root's
 * `setup` link, which a server drops once it has an Owner.
 */
export async function signedOutServer(page: Page, { setupNeeded = false } = {}) {
  const rels = ['self', 'health', 'docs', 'openapi', 'session', 'devices', 'codes', 'accounts'];
  rels.push('changes', 'stream', 'blobs', 'shares', ...(setupNeeded ? ['setup'] : []));
  const root = { _links: Object.fromEntries(rels.map((rel) => [rel, { href: `/api/${rel}` }])) };
  await page.route('**/api', (route) =>
    route.fulfill({ contentType: 'application/hal+json', body: JSON.stringify(root) })
  );
  await page.route('**/api/session', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/problem+json',
      body: JSON.stringify({ type: 'about:blank', title: 'Not signed in', status: 401 }),
    })
  );
}

/**
 * A server where this Device is signed in as the Owner, alone, until it signs out. Sync's own
 * requests are refused: these tests are about the Settings around it, not a run.
 */
export async function signedInServer(page: Page) {
  const [owner, device] = [crypto.randomUUID(), crypto.randomUUID()];
  let signedIn = true;
  const hal = (body: object, status = 200) => ({
    status,
    contentType: 'application/hal+json',
    body: JSON.stringify(body),
  });
  const list = (rel: string, items: object[] = []) =>
    hal({ _links: { self: { href: `/api/${rel}` } }, _embedded: { [rel]: items } });
  await signedOutServer(page);
  await page.route('**/api/{changes,blobs}**', (route) => route.abort());
  await page.route('**/api/session', async (route) => {
    if (route.request().method() === 'DELETE') {
      signedIn = false;
      return route.fulfill({ status: 204 });
    }
    if (!signedIn) return route.fallback();
    await route.fulfill(
      hal({
        account: { id: owner, username: 'ada', role: 'owner' },
        device: { id: device, name: 'Phone' },
        _links: {
          self: { href: '/api/session' },
          devices: { href: '/api/devices' },
          codes: { href: '/api/codes' },
          changes: { href: '/api/changes' },
          blobs: { href: '/api/blobs/{id}', templated: true },
          shares: { href: '/api/shares' },
        },
      })
    );
  });
  await page.route('**/api/devices', (route) =>
    route.fulfill(
      list('devices', [
        {
          id: device,
          name: 'Phone',
          createdAt: '2026-01-01T00:00:00.000Z',
          lastSeenAt: '2026-01-01T00:00:00.000Z',
          current: true,
          _links: { self: { href: `/api/devices/${device}` } },
        },
      ])
    )
  );
  await page.route('**/api/shares', (route) => route.fulfill(list('shares')));
  await page.route('**/api/accounts', (route) =>
    route.fulfill(
      list('accounts', [
        {
          id: owner,
          username: 'ada',
          role: 'owner',
          createdAt: '2026-01-01T00:00:00.000Z',
          _links: {
            self: { href: `/api/accounts/${owner}` },
            password: { href: `/api/accounts/${owner}/password` },
          },
        },
      ])
    )
  );
}

/**
 * Whichever capture surface this width shows: the dial below `sm:`, the
 * desktop bar above it. Plain text is the bar's own field there, so it has no
 * button named like the dial's; every other start is an icon with that name.
 */
export async function startNote(page: Page, start: string) {
  const dial = page.getByRole('button', { name: 'New note' });
  const bar = page.getByRole('button', { name: 'Take a note…' });
  // `isVisible` does not wait, so first wait for whichever surface this width
  // renders - a cold load has neither on screen yet.
  await dial.or(bar).waitFor();
  if (await dial.isVisible()) {
    await dial.click();
    await page.getByRole('button', { name: start, exact: true }).click();
    return;
  }
  if (start === 'Note') {
    await page.getByRole('button', { name: 'Take a note…' }).click();
    return;
  }
  await page.getByRole('button', { name: start, exact: true }).click();
}

/** Creates a text note through the UI and closes it, so it sits on the wall. */
export async function newTextNote(page: Page, title: string, body = '') {
  await startNote(page, 'Note');
  const titleField = page.getByRole('textbox', { name: 'Title' });
  await titleField.fill(title);
  if (body) {
    await page.locator('.tiptap').click();
    await page.keyboard.type(body);
  }
  await closeNote(page);
  await page.getByRole('heading', { name: title }).waitFor();
}

/** Mobile closes from the app bar's back arrow, desktop from the dialog's X. */
export async function closeNote(page: Page) {
  const back = page.getByRole('button', { name: 'Back' });
  if (await back.isVisible()) await back.click();
  else await page.getByRole('button', { name: 'Close' }).click();
  // Closing pops history, which lands later: a `goto` or `reload` sent before then is aborted.
  await expect(page).not.toHaveURL(/[?&]note=/);
}

/** A Card on the wall, found by its title. */
export function card(page: Page, title: string) {
  return page.locator('[data-slot="card"]', {
    has: page.getByRole('heading', { name: title }),
  });
}
