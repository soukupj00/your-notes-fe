import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ViewModeProvider } from '@/context/viewModeProvider.tsx';
import { ViewModeToggle } from './ViewModeToggle.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  localStorage.clear();
});

describe('ViewModeToggle', () => {
  it('is named by the layout a press switches to, and flips after a press', async () => {
    render(
      <ViewModeProvider>
        <ViewModeToggle />
      </ViewModeProvider>
    );

    await userEvent.click(screen.getByRole('button', { name: 'notes.view.stack' }));

    expect(screen.getByRole('button', { name: 'notes.view.masonry' })).toBeInTheDocument();
  });
});
