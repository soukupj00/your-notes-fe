import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAction } from './useAction.ts';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useAction', () => {
  it('toasts the success key once the act resolves, and says it finished', async () => {
    const { result } = renderHook(() => useAction());
    let finished: boolean | undefined;

    await act(async () => {
      finished = await result.current.run(async () => {}, { success: 'done' });
    });

    expect(finished).toBe(true);
    expect(toast.success).toHaveBeenCalledWith('done');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('says nothing when the act backed out with false', async () => {
    const { result } = renderHook(() => useAction());

    await act(async () => {
      await result.current.run(async () => false, { success: 'done' });
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('toasts the generic failure by default, and the key picked from the error when given one', async () => {
    const { result } = renderHook(() => useAction());
    const boom = new Error('boom');
    let finished: boolean | undefined;

    await act(async () => {
      finished = await result.current.run(async () => {
        throw boom;
      });
    });

    expect(finished).toBe(false);
    expect(toast.error).toHaveBeenCalledWith('account.errors.unknown');

    const failure = vi.fn(() => 'picked');
    await act(async () => {
      await result.current.run(
        async () => {
          throw boom;
        },
        { failure }
      );
    });

    expect(failure).toHaveBeenCalledWith(boom);
    expect(toast.error).toHaveBeenLastCalledWith('picked');
  });

  it('is busy while the act runs and idle after', async () => {
    const { result } = renderHook(() => useAction());
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let running!: Promise<boolean>;

    act(() => {
      running = result.current.run(() => gate);
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      release();
      await running;
    });
    expect(result.current.busy).toBe(false);
  });
});
