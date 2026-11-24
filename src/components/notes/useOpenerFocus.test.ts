import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useOpenerFocus } from './useOpenerFocus.ts';

const opener = () => document.body.appendChild(document.createElement('button'));

afterEach(() => {
  document.body.replaceChildren();
});

describe('useOpenerFocus', () => {
  it('takes focus off the opener as the Note opens and hands it back on request', () => {
    const card = opener();
    card.focus();
    const { result, rerender } = renderHook(({ open }) => useOpenerFocus(open), {
      initialProps: { open: false },
    });
    expect(card).toHaveFocus();

    rerender({ open: true });
    expect(card).not.toHaveFocus();

    rerender({ open: false });
    result.current();
    expect(card).toHaveFocus();
  });

  // The loading fallback hands focus back as the editor replaces it, with the Note still open.
  it('hands focus back only once the Note has closed', () => {
    const card = opener();
    card.focus();
    const { result, rerender } = renderHook(({ open }) => useOpenerFocus(open), {
      initialProps: { open: true },
    });
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.dataset.slot = 'dialog-content';
    const title = dialog.appendChild(document.createElement('input'));
    title.focus();

    result.current();
    expect(title).toHaveFocus();

    rerender({ open: false });
    result.current();
    expect(card).toHaveFocus();
  });

  // A menu that opened the Note hands focus back to its trigger a task after it closes.
  it('holds focus off the page until the dialog takes it, and returns it to the trigger', () => {
    const { result, rerender } = renderHook(({ open }) => useOpenerFocus(open), {
      initialProps: { open: true },
    });
    const trigger = opener();
    trigger.focus();
    expect(trigger).not.toHaveFocus();

    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.dataset.slot = 'dialog-content';
    dialog.appendChild(document.createElement('input')).focus();
    const later = opener();
    later.focus();
    expect(later).toHaveFocus();

    rerender({ open: false });
    result.current();
    expect(trigger).toHaveFocus();
  });

  // Focus is inside the dialog by then, and that is not where a close should return it.
  it('keeps the first opener while the Note stays open', () => {
    const card = opener();
    card.focus();
    const { result, rerender } = renderHook(({ open }) => useOpenerFocus(open), {
      initialProps: { open: true },
    });
    const dialog = document.body.appendChild(document.createElement('div'));
    dialog.dataset.slot = 'dialog-content';
    dialog.appendChild(document.createElement('input')).focus();
    rerender({ open: true });

    rerender({ open: false });
    result.current();
    expect(card).toHaveFocus();
  });
});
