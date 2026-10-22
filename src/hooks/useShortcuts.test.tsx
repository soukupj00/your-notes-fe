import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PREFERENCES_STORAGE_KEY, PreferencesProvider } from '@/context/PreferencesProvider.tsx';
import { useShortcuts } from './useShortcuts.ts';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <PreferencesProvider>{children}</PreferencesProvider>
);

const stored = () => JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) ?? '{}').shortcuts;

afterEach(() => {
  localStorage.clear();
});

describe('useShortcuts', () => {
  it('serves the defaults when nothing is stored', () => {
    const { result } = renderHook(() => useShortcuts(), { wrapper });

    expect(result.current.bindings.bold).toBe('Mod-b');
    expect(result.current.bindings['new-note']).toBe('n');
  });

  it('moves a combination and clears its old owner in one write', () => {
    const { result } = renderHook(() => useShortcuts(), { wrapper });

    act(() => result.current.assign('bold', 'Mod-Shift-b', 'blockquote'));

    expect(stored()).toEqual({ bold: 'Mod-Shift-b', blockquote: null });
    expect(result.current.bindings.bold).toBe('Mod-Shift-b');
    expect(result.current.bindings.blockquote).toBeNull();
  });

  it('resets one Shortcut, and all of them', () => {
    const { result } = renderHook(() => useShortcuts(), { wrapper });
    act(() => result.current.assign('italic', null));
    act(() => result.current.assign('bold', 'Mod-Alt-b'));

    act(() => result.current.reset('italic'));
    expect(result.current.stored).toEqual({ bold: 'Mod-Alt-b' });

    act(() => result.current.resetAll());
    expect(result.current.stored).toEqual({});
    expect(stored()).toEqual({});
  });
});
