import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { renderRoute } from '@/test/renderRoute.tsx';
import { clearStore, testStore } from '@/test/store.tsx';

// Its own file because the editor chunk loads once per module registry: only the
// first open in a file goes through the lazy fallback, and that is the case here.

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
  default: {},
}));

vi.mock('@/i18n', () => ({
  default: { options: { supportedLngs: ['en'] }, resolvedLanguage: 'en', changeLanguage: vi.fn() },
}));

// TipTap does not run in jsdom; the dialog around it is what this test is about.
vi.mock('@/components/editor/editor.tsx', () => ({
  Editor: () => <textarea data-testid="editor" />,
}));

const realResizeObserver = globalThis.ResizeObserver;

beforeEach(() => {
  window.innerWidth = 1024;
  // The feed's no-measurement path, so the Card is clickable in jsdom (see
  // `NotesView.openNote.test.tsx`).
  // @ts-expect-error deliberately removing the global for this test
  globalThis.ResizeObserver = undefined;
  // A Fine pointer, so opening moves focus into the title and closing has to bring it back.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(pointer: fine)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
});

afterEach(async () => {
  globalThis.ResizeObserver = realResizeObserver;
  vi.unstubAllGlobals();
  localStorage.clear();
  await clearStore();
});

it('hands focus back to the Card after a cold open through the loading fallback', async () => {
  const now = new Date().toISOString();
  await testStore.notes.add({
    id: crypto.randomUUID(),
    header: 'Milk and bread',
    body: '<p>Body</p>',
    state: 'active',
    createdAt: now,
    updatedAt: now,
  });
  renderRoute('/');

  await userEvent.click(await screen.findByText('Milk and bread'));
  const title = await screen.findByLabelText('notes.titlePlaceholder');
  await waitFor(() => expect(title).toHaveFocus());
  await userEvent.keyboard('{Escape}');

  await waitFor(() => expect(title).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Milk and bread' })).toHaveFocus());
});
