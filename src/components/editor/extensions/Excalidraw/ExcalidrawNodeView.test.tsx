import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Attachment } from '@/models.ts';

// Mock the heavy canvas: render a button that invokes onChange with one element.
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({
    onChange,
  }: {
    onChange?: (els: unknown[], app: unknown, files: unknown) => void;
  }) => (
    <button type="button" data-testid="canvas" onClick={() => onChange?.([{ id: 'e1' }], {}, {})}>
      canvas
    </button>
  ),
  exportToSvg: vi.fn(async () => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    el.setAttribute('id', 'snap');
    return el;
  }),
}));

import { ExcalidrawNodeView } from './ExcalidrawNodeView';

function att(body: string): Attachment {
  const now = new Date().toISOString();
  return {
    id: 'a1',
    noteId: 'n1',
    kind: 'excalidraw',
    mime: 'application/json',
    blob: new Blob([body], { type: 'application/json' }),
    createdAt: now,
    updatedAt: now,
  };
}
function props(
  get: (i: string) => Promise<Attachment | undefined>,
  updateAttachment = vi.fn(async () => {})
) {
  return {
    node: { attrs: { attachmentId: 'a1' } },
    editor: { isEditable: true },
    deleteNode: vi.fn(),
    extension: {
      options: { getDeps: () => ({ getAttachment: get, updateAttachment, t: (k: string) => k }) },
    },
  } as unknown as Parameters<typeof ExcalidrawNodeView>[0];
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('ExcalidrawNodeView', () => {
  it('mounts the canvas for a ready scene', async () => {
    render(
      <ExcalidrawNodeView {...props(async () => att('{"elements":[],"appState":{},"files":{}}'))} />
    );
    await vi.waitFor(() => expect(screen.getByTestId('canvas')).toBeInTheDocument());
  });

  it('writes the edited scene back (blob + preview) on change, debounced', async () => {
    const update = vi.fn(async () => {});
    render(
      <ExcalidrawNodeView
        {...props(async () => att('{"elements":[],"appState":{},"files":{}}'), update)}
      />
    );
    await vi.waitFor(() => expect(screen.getByTestId('canvas')).toBeInTheDocument());
    screen.getByTestId('canvas').click();
    await vi.advanceTimersByTimeAsync(1000);
    await vi.waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ preview: expect.stringContaining('snap') })
      )
    );
  });

  it('shows the unavailable box when the row is missing', async () => {
    render(<ExcalidrawNodeView {...props(async () => undefined)} />);
    await vi.waitFor(() =>
      expect(screen.getByText('editor.excalidraw.unavailable')).toBeInTheDocument()
    );
  });
});
