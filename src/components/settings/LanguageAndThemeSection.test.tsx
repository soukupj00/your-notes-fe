import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { LanguageAndThemeSection } from './LanguageAndThemeSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@/i18n', () => ({
  default: {
    options: { supportedLngs: ['en', 'cs', 'cimode'] },
    resolvedLanguage: 'en',
    changeLanguage: vi.fn(),
  },
}));

beforeEach(() => {
  vi.mocked(i18n.changeLanguage).mockClear();
});

describe('LanguageAndThemeSection', () => {
  it('shows the active language by its own name', () => {
    render(<LanguageAndThemeSection />);

    expect(screen.getByRole('combobox', { name: 'settings.locale.label' })).toHaveTextContent(
      'English'
    );
  });

  it('offers every shipped locale, named in itself and never the debug pseudo-locale', async () => {
    const user = userEvent.setup();
    render(<LanguageAndThemeSection />);

    await user.click(screen.getByRole('combobox', { name: 'settings.locale.label' }));

    expect(await screen.findByRole('option', { name: /English/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Čeština/ })).toBeInTheDocument();
    // 'cimode' is i18next's debug pseudo-locale. It is in supportedLngs and is
    // not a language anyone can be offered.
    expect(screen.queryByRole('option', { name: /cimode/ })).not.toBeInTheDocument();
  });

  it('switches the language on selection', async () => {
    const user = userEvent.setup();
    render(<LanguageAndThemeSection />);

    await user.click(screen.getByRole('combobox', { name: 'settings.locale.label' }));
    await user.click(await screen.findByRole('option', { name: /Čeština/ }));

    expect(i18n.changeLanguage).toHaveBeenCalledWith('cs');
  });
});
