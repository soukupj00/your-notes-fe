import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TaskList, type TaskListExtensionOptions } from './TaskList';

const t = (key: string) => key;

function getButtonProps(editor: Editor) {
  const ext = editor.extensionManager.extensions.find((e) => e.name === 'taskList');
  if (!ext) throw new Error('taskList not registered');
  return (ext.options as TaskListExtensionOptions).button({ editor, t }).componentProps;
}

describe('TaskList extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [Document, Paragraph, Text, TaskList, TaskItem],
      content: '<p>item</p>',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  it('toggleTaskList wraps content in a task list and marks taskList as active', () => {
    editor.commands.selectAll();
    editor.commands.toggleTaskList();

    expect(editor.isActive('taskList')).toBe(true);
    expect(editor.getHTML()).toContain('data-type="taskList"');
  });

  it('button props have correct icon, tooltip and no shortcutKeys', () => {
    const props = getButtonProps(editor);
    expect(props.icon).toBe('ListTodo');
    expect(props.tooltip).toBe('editor.taskList.tooltip');
    expect(props.shortcutKeys).toBeUndefined();
  });
});
