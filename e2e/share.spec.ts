import { expect, test } from '@playwright/test';

test('a Share Link page never asks the server who is signed in', async ({ page }) => {
  const asked: string[] = [];
  page.on('request', (request) => {
    const { pathname } = new URL(request.url());
    if (pathname === '/api' || pathname === '/api/session') asked.push(pathname);
  });
  await page.route('**/api/public/shares/**', (route) => route.fulfill({ status: 404 }));

  await page.goto('/share/no-such-token');

  await expect(page.getByText('Nothing is shared here')).toBeVisible();
  expect(asked).toEqual([]);
});

test("a stranger's Note is mounted whole, with its links and Drawing named", async ({ page }) => {
  const at = '2026-11-25T10:00:00.000Z';
  const noteId = '11111111-1111-4111-8111-111111111111';
  const drawingId = '33333333-3333-4333-8333-333333333333';
  await page.route('**/api/public/shares/t', (route) =>
    route.fulfill({
      contentType: 'application/hal+json',
      body: JSON.stringify({
        note: {
          id: noteId,
          header: 'Trip',
          state: 'active',
          createdAt: at,
          updatedAt: at,
          body:
            '<p>See <a href="https://example.com/forecast">the forecast</a></p>' +
            `<excalidraw-drawing data-attachment-id="${drawingId}"></excalidraw-drawing>`,
          attachments: [
            {
              id: drawingId,
              noteId,
              kind: 'excalidraw',
              mime: 'application/json',
              name: 'drawing.excalidraw',
              preview:
                '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="10"><rect width="20" height="10"/></svg>',
              createdAt: at,
              updatedAt: at,
            },
          ],
        },
        _links: {
          self: { href: '/api/public/shares/t' },
          blobs: { href: '/api/public/shares/t/blobs/{id}', templated: true },
        },
      }),
    })
  );

  await page.goto('/share/t');

  const main = page.getByRole('main');
  await expect(
    main.getByRole('link', { name: 'the forecast', exact: true })
  ).toHaveAccessibleDescription('(opens in a new tab)');
  await expect(main.getByRole('img', { name: 'Drawing', exact: true })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toHaveText('Shared from YourNotes');
});
