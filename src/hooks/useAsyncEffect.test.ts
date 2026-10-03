import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAsyncEffect } from './useAsyncEffect.ts';

/** A promise the test settles by hand, so an answer can land after the deps moved on. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useAsyncEffect', () => {
  it('runs the effect alive, again when the deps change, and not when they stay', () => {
    const seen: [number, boolean][] = [];
    const { rerender } = renderHook(
      ({ id }) =>
        useAsyncEffect(
          (alive) => {
            seen.push([id, alive()]);
          },
          [id]
        ),
      { initialProps: { id: 1 } }
    );

    rerender({ id: 2 });
    // same deps, so no new run
    rerender({ id: 2 });

    expect(seen).toEqual([
      [1, true],
      [2, true],
    ]);
  });

  it('tells a run its answer is stale once the deps changed, and only that run', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const answers: [string, boolean][] = [];
    const { rerender } = renderHook(
      ({ job }: { job: Promise<string> }) =>
        useAsyncEffect(
          async (alive) => {
            answers.push([await job, alive()]);
          },
          [job]
        ),
      { initialProps: { job: first.promise } }
    );

    rerender({ job: second.promise });
    first.resolve('old');
    second.resolve('new');

    await vi.waitFor(() => expect(answers).toHaveLength(2));
    expect(answers).toEqual([
      ['old', false],
      ['new', true],
    ]);
  });

  it('tells a run its answer is stale after unmount', () => {
    let alive: (() => boolean) | undefined;
    const { unmount } = renderHook(() =>
      useAsyncEffect((guard) => {
        alive = guard;
      }, [])
    );

    expect(alive?.()).toBe(true);
    unmount();
    expect(alive?.()).toBe(false);
  });
});
