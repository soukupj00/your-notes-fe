import { afterEach, describe, expect, it } from 'vitest';
import { holdBodyInert } from './inert.ts';

/**
 * `inert` alone stops a user half-driving the app under the scrim, so its whole contract is pinned:
 * everything marked, the exemption held, latecomers caught, nothing already inert handed back.
 */

const releases: (() => void)[] = [];

function hold(exempt: (node: Element) => boolean = () => false) {
  const release = holdBodyInert(exempt);
  releases.push(release);
  return release;
}

function add(tag = 'div', mark?: (node: HTMLElement) => void) {
  const node = document.createElement(tag);
  mark?.(node);
  document.body.append(node);
  return node;
}

/** The observer fires on a microtask, so a new child is marked one tick later. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => {
  for (const release of releases.splice(0)) release();
  document.body.innerHTML = '';
});

describe('holdBodyInert', () => {
  it('marks every child of body', () => {
    const app = add();
    const toaster = add();

    hold();

    expect(app.hasAttribute('inert')).toBe(true);
    expect(toaster.hasAttribute('inert')).toBe(true);
  });

  it('leaves the exempt ones alone', () => {
    const app = add();
    const spotlight = add('div', (node) => node.classList.add('driver-popover'));

    hold((node) => node.classList.contains('driver-popover'));

    expect(app.hasAttribute('inert')).toBe(true);
    expect(spotlight.hasAttribute('inert')).toBe(false);
  });

  it('marks children that arrive later, which is most of them', async () => {
    // Radix popovers, dialogs and toasts portal to `body` after the Tour has
    // started; marking once would miss all of them.
    hold();

    const dialog = add();
    await settle();

    expect(dialog.hasAttribute('inert')).toBe(true);
  });

  it('exempts latecomers too', async () => {
    // The spotlight's own elements are among them: driver builds its overlay and
    // popover on the first highlight, which is after the Tour has taken hold.
    hold((node) => node.classList.contains('driver-overlay'));

    const overlay = add('div', (node) => node.classList.add('driver-overlay'));
    await settle();

    expect(overlay.hasAttribute('inert')).toBe(false);
  });

  it('gives back exactly what it took', async () => {
    const app = add();
    // Already inert for a reason of the app's own, which the release must not
    // undo - handing back interactivity nobody asked for is the worse failure.
    const hidden = add('div', (node) => node.setAttribute('inert', ''));

    const release = hold();
    const late = add();
    await settle();
    release();

    expect(app.hasAttribute('inert')).toBe(false);
    expect(late.hasAttribute('inert')).toBe(false);
    expect(hidden.hasAttribute('inert')).toBe(true);
  });

  it('stops watching once released', async () => {
    hold()();

    const late = add();
    await settle();

    expect(late.hasAttribute('inert')).toBe(false);
  });
});
