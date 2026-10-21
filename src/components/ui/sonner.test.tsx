import { act, fireEvent, render, screen } from '@testing-library/react';
import { toast } from 'sonner';
import { describe, expect, it } from 'vitest';
import { Toaster } from './sonner.tsx';

describe('Toaster', () => {
  // Sonner's Alt+T is Option+T on a Mac, which types a character there.
  it.each([
    ['Alt+T', { altKey: true, code: 'KeyT', key: '†' }],
    ['a plain key', { code: 'KeyA', key: 'a' }],
  ])('leaves focus where it is on %s', async (_name, keys) => {
    render(<Toaster />);
    act(() => void toast('Saved'));
    await screen.findByText('Saved');

    fireEvent.keyDown(document, keys);

    expect(document.activeElement).toBe(document.body);
  });
});
