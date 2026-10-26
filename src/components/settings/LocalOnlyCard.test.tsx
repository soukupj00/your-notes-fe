import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '@/context/AccountProvider.tsx';
import type { AccountService } from '@/data/Remote.ts';
import { withStore } from '@/test/store.tsx';
import { LocalOnlyCard } from './LocalOnlyCard.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));

const exportBackup = vi.hoisted(() => vi.fn(async () => 'saved'));
vi.mock('@/lib/export-backup.ts', () => ({ exportBackup }));

const SETUP_URL = 'settings.help.docs.setupUrl';

function mount(state: 'none' | 'setup-needed' | 'signed-out') {
  const service = { signIn: vi.fn() } as Partial<AccountService> as AccountService;
  return render(
    withStore(
      <AccountProvider service={service}>
        <LocalOnlyCard state={state} />
      </AccountProvider>
    )
  );
}

const signIn = () => screen.queryByRole('button', { name: 'account.section.signIn' });
const setupGuide = () => screen.queryByRole('link', { name: /settings\.home\.local\.setupGuide/ });

describe('LocalOnlyCard', () => {
  it.each(['none', 'setup-needed', 'signed-out'] as const)(
    'says the notes stay on this device, with no description, and never offers both Sign in and Setup guide (%s)',
    (state) => {
      mount(state);

      const title = screen.getByText('settings.home.local.title');
      expect(title.parentElement?.childElementCount).toBe(1);
      expect(signIn() && setupGuide()).toBeFalsy();
    }
  );

  it('with no server, links to the setup guide and backs up', async () => {
    mount('none');

    expect(
      screen.getByRole('link', { name: /settings\.home\.local\.syncWithServer/ })
    ).toHaveAttribute('href', SETUP_URL);
    await userEvent.click(screen.getByRole('button', { name: 'settings.home.local.backUp' }));
    expect(exportBackup).toHaveBeenCalledTimes(1);
    expect(signIn()).toBeNull();
    expect(setupGuide()).toBeNull();
  });

  it('on a server with no Owner, offers only the setup guide', () => {
    mount('setup-needed');

    expect(setupGuide()).toHaveAttribute('href', SETUP_URL);
    expect(setupGuide()).toHaveAttribute('target', '_blank');
    expect(signIn()).toBeNull();
    expect(screen.queryByRole('button', { name: 'settings.home.local.backUp' })).toBeNull();
  });

  it('on a server with an Owner, offers only Sign in, which opens the sign-in dialog', async () => {
    mount('signed-out');

    expect(setupGuide()).toBeNull();
    await userEvent.click(signIn() as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('account.section.signInDescription')).toBeVisible();
  });

  it.each([
    ['none', /settings\.home\.local\.syncWithServer/],
    ['setup-needed', /settings\.home\.local\.setupGuide/],
  ] as const)('says its link opens a new tab (%s)', (state, name) => {
    mount(state);

    const link = screen.getByRole('link', { name });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAccessibleName(expect.stringContaining('nav.newTab'));
  });
});
