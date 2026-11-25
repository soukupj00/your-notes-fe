import { expect, test } from '@playwright/test';

// Installed copies already carry the id computed from `start_url: '/'`; any other value orphans them.
test("the manifest's id is the one existing installs have", async ({ request }) => {
  const manifest = await (await request.get('/manifest.webmanifest')).json();
  expect(manifest.id).toBe('/');
});
