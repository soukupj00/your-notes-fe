import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { ATTACHMENT_KINDS } from '@/models.ts';
import { ATTACHMENT_SPECS } from './attachments.ts';
import {
  bodyHasAttachment,
  checklistBox,
  closestChecklistItem,
  extractAttachmentIds,
  extractBodyAttachments,
  isChecklistItemChecked,
  repointAttachment,
  setChecklistItemChecked,
  stripAttachmentNodes,
  TASK_ITEM,
  taskListMarkup,
} from './body.ts';

describe('attachments in the Body', () => {
  describe('bodyHasAttachment', () => {
    it('is true when the HTML contains an img with data-attachment-id', () => {
      expect(bodyHasAttachment('<p>hi</p><img data-attachment-id="abc">')).toBe(true);
    });

    it('is false for plain text or an img without the marker', () => {
      expect(bodyHasAttachment('<p>hi</p>')).toBe(false);
      expect(bodyHasAttachment('<img src="x.png">')).toBe(false);
      expect(bodyHasAttachment('')).toBe(false);
      expect(bodyHasAttachment(undefined)).toBe(false);
    });

    it('does not leak lastIndex state across repeated calls', () => {
      const html = '<img data-attachment-id="abc">';
      expect(bodyHasAttachment(html)).toBe(true);
      expect(bodyHasAttachment(html)).toBe(true);
      expect(bodyHasAttachment(html)).toBe(true);
    });

    it('extractAttachmentIds is unaffected by a prior bodyHasAttachment call', () => {
      expect(bodyHasAttachment('<img data-attachment-id="abc">')).toBe(true);
      expect(
        extractAttachmentIds(
          '<img data-attachment-id="first"><img data-attachment-id="second">'
        ).sort()
      ).toEqual(['first', 'second']);
    });
  });

  describe('extractAttachmentIds', () => {
    it('collects every data-attachment-id, de-duplicated', () => {
      const html =
        '<img data-attachment-id="a"><p>x</p><img data-attachment-id="b"><img data-attachment-id="a">';
      expect(extractAttachmentIds(html).sort()).toEqual(['a', 'b']);
    });

    it('returns [] for empty / nullish input', () => {
      expect(extractAttachmentIds('')).toEqual([]);
      expect(extractAttachmentIds(null)).toEqual([]);
    });
  });

  describe('extractBodyAttachments', () => {
    it('returns nothing for an empty or attachment-free body', () => {
      expect(extractBodyAttachments(undefined)).toEqual([]);
      expect(extractBodyAttachments('<p>just words</p>')).toEqual([]);
    });

    it('maps each serialized node form to its stored kind', () => {
      const html =
        '<img data-attachment-id="i1">' +
        '<video data-attachment-id="v1" controls></video>' +
        '<audio data-attachment-id="au1" controls></audio>' +
        '<a data-attachment-id="f1" href="#">report.pdf</a>' +
        '<excalidraw-drawing data-attachment-id="d1"></excalidraw-drawing>';

      expect(extractBodyAttachments(html)).toEqual([
        { id: 'i1', kind: 'image' },
        { id: 'v1', kind: 'video' },
        { id: 'au1', kind: 'audio' },
        { id: 'f1', kind: 'file' },
        { id: 'd1', kind: 'excalidraw' },
      ]);
    });

    it('preserves document order, which is what the summary groups from', () => {
      const html =
        '<a data-attachment-id="f1">x</a><img data-attachment-id="i1"><img data-attachment-id="i2">';

      expect(extractBodyAttachments(html).map((a) => a.id)).toEqual(['f1', 'i1', 'i2']);
    });

    it('deduplicates a repeated id so one attachment counts once', () => {
      const html = '<img data-attachment-id="i1"><img data-attachment-id="i1">';

      expect(extractBodyAttachments(html)).toEqual([{ id: 'i1', kind: 'image' }]);
    });

    it('skips a tag it has no kind for rather than guessing', () => {
      expect(extractBodyAttachments('<iframe data-attachment-id="x1"></iframe>')).toEqual([]);
    });

    it('reads the id regardless of attribute order', () => {
      expect(extractBodyAttachments('<img alt="a" data-attachment-id="i1" width="2">')).toEqual([
        { id: 'i1', kind: 'image' },
      ]);
    });
  });
});

describe('stripAttachmentNodes', () => {
  it('leaves prose untouched', () => {
    expect(stripAttachmentNodes('<p>hello</p>')).toBe('<p>hello</p>');
  });

  it('removes void and paired attachment nodes with their content', () => {
    const html =
      '<img data-attachment-id="i1"><p>hello</p>' +
      '<audio data-attachment-id="au1"></audio>' +
      '<a data-attachment-id="f1" href="#">report.pdf</a>' +
      '<excalidraw-drawing data-attachment-id="d1"></excalidraw-drawing>';

    expect(stripAttachmentNodes(html)).toBe('<p>hello</p>');
  });

  it('keeps a plain link, which is not an attachment', () => {
    const html = '<p>see <a href="https://example.com">this</a></p>';

    expect(stripAttachmentNodes(html)).toBe(html);
  });

  it('removes several nodes of the same tag without swallowing what is between them', () => {
    const html =
      '<audio data-attachment-id="a1"></audio><p>mid</p><audio data-attachment-id="a2"></audio>';

    expect(stripAttachmentNodes(html)).toBe('<p>mid</p>');
  });
});

describe('the vocabulary follows the kind table', () => {
  it('reads every tag the editor writes back to its kind', () => {
    const html = ATTACHMENT_KINDS.map((kind) => {
      const { tag } = ATTACHMENT_SPECS[kind];
      return tag === 'img'
        ? `<img data-attachment-id="${kind}">`
        : `<${tag} data-attachment-id="${kind}"></${tag}>`;
    }).join('');
    expect(extractBodyAttachments(html)).toEqual(
      ATTACHMENT_KINDS.map((kind) => ({ id: kind, kind }))
    );
    expect(stripAttachmentNodes(html)).toBe('');
  });
});

describe('repointAttachment', () => {
  it('moves every reference from one id to another and leaves the rest alone, prefixes included', () => {
    const html =
      '<p>x</p><img data-attachment-id="a"><video data-attachment-id="a"></video><img data-attachment-id="b"><img data-attachment-id="ab">';
    expect(repointAttachment(html, 'a', 'c')).toBe(
      '<p>x</p><img data-attachment-id="c"><video data-attachment-id="c"></video><img data-attachment-id="b"><img data-attachment-id="ab">'
    );
  });
});

describe('checklist', () => {
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
      const body = `<img data-attachment-id="a1">${list(item('Milk'), item('Bread'))}<p>tail</p>`;

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
});

describe('taskListMarkup', () => {
  it('writes what TipTap writes, so a draft round-trips unchanged and opens with its items', () => {
    const html = taskListMarkup([
      ['Milk', true],
      ['', false],
    ]);
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, TaskList, TaskItem],
      content: html,
    });
    expect(editor.getHTML()).toBe(html);
    expect(editor.state.doc.content.firstChild?.childCount).toBe(2);
    editor.destroy();
  });

  it('is what the card helpers read, for an unchecked and a checked row', () => {
    const markup = taskListMarkup([
      ['Eggs', false],
      ['Milk', true],
    ]);
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    const [eggs, milk] = Array.from(doc.querySelectorAll(TASK_ITEM));
    expect(closestChecklistItem(eggs.querySelector('p') as Element)).toBe(eggs);
    expect(isChecklistItemChecked(eggs)).toBe(false);
    expect(checklistBox(eggs)?.checked).toBe(false);
    expect(isChecklistItemChecked(milk)).toBe(true);
    expect(checklistBox(milk)?.checked).toBe(true);
  });
});
