import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/renderRoute.tsx';
import { clearStore } from '@/test/store.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}:${Object.values(opts).join(',')}` : key,
    i18n: { language: 'en' },
  }),
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

afterEach(async () => {
  localStorage.clear();
  await clearStore();
});

const leaf = () =>
  screen.queryByRole('switch', { name: 'settings.toolbar.item.show:editor.heading.h3' });
const groupList = () => screen.queryByRole('heading', { name: 'settings.toolbar.groups' });

describe('the open toolbar group', () => {
  it('opens from the URL', async () => {
    renderRoute('/settings/toolbar?group=style');

    await waitFor(() => expect(leaf()).toBeInTheDocument());
  });

  it('shows the group list for a group this build does not have', async () => {
    renderRoute('/settings/toolbar?group=nope');

    await waitFor(() => expect(groupList()).toBeInTheDocument());
  });

  it('closes on the platform Back, staying on the page', async () => {
    const router = renderRoute('/settings/toolbar');
    await userEvent.click(
      await screen.findByRole('button', { name: /^editor\.toolbar\.family\.style/ })
    );
    await waitFor(() => expect(router.state.location.search).toEqual({ group: 'style' }));
    expect(leaf()).toBeInTheDocument();

    router.history.back();

    await waitFor(() => expect(groupList()).toBeInTheDocument());
    expect(router.state.location.pathname).toBe('/settings/toolbar');
    expect(router.state.location.search).toEqual({});
  });

  it.each([
    ['pushed', ['/settings/toolbar']],
    ['cold', ['/settings/toolbar?group=style']],
  ])('leaves no group behind when its Back closes a %s group', async (kind, entries) => {
    const router = renderRoute(entries);
    if (kind === 'pushed') {
      await userEvent.click(
        await screen.findByRole('button', { name: /^editor\.toolbar\.family\.style/ })
      );
    }
    const before = router.history.length;

    await userEvent.click(await screen.findByRole('button', { name: 'settings.toolbar.back' }));

    await waitFor(() => expect(router.state.location.search).toEqual({}));
    expect(router.state.location.pathname).toBe('/settings/toolbar');
    // A pushed group is popped; a cold one is replaced, never pushed over.
    expect(router.history.length).toBe(before);
  });
});
