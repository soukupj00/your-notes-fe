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
    await expect(waitFor(() => null, { timeout: 30 })).resolves.toBeNull();
  });

  it('still looks once when there is no budget at all', async () => {
    await expect(waitFor(() => 'here', { timeout: 0 })).resolves.toBe('here');
    await expect(waitFor(() => null, { timeout: 0 })).resolves.toBeNull();
  });

  it('treats every falsy answer as "not yet", including zero and empty string', async () => {
    // Both are real DOM answers - a zero-width rect, a blank attribute - and
    // both mean the app has not finished.
    await expect(waitFor(() => 0, { timeout: 20 })).resolves.toBeNull();
    await expect(waitFor(() => '', { timeout: 20 })).resolves.toBeNull();
  });

  it('says what it gave up on, so a spent budget is not a silent slow step', async () => {
    // The budget is only ever spent when something is genuinely wrong, and the
    // one time it was, the sole symptom was three seconds of apparent sloth.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await waitFor(() => null, { timeout: 10, label: 'the editor toolbar' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('the editor toolbar'));
    warn.mockRestore();
  });

  it('says nothing when the condition holds', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await waitFor(() => 'here', { label: 'something that is already there' });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
