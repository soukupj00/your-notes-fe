import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setViewport } from '@/test/viewport.ts';

// jsdom trusts no event, so the trust check is taken as passed; `isHardwareKey`'s own table
// covers it.
vi.mock('@/lib/hardware-key.ts', async (importOriginal) => {
  const { isHardwareKey } = await importOriginal<typeof import('@/lib/hardware-key.ts')>();
  return { isHardwareKey: (event: KeyboardEvent) => isHardwareKey(event, true) };
});

// The seen key is module state for the session, so every test starts a fresh session.
async function load() {
  vi.resetModules();
  return (await import('./useKeyboardAffordances.ts')).useKeyboardAffordances;
}

beforeEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('useKeyboardAffordances', () => {
  it('is off on a coarse pointer until a hardware key, then stays on', async () => {
    setViewport(1024, { finePointer: false });
    const { result } = renderHook(await load());
    expect(result.current).toBe(false);

    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    });
    expect(result.current).toBe(true);
  });

  it('is not armed by typing into a field', async () => {
    setViewport(1024, { finePointer: false });
    const { result } = renderHook(await load());
    const input = document.body.appendChild(document.createElement('input'));

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    });
    expect(result.current).toBe(false);
    input.remove();
  });

  it('keeps a key seen across a reload of the same tab', async () => {
    setViewport(1024, { finePointer: false });
    renderHook(await load());
    act(() => {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    });

    const { result } = renderHook(await load());
    expect(result.current).toBe(true);
  });

  it('is on for a fine pointer with no key pressed', async () => {
    setViewport(1024, { finePointer: true });
    const { result } = renderHook(await load());
    expect(result.current).toBe(true);
  });
});
