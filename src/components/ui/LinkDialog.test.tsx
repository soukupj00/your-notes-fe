import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkDialog } from './LinkDialog.tsx';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const LINK = 'https://notes.example/share/abc';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('LinkDialog', () => {
  it('shows the link above its extras, copies it, and closes from Done', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const onOpenChange = vi.fn();
    render(
      <LinkDialog
        open
        onOpenChange={onOpenChange}
        title="Title"
        description="Why"
        link={LINK}
        actions={<button type="button">extra</button>}
      >
        <p>above</p>
      </LinkDialog>
    );

    expect(screen.getByRole('dialog')).toHaveTextContent(LINK);
    expect(screen.getByText('above')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'extra' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'account.qr.copy' }));
    expect(writeText).toHaveBeenCalledWith(LINK);
    expect(toast.success).toHaveBeenCalledWith('account.qr.copied');

    await user.click(screen.getByRole('button', { name: 'account.qr.done' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('waits visibly while the link is still being made, with Copy disabled', () => {
    render(<LinkDialog open onOpenChange={vi.fn()} title="Title" description="Why" link={null} />);

    expect(screen.getByText('account.qr.making')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'account.qr.copy' })).toBeDisabled();
  });
});
