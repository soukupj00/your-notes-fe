import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AttachmentDeleteButton } from './AttachmentDeleteButton';

const t = (key: string) => key;

describe('AttachmentDeleteButton', () => {
  it('renders a trigger with the given label as its accessible name', () => {
    render(<AttachmentDeleteButton onConfirm={vi.fn()} label="Delete video" t={t} />);
    expect(screen.getByRole('button', { name: 'Delete video' })).toBeInTheDocument();
  });

  it('opens the confirm dialog on trigger click', async () => {
    render(<AttachmentDeleteButton onConfirm={vi.fn()} label="Delete video" t={t} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete video' }));
    expect(await screen.findByText('attachments.confirmDelete.title')).toBeInTheDocument();
    expect(screen.getByText('attachments.confirmDelete.description')).toBeInTheDocument();
  });

  it('calls onConfirm once and closes when Remove is clicked', async () => {
    const onConfirm = vi.fn();
    render(<AttachmentDeleteButton onConfirm={onConfirm} label="Delete video" t={t} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete video' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.confirm' })
    );
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitForDialogGone();
  });

  it('does not call onConfirm when Cancel is clicked', async () => {
    const onConfirm = vi.fn();
    render(<AttachmentDeleteButton onConfirm={onConfirm} label="Delete video" t={t} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete video' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'attachments.confirmDelete.cancel' })
    );
    expect(onConfirm).not.toHaveBeenCalled();
    await waitForDialogGone();
  });
});

async function waitForDialogGone() {
  const { waitFor } = await import('@testing-library/react');
  await waitFor(() =>
    expect(screen.queryByText('attachments.confirmDelete.title')).not.toBeInTheDocument()
  );
}
