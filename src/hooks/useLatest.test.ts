import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useLatest } from './useLatest.ts';

describe('useLatest', () => {
  it('returns one getter for the life of the component, answering with the latest value', () => {
    const { result, rerender } = renderHook(({ value }) => useLatest(value), {
      initialProps: { value: 1 },
    });
    const getter = result.current;
    expect(getter()).toBe(1);

    rerender({ value: 2 });
    expect(result.current).toBe(getter);
    expect(getter()).toBe(2);
  });
});
