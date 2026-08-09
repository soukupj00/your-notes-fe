import { afterEach, describe, expect, it, vi } from 'vitest';
import { waitFor } from './waitFor.ts';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Puts something in the document a beat from now, the way the app would. */
function soon(work: () => void, ms = 10) {
  setTimeout(work, ms);
}

describe('waitFor', () => {
  it('answers straight away when the condition already holds', async () => {
    // The common case, and the reason the check comes before the deadline: most
    // acts are already finished by the time the next step asks.
    const frame = vi.spyOn(globalThis, 'requestAnimationFrame');

    await expect(waitFor(() => 'here')).resolves.toBe('here');

    expect(frame).not.toHaveBeenCalled();
    frame.mockRestore();
  });

  it('resolves with the value the condition produced, not merely true', async () => {
    // What every caller here wants is the element, so returning it saves the
    // caller asking the DOM the same question twice.
    const element = document.createElement('div');
    soon(() => document.body.append(element));

    await expect(waitFor(() => document.querySelector('div'))).resolves.toBe(element);
  });

  it('keeps looking across frames until the DOM catches up', async () => {
    let ready = false;
    soon(() => {
      ready = true;
    }, 40);

    await expect(waitFor(() => ready)).resolves.toBe(true);
  });

  it('gives up with null rather than hanging', async () => {
    // A step whose target never arrives still has copy worth reading; null is
    // what lets the Tour show it centred instead of dying halfway through.
    await expect(waitFor(() => null, 30)).resolves.toBeNull();
  });

  it('still looks once when there is no budget at all', async () => {
    await expect(waitFor(() => 'here', 0)).resolves.toBe('here');
    await expect(waitFor(() => null, 0)).resolves.toBeNull();
  });

  it('treats every falsy answer as "not yet", including zero and empty string', async () => {
    // Both are real DOM answers - a zero-width rect, a blank attribute - and
    // both mean the app has not finished.
    await expect(waitFor(() => 0, 20)).resolves.toBeNull();
    await expect(waitFor(() => '', 20)).resolves.toBeNull();
  });
});
