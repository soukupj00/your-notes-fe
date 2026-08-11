import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setViewport } from '@/test/viewport.ts';
import { useWidthClass } from './useWidthClass';

describe('useWidthClass', () => {
  it('is compact on a narrow window', () => {
    setViewport(360);
    expect(renderHook(() => useWidthClass()).result.current).toBe('compact');
  });

  it('is wide on a desktop window', () => {
    setViewport(1024);
    expect(renderHook(() => useWidthClass()).result.current).toBe('wide');
  });

  it('is compact on a phone held sideways, which is wide but has no mouse', () => {
    // 844x390. Wide enough for the desktop nav (ADR 0016 keeps that), but the
    // Wide Layout wraps, and four rows of bar on a 390px-tall screen with the
    // keyboard up is the geometry the Compact Layout exists for.
    setViewport(844, { finePointer: false });
    expect(renderHook(() => useWidthClass()).result.current).toBe('compact');
  });

  it('stays wide on a touchscreen laptop, which reports a mouse as its primary pointer', () => {
    setViewport(1280, { finePointer: true });
    expect(renderHook(() => useWidthClass()).result.current).toBe('wide');
  });
});
