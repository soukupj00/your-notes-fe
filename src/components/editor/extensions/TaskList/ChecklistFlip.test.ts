import { Editor, Extension } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { afterEach, describe, expect, it } from 'vitest';
import { findToggledItem } from './ChecklistFlip';
import { TaskList } from './TaskList';

const editors: Editor[] = [];
afterEach(() => {
  for (const editor of editors.splice(0)) editor.destroy();
});

/** What `findToggledItem` reported, per round of transactions. */
type Report = { label: string; checked: boolean } | null;

/**
 * Drives a real editor and records what `findToggledItem` saw.
 *
 * The animation itself needs real layout and so belongs to a manual gate; the
 * detection is the half with the subtlety in it (documents compared rather than
 * steps read, old positions mapped forward) and is exercised here against real
 * ProseMirror states rather than hand-built ones.
 */
function probe() {
  const reports: Report[] = [];

  const Probe = Extension.create({
    name: 'findToggledItemProbe',
    addProseMirrorPlugins() {
      return [
        new Plugin({
          key: new PluginKey('findToggledItemProbe'),
          appendTransaction(transactions, oldState, newState) {
            if (!transactions.some((transaction) => transaction.docChanged)) return null;
            const toggled = findToggledItem(transactions, oldState, newState);
            reports.push(
              toggled
                ? {
                    label: newState.doc.nodeAt(toggled.pos)?.firstChild?.textContent ?? '',
                    checked: toggled.checked,
                  }
                : null
            );
            return null;
          },
        }),
      ];
    },
  });

  return { reports, Probe };
}

/** `data-type` is not decoration: TipTap only parses `li[data-type="taskItem"]`. */
function row(label: string, checked: boolean, nested = '') {
  return `<li data-type="taskItem" data-checked="${checked}"><p>${label}</p>${nested}</li>`;
}

function list(...entries: [string, boolean][]) {
  return `<ul data-type="taskList">${entries.map(([label, checked]) => row(label, checked)).join('')}</ul>`;
}

function createEditor(content: string) {
  const { reports, Probe } = probe();
  const editor = new Editor({
    extensions: [Document, Paragraph, Text, TaskList, TaskItem, Probe],
    content,
  });
  editors.push(editor);
  return { editor, reports };
}

function positionOf(editor: Editor, label: string) {
  let target = -1;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'taskItem' && node.firstChild?.textContent === label) target = pos;
  });
  if (target < 0) throw new Error(`no task item labelled ${label}`);
  return target;
}

/** Flip one item's checkbox the way the task item's own control does. */
function setChecked(editor: Editor, label: string, checked: boolean) {
  const target = positionOf(editor, label);
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(target, undefined, {
      ...editor.state.doc.nodeAt(target)?.attrs,
      checked,
    })
  );
}

describe('findToggledItem', () => {
  it('reports the item that was checked', () => {
    const { editor, reports } = createEditor(list(['Milk', false], ['Bread', false]));

    setChecked(editor, 'Bread', true);

    expect(reports).toEqual([{ label: 'Bread', checked: true }]);
  });

  it('reports the item that was unchecked, and which way it went', () => {
    const { editor, reports } = createEditor(list(['Milk', true], ['Bread', true]));

    setChecked(editor, 'Milk', false);

    expect(reports).toEqual([{ label: 'Milk', checked: false }]);
  });

  it('reports nothing for ordinary typing', () => {
    // The guard that stops every keystroke in a checklist from measuring the
    // whole list and playing an animation over it.
    const { editor, reports } = createEditor(list(['Milk', false], ['Bread', false]));

    editor.commands.setTextSelection(positionOf(editor, 'Milk') + 6);
    editor.commands.insertContent('!');

    expect(editor.state.doc.textContent).toContain('Milk!');
    expect(reports).toEqual([null]);
  });

  it('reports nothing when an item is added rather than toggled', () => {
    // A new item has no counterpart in the old document, and treating "appeared"
    // as "toggled" would animate a row that has nowhere to travel from.
    const { editor, reports } = createEditor(list(['Milk', false]));

    editor.commands.setTextSelection(positionOf(editor, 'Milk') + 6);
    editor.commands.splitListItem('taskItem');

    expect(reports).toEqual([null]);
  });

  it('still finds the toggle when an edit elsewhere shifts every position', () => {
    // Why old positions are mapped forward before the comparison: without it an
    // insertion above the toggled item makes every position disagree and the
    // toggle is either missed or attributed to the wrong row.
    const { editor, reports } = createEditor(list(['Milk', false], ['Bread', false]));
    const target = positionOf(editor, 'Bread');

    editor.view.dispatch(
      editor.state.tr
        .insertText('xx', positionOf(editor, 'Milk') + 2)
        .setNodeMarkup(target + 2, undefined, {
          ...editor.state.doc.nodeAt(target)?.attrs,
          checked: true,
        })
    );

    expect(reports).toEqual([{ label: 'Bread', checked: true }]);
  });

  it('finds a toggle inside a nested checklist', () => {
    const sublist = `<ul data-type="taskList">${row('Passport', false)}${row('Tickets', false)}</ul>`;
    const { editor, reports } = createEditor(
      `<ul data-type="taskList">${row('Trip', false, sublist)}${row('Groceries', false)}</ul>`
    );

    setChecked(editor, 'Passport', true);

    expect(reports).toEqual([{ label: 'Passport', checked: true }]);
  });

  it('does not reorder the document, because sinking is presentation now', () => {
    // The regression guard for ADR 0013: the old CheckedSink physically moved
    // the item, and the stored order is what a restore, an export and M5 sync
    // all carry. Ticking must leave it exactly as the user typed it.
    const { editor } = createEditor(list(['Milk', false], ['Bread', false], ['Eggs', false]));

    setChecked(editor, 'Milk', true);

    const labels: string[] = [];
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'taskItem') labels.push(node.firstChild?.textContent ?? '');
    });
    expect(labels).toEqual(['Milk', 'Bread', 'Eggs']);
  });
});
