import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExcalidrawScene } from './scene';

// Shared mutable scene state the mocked canvas reads/writes, so a "draw" click is
// visible both to onChange (dirty flag) and to the excalidrawAPI ref (Save read).
const mockState = vi.hoisted(() => ({ elements: [] as unknown[] }));

// Mock the heavy canvas: expose an excalidrawAPI and a "draw" button that adds an
// element and fires onChange. `mockState.elements` backs getSceneElements.
vi.mock('@excalidraw/excalidraw', () => ({
  Excalidraw: ({
    excalidrawAPI,
    onChange,
  }: {
    excalidrawAPI?: (api: unknown) => void;
    onChange?: (els: unknown[], app: unknown, files: unknown) => void;
  }) => {
    excalidrawAPI?.({
      getSceneElements: () => mockState.elements,
      getAppState: () => ({ viewBackgroundColor: '#fff' }),
      getFiles: () => ({}),
    });
    return (
      <button
        type="button"
        data-testid="draw"
        onClick={() => {
          mockState.elements = [{ id: 'e1' }];
          onChange?.(mockState.elements, {}, {});
        }}
      >
        canvas
      </button>
    );
  },
}));

import { ExcalidrawDialog } from './ExcalidrawDialog';

const t = (k: string) => k;

function setup(overrides: Partial<Parameters<typeof ExcalidrawDialog>[0]> = {}) {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const onDelete = vi.fn();
  const props = {
    open: true,
    mode: 'new' as const,
    initialScene: { elements: [], appState: {}, files: {} } as ExcalidrawScene,
    onSave,
    onClose,
    onDelete,
    t,
    ...overrides,
  };
  render(<ExcalidrawDialog {...props} />);
  return { onSave, onClose, onDelete };
}

beforeEach(() => {
  mockState.elements = [];
});

describe('ExcalidrawDialog', () => {
  it('disables Save when the scene is empty', () => {
    setup();
    expect(screen.getByRole('button', { name: 'editor.excalidraw.save' })).toBeDisabled();
  });

  it('enables Save after a draw and emits the scene to onSave', async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByTestId('draw'));
    const save = screen.getByRole('button', { name: 'editor.excalidraw.save' });
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ elements: [{ id: 'e1' }] }));
  });

  it('shows the discard-confirm when cancelling a dirty scene; confirm closes, keep-editing does not', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByTestId('draw')); // make dirty
    await userEvent.click(screen.getByRole('button', { name: 'editor.excalidraw.cancel' }));
    expect(await screen.findByText('editor.excalidraw.discardTitle')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'editor.excalidraw.discardCancel' }));
    expect(onClose).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'editor.excalidraw.cancel' }));
    await userEvent.click(screen.getByRole('button', { name: 'editor.excalidraw.discardConfirm' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes silently (no discard-confirm) when the scene is not dirty', async () => {
    const { onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'editor.excalidraw.cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('editor.excalidraw.discardTitle')).not.toBeInTheDocument();
  });

  it('renders Delete in edit mode (calls onDelete) and none in new mode', async () => {
    const { onDelete } = setup({
      mode: 'edit',
      initialScene: { elements: [{ id: 'x' }], appState: {}, files: {} },
    });
    await userEvent.click(screen.getByRole('button', { name: 'editor.excalidraw.deleteModal' }));
    // confirm-guarded
    await userEvent.click(
      screen.getAllByRole('button', { name: 'editor.excalidraw.deleteModal' }).at(-1) as HTMLElement
    );
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('does not render Delete in new mode', () => {
    setup({ mode: 'new' });
    expect(
      screen.queryByRole('button', { name: 'editor.excalidraw.deleteModal' })
    ).not.toBeInTheDocument();
  });

  it('does not close on Escape (no accidental dismiss)', async () => {
    const { onClose } = setup();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).not.toHaveBeenCalled());
  });
});
