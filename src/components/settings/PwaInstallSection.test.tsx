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
    expect(screen.queryByRole('link', { name: 'pwa.install.guide' })).not.toBeInTheDocument();
  });

  it.each([
    [
      'ios',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      5,
    ],
    [
      'ios',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1',
      5,
    ],
    [
      'ios',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      5,
    ],
    [
      'macosSafari',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      0,
    ],
    ['firefoxAndroid', 'Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0', 5],
    [
      'other',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
      0,
    ],
    ['other', 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0', 0],
  ])(
    'shows the %s steps and the guide link without a prompt (%#)',
    (variant, userAgent, maxTouchPoints) => {
      vi.stubGlobal('navigator', { userAgent, maxTouchPoints });

      render(
        <PwaInstallProvider>
          <PwaInstallSection />
        </PwaInstallProvider>
      );

      expect(screen.getByText(`pwa.install.manual.${variant}`)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'pwa.install.guide' })).toHaveAttribute(
        'href',
        'pwa.install.guideUrl'
      );
    }
  );
});
