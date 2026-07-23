import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { Attachment } from '@/models.ts';
import { useExcalidrawScene } from './useExcalidrawScene';

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

function Probe({ get }: { get: (i: string) => Promise<Attachment | undefined> }) {
  const s = useExcalidrawScene('a1', get);
  return (
    <div data-testid="s">
      {s.status === 'ready' ? `ready:${s.scene.elements.length}` : s.status}
    </div>
  );
}

describe('useExcalidrawScene', () => {
  it('resolves a stored scene', async () => {
    render(<Probe get={async () => att('{"elements":[{"id":"x"}],"appState":{},"files":{}}')} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('ready:1'));
  });

  it('reports missing when the row is absent', async () => {
    render(<Probe get={async () => undefined} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('missing'));
  });

  it('reports missing when the scene JSON is malformed', async () => {
    render(<Probe get={async () => att('{bad')} />);
    await waitFor(() => expect(screen.getByTestId('s').textContent).toBe('missing'));
  });
});
