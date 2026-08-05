import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, describe, expect, it } from 'vitest';
import { CheckedSink } from './CheckedSink';
import { TaskList } from './TaskList';

let enabled = true;

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
  enabled = true;
});

/**
 * `[label, checked]` for every task item in the document, in document order.
 * The label is the item's own first line, not `textContent` - a parent item in a
 * nested list would otherwise report its children's text as part of its own.
 */
function items(editor: Editor): [string, boolean][] {
  const found: [string, boolean][] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'taskItem') {
      found.push([node.firstChild?.textContent ?? '', node.attrs.checked === true]);
    }
  });
  return found;
}

/** `data-type` is not decoration: TipTap only parses `li[data-type="taskItem"]`. */
function row(label: string, checked: boolean, nested = '') {
  return `<li data-type="taskItem" data-checked="${checked}"><p>${label}</p>${nested}</li>`;
}

function list(...entries: [string, boolean][]) {
  return `<ul data-type="taskList">${entries.map(([label, checked]) => row(label, checked)).join('')}</ul>`;
}

function createEditor(content: string) {
  const editor = new Editor({
    extensions: [
      Document,
      Paragraph,
      Text,
      TaskList,
      TaskItem,
      CheckedSink.configure({ enabled: () => enabled }),
    ],
    content,
  });
  editors.push(editor);
  return editor;
}

/** Flip one item's checkbox the way the task item's own control does. */
function setChecked(editor: Editor, label: string, checked: boolean) {
  let target = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'taskItem' && node.textContent === label) target = pos;
  });
  if (target < 0) throw new Error(`no task item labelled ${label}`);
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(target, undefined, {
      ...editor.state.doc.nodeAt(target)?.attrs,
      checked,
    })
  );
}

describe('CheckedSink', () => {
  it('sinks an item to the bottom of its list when it is checked', () => {
    const editor = createEditor(
      list(['Milk', false], ['Bread', false], ['Eggs', false], ['Jam', false])
    );

    setChecked(editor, 'Bread', true);

    expect(items(editor)).toEqual([
      ['Milk', false],
      ['Eggs', false],
      ['Jam', false],
      ['Bread', true],
    ]);
  });

  it('stacks a newly checked item below the ones already checked', () => {
    const editor = createEditor(list(['Milk', false], ['Bread', false], ['Eggs', true]));

    setChecked(editor, 'Milk', true);

    expect(items(editor)).toEqual([
      ['Bread', false],
      ['Eggs', true],
      ['Milk', true],
    ]);
  });

  // The other half of the promise: a mistaken tap has to be undoable by tapping
  // again, and that means coming back out of the checked block, not sitting in it.
  it('floats an unchecked item back above the checked block', () => {
    const editor = createEditor(
      list(['Milk', false], ['Bread', true], ['Eggs', true], ['Jam', true])
    );

    setChecked(editor, 'Eggs', false);

    expect(items(editor)).toEqual([
      ['Milk', false],
      ['Eggs', false],
      ['Bread', true],
      ['Jam', true],
    ]);
  });

  it('leaves an item alone when it is already where it belongs', () => {
    const editor = createEditor(list(['Milk', false], ['Bread', false]));

    setChecked(editor, 'Bread', true);

    expect(items(editor)).toEqual([
      ['Milk', false],
      ['Bread', true],
    ]);
  });

  it('does nothing at all while the preference is off', () => {
    enabled = false;
    const editor = createEditor(list(['Milk', false], ['Bread', false], ['Eggs', false]));

    setChecked(editor, 'Milk', true);

    expect(items(editor)).toEqual([
      ['Milk', true],
      ['Bread', false],
      ['Eggs', false],
    ]);
  });

  // "Its own list" is the promise, and a sub-list is its own list: an item that
  // sank to the bottom of the whole note would leave its parent behind.
  it('sinks within the nested list an item belongs to, not the outer one', () => {
    const sublist = `<ul data-type="taskList">${row('Passport', false)}${row('Tickets', false)}</ul>`;
    const editor = createEditor(
      `<ul data-type="taskList">${row('Trip', false, sublist)}${row('Groceries', false)}</ul>`
    );

    setChecked(editor, 'Passport', true);

    // Passport moves below Tickets and stops there - it does not fall past
    // "Trip" into the outer list, where it would lose the group it belongs to.
    expect(items(editor)).toEqual([
      ['Trip', false],
      ['Tickets', false],
      ['Passport', true],
      ['Groceries', false],
    ]);
  });

  it('does not reorder anything when the edit was ordinary typing', () => {
    const editor = createEditor(list(['Milk', false], ['Bread', true], ['Eggs', false]));

    // End of "Milk": taskList opens at 0, the item at 1, its paragraph at 2, so
    // the text runs 3..7.
    editor.commands.setTextSelection(7);
    editor.commands.insertContent('!');

    expect(items(editor).map(([label]) => label)).toEqual(['Milk!', 'Bread', 'Eggs']);
  });

  // The cursor is a place in the note, not a place in the document tree: an item
  // that moves under the caret must take the caret with it.
  it('carries the selection along with the item it moved', () => {
    const editor = createEditor(list(['Milk', false], ['Bread', false], ['Eggs', false]));

    // Caret inside "Milk", which is about to travel to the bottom.
    editor.commands.setTextSelection(4);
    setChecked(editor, 'Milk', true);

    const { $from } = editor.state.selection;
    expect($from.parent.textContent).toBe('Milk');
  });
});
