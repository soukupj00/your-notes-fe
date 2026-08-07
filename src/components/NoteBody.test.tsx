import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NoteBody } from './NoteBody.tsx';

describe('NoteBody', () => {
  it('renders plain HTML while removing unsafe pasted attributes', () => {
    const { container } = render(
      <NoteBody html='<p>just text</p><img src="x" onerror="alert(1)">' />
    );
    expect(screen.getByText('just text')).toBeInTheDocument();
    expect(container.querySelector('img')).not.toHaveAttribute('onerror');
  });

  it('keeps the custom drawing element rather than sanitizing it away', () => {
    const { container } = render(
      <NoteBody html='<excalidraw-drawing data-attachment-id="draw-1"></excalidraw-drawing>' />
    );
    expect(container.querySelector('excalidraw-drawing')).toBeInTheDocument();
  });

  // The masonry wall measures a card the moment it mounts, so a body that
  // arrived one effect later would be measured empty and grow afterwards.
  it('has its markup in the DOM on the first render, not after an effect', () => {
    const { container } = render(<NoteBody html="<p>measured immediately</p>" />);
    expect(container.querySelector('p')?.textContent).toBe('measured immediately');
  });

  it('renders nothing for an empty or missing body', () => {
    const { container } = render(<NoteBody html={null} />);
    expect(container.firstElementChild?.innerHTML).toBe('');
  });
});
