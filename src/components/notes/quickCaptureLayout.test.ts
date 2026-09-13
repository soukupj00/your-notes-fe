import { describe, expect, it } from 'vitest';
import { QUICK_CAPTURE_ACTIONS } from './quickCaptureActions.ts';
import {
  type QuickCapturePref,
  reconcileQuickCapture,
  resolveDesktopQuickCapture,
  resolveQuickCapture,
} from './quickCaptureLayout.ts';

const keys = (entries: { id: string }[]) => entries.map((entry) => entry.id);
const ALL = QUICK_CAPTURE_ACTIONS.map((action) => action.key);

describe('reconcileQuickCapture', () => {
  it('offers every start when nothing is stored', () => {
    // The field has never been written, so an empty array is "never customised"
    // rather than "the user turned everything off".
    expect(keys(reconcileQuickCapture(undefined))).toEqual(ALL);
    expect(keys(reconcileQuickCapture([]))).toEqual(ALL);
    expect(reconcileQuickCapture([]).every((entry) => entry.on)).toBe(true);
  });

  it('appends a start the stored list predates, at its shipped position', () => {
    const stored: QuickCapturePref[] = [
      { id: 'picture', on: true },
      { id: 'text', on: false },
    ];

    const reconciled = keys(reconcileQuickCapture(stored));
    expect(new Set(reconciled)).toEqual(new Set(ALL));
    // The user's own order is never rewritten: they put `picture` before `text`.
    expect(reconciled.indexOf('picture')).toBeLessThan(reconciled.indexOf('text'));
    // A start they have never seen lands next to the shipped sibling that
    // follows it, rather than at the end where new work goes unnoticed.
    expect(reconciled.indexOf('checklist')).toBeLessThan(reconciled.indexOf('picture'));
    expect(reconciled.indexOf('audio')).toBeLessThan(reconciled.indexOf('drawing'));
  });

  it('keeps a stored start this build no longer ships', () => {
    const stored: QuickCapturePref[] = [
      { id: 'telepathy', on: true },
      ...ALL.map((id) => ({ id, on: true })),
    ];
    expect(keys(reconcileQuickCapture(stored))).toContain('telepathy');
  });
});

describe('resolveQuickCapture', () => {
  it('draws the starts that are on, in the user’s order', () => {
    const stored: QuickCapturePref[] = [
      { id: 'audio', on: true },
      { id: 'text', on: false },
      { id: 'checklist', on: true },
      { id: 'drawing', on: false },
      { id: 'picture', on: false },
      { id: 'camera', on: false },
    ];

    expect(resolveQuickCapture(stored).map((action) => action.key)).toEqual(['audio', 'checklist']);
  });

  it('draws nothing for a start it cannot resolve', () => {
    const stored: QuickCapturePref[] = [
      { id: 'telepathy', on: true },
      ...ALL.map((id) => ({ id, on: false })),
    ];
    expect(resolveQuickCapture(stored)).toEqual([]);
  });

  it('derives the desktop row by dropping plain text, never a second list', () => {
    // The desktop bar's own text field is that start, so offering it twice
    // would be the drift the derivation exists to prevent.
    expect(resolveDesktopQuickCapture(undefined).map((action) => action.key)).toEqual(
      ALL.filter((key) => key !== 'text')
    );
  });
});
