import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaInstallProvider } from '@/context/PwaInstallProvider.tsx';
import { PwaInstallSection } from './PwaInstallSection.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

class InstallPromptEvent extends Event {
  prompt = vi.fn().mockResolvedValue(undefined);
  userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: 'test' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PwaInstallSection', () => {
  it('offers installation when the browser makes it available and invokes its prompt', async () => {
    render(
      <PwaInstallProvider>
        <PwaInstallSection />
      </PwaInstallProvider>
    );

    expect(screen.queryByRole('button', { name: 'pwa.install.action' })).not.toBeInTheDocument();

    const installPrompt = new InstallPromptEvent('beforeinstallprompt');
    await act(() => window.dispatchEvent(installPrompt));

    await userEvent.click(await screen.findByRole('button', { name: 'pwa.install.action' }));

    expect(installPrompt.prompt).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'pwa.install.action' })).not.toBeInTheDocument()
    );
  });

  it('stays hidden when the app is already running standalone', async () => {
    // Stubbed, not spied: the setup's `matchMedia` is already a mock, which a restore leaves
    // answering "standalone" for the next test.
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query === '(display-mode: standalone)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }) as unknown as MediaQueryList
    );

    render(
      <PwaInstallProvider>
        <PwaInstallSection />
      </PwaInstallProvider>
    );

    await act(() => window.dispatchEvent(new InstallPromptEvent('beforeinstallprompt')));

    expect(screen.queryByRole('button', { name: 'pwa.install.action' })).not.toBeInTheDocument();
  });
});
