import { act, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useViewMode, ViewModeProvider } from './viewModeProvider.tsx';

const STORAGE_KEY = 'notes-view-mode';

afterEach(() => {
  localStorage.clear();
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ViewModeProvider>{children}</ViewModeProvider>
);

describe('ViewModeProvider', () => {
  it('defaults to masonry when nothing is persisted', () => {
    const { result } = renderHook(() => useViewMode(), { wrapper });
    expect(result.current.viewMode).toBe('masonry');
  });

  it('reads the persisted mode on init', () => {
    localStorage.setItem(STORAGE_KEY, 'list');
    const { result } = renderHook(() => useViewMode(), { wrapper });
    expect(result.current.viewMode).toBe('list');
  });

  it('persists the mode to localStorage when set', () => {
    const { result } = renderHook(() => useViewMode(), { wrapper });

    act(() => result.current.setViewMode('list'));

    expect(result.current.viewMode).toBe('list');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('list');
  });

  it('shares state across consumers under one provider', () => {
    function Toggle() {
      const { viewMode, setViewMode } = useViewMode();
      return (
        <button type="button" onClick={() => setViewMode('list')}>
          {viewMode}
        </button>
      );
    }
    function Reader() {
      const { viewMode } = useViewMode();
      return <output>{viewMode}</output>;
    }

    render(
      <ViewModeProvider>
        <Toggle />
        <Reader />
      </ViewModeProvider>
    );

    expect(screen.getByRole('button')).toHaveTextContent('masonry');
    expect(screen.getByRole('status')).toHaveTextContent('masonry');

    act(() => screen.getByRole('button').click());

    // Both the toggle and the sibling reader see the same shared value.
    expect(screen.getByRole('button')).toHaveTextContent('list');
    expect(screen.getByRole('status')).toHaveTextContent('list');
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useViewMode())).toThrow(/ViewModeProvider/);
  });
});
