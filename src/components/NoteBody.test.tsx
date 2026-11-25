import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { taskListMarkup } from '@/lib/body.ts';
import { NoteBody } from './NoteBody.tsx';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

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

  // The stored markup wraps only the box and an empty span in its `<label>`.
  it('names each checklist box by its item, and an empty item by a stand-in', () => {
    render(
      <NoteBody
        html={taskListMarkup([
          ['Eggs', false],
          ['', true],
        ])}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Eggs' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'editor.taskItem.empty' })).toBeChecked();
  });

  // The Editor names the same rows the same way (`taskItemName`).
  it('names a row of several paragraphs with spaces between, and a row of spaces as empty', () => {
    render(
      <NoteBody
        html={
          '<ul data-type="taskList">' +
          '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Buy milk</p><p>and eggs</p></div></li>' +
          '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>  </p></div></li>' +
          '</ul>'
        }
      />
    );

    expect(screen.getByRole('checkbox', { name: 'Buy milk and eggs' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'editor.taskItem.empty' })).toBeInTheDocument();
  });

  it('renders nothing for an empty or missing body', () => {
    const { container } = render(<NoteBody html={null} />);
    expect(container.firstElementChild?.innerHTML).toBe('');
  });
});
