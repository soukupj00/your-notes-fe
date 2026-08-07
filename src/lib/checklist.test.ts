import { describe, expect, it } from 'vitest';
import { setChecklistItemChecked } from './checklist.ts';

const item = (label: string, checked = false) =>
  `<li data-type="taskItem" data-checked="${checked}">` +
  `<label><input type="checkbox"${checked ? ' checked' : ''}><span></span></label>` +
  `<div><p>${label}</p></div></li>`;

const list = (...items: string[]) => `<ul data-type="taskList">${items.join('')}</ul>`;

/** `[label, checked]` per item, read back the way the card would paint it. */
function read(html: string): [string, boolean, boolean][] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('li[data-type="taskItem"]')].map((li) => [
    li.querySelector('p')?.textContent ?? '',
    li.getAttribute('data-checked') === 'true',
    li.querySelector('input')?.hasAttribute('checked') ?? false,
  ]);
}

describe('setChecklistItemChecked', () => {
  it('writes both the attribute TipTap parses and the one the card paints', () => {
    // Two carriers of one fact, and both are needed: `data-checked` is what
    // TipTap reads back into the document, `checked` is what draws the tick on
    // a card. Write one and the two surfaces disagree.
    const next = setChecklistItemChecked(list(item('Milk'), item('Bread')), 0, true);

    expect(next).not.toBeNull();
    expect(read(next as string)).toEqual([
      ['Milk', true, true],
      ['Bread', false, false],
    ]);
  });

  it('clears both when unchecking', () => {
    const next = setChecklistItemChecked(list(item('Milk', true)), 0, false);

    expect(read(next as string)).toEqual([['Milk', false, false]]);
  });

  it('returns null when the item is already in that state', () => {
    // The stale guard. A second tap, or the live-query echo arriving late, must
    // not write the same value again and bump `updatedAt` for nothing.
    expect(setChecklistItemChecked(list(item('Milk', true)), 0, true)).toBeNull();
    expect(setChecklistItemChecked(list(item('Milk')), 0, false)).toBeNull();
  });

  it('returns null for an index that is not there', () => {
    expect(setChecklistItemChecked(list(item('Milk')), 5, true)).toBeNull();
    expect(setChecklistItemChecked(list(item('Milk')), -1, true)).toBeNull();
  });

  it('returns null for a body with no checklist at all', () => {
    expect(setChecklistItemChecked('<p>just prose</p>', 0, true)).toBeNull();
  });

  it('counts nested items in document order', () => {
    const nested =
      '<ul data-type="taskList">' +
      '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label>' +
      '<div><p>Trip</p></div>' +
      list(item('Passport'), item('Tickets')) +
      '</li>' +
      item('Groceries') +
      '</ul>';

    // Document order is Trip, Passport, Tickets, Groceries - so index 2 is
    // Tickets, inside the sub-list.
    const next = setChecklistItemChecked(nested, 2, true);

    expect(read(next as string)).toEqual([
      ['Trip', false, false],
      ['Passport', false, false],
      ['Tickets', true, true],
      ['Groceries', false, false],
    ]);
  });

  it('is not shifted by an attachment the card strips before rendering', () => {
    // The card renders `stripAttachmentNodes(body)` but writes back to the whole
    // body, so the two must agree on what index 1 means. They do because
    // stripping only ever removes media nodes, never an `li`.
    const body =
      '<img data-attachment-id="a1">' + list(item('Milk'), item('Bread')) + '<p>tail</p>';

    const next = setChecklistItemChecked(body, 1, true);

    expect(read(next as string)).toEqual([
      ['Milk', false, false],
      ['Bread', true, true],
    ]);
  });

  it('leaves the rest of the body alone', () => {
    const body = `<h2>Shopping</h2>${list(item('Milk'))}<p>after</p>`;

    const next = setChecklistItemChecked(body, 0, true) as string;

    expect(next).toContain('<h2>Shopping</h2>');
    expect(next).toContain('<p>after</p>');
  });

  it('survives a round trip through itself', () => {
    // The card compares its optimistic string against the one the live query
    // echoes back, so the function has to be deterministic on its own output.
    const once = setChecklistItemChecked(list(item('Milk'), item('Bread')), 0, true) as string;
    const back = setChecklistItemChecked(once, 0, false) as string;
    const again = setChecklistItemChecked(back, 0, true) as string;

    expect(again).toBe(once);
  });
});
