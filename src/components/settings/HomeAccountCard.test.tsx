import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Session } from '@/data/Remote.ts';
import { HomeAccountCard } from './HomeAccountCard.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: React.ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

const SESSION: Session = {
  accountId: 'a1',
  username: 'ada',
  role: 'member',
  deviceId: 'd1',
  deviceName: 'Laptop',
};

describe('HomeAccountCard', () => {
  it('shows the initial, the username and the role, and opens the Account page', () => {
    render(<HomeAccountCard session={SESSION} />);

    const card = screen.getByRole('link', { name: /ada/ });
    expect(card).toHaveAttribute('href', '/settings/account');
    expect(card).toHaveTextContent('A');
    expect(card).toHaveTextContent('account.section.member');
  });
});
