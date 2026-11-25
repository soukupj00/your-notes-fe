import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithStore as render } from '@/test/store.tsx';
import { NoteFeed } from './NoteFeed.tsx';

vi.mock('@/hooks/useReducedMotion.ts', () => ({
  useReducedMotion: () => true,
}));

describe('NoteFeed', () => {
  // WebKit drops the list role from an unstyled list outside `nav`, and with it VoiceOver's count.
  it('keeps an explicit list role', () => {
    render(<NoteFeed notes={[]} mode="stack" label="Notes" onSelect={vi.fn()} />);

    // By label: the feed is hidden until its layout is measured, which jsdom never does.
    expect(screen.getByLabelText('Notes')).toHaveAttribute('role', 'list');
  });
});
