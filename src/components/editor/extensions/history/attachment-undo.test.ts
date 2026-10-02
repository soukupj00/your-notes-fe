import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { closeHistory } from '@tiptap/pm/history';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '../Audio/Audio';
import type { AttachmentDeps } from '../attachments/deps';
import { History } from './History';

const deps = { getAttachment: vi.fn(), t: (k: string) => k } as unknown as AttachmentDeps;

/** Undo can restore a deleted attachment node only because orphan rows are collected at save,
 *  not at delete (`collectOrphans`). If that ever moves to delete-time, these tests must fail. */
function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createAudio(() => deps), History],
    content: '<p></p>',
  });
}

/** ProseMirror groups edits within 500ms into one undo step, so without this a test's insert
 *  and delete collapse into one, and undo would pass for the wrong reason. */
function endUndoStep(editor: Editor) {
  editor.view.dispatch(closeHistory(editor.state.tr));
}

describe('undo/redo over attachment nodes', () => {
  let editor: Editor;
  beforeEach(() => {
    editor = createEditor();
  });
  afterEach(() => editor.destroy());

  it('restores a deleted attachment node, id intact', () => {
    editor.commands.insertAudioAttachment({ attachmentId: 'audio-1' });
    expect(editor.getHTML()).toContain('data-attachment-id="audio-1"');
    endUndoStep(editor);

    editor.commands.selectAll();
    editor.commands.deleteSelection();
    expect(editor.getHTML()).not.toContain('data-attachment-id');

    editor.commands.undo();
    expect(editor.getHTML()).toContain('data-attachment-id="audio-1"');
  });

  it('redo removes it again', () => {
    editor.commands.insertAudioAttachment({ attachmentId: 'audio-1' });
    endUndoStep(editor);
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    editor.commands.undo();

    editor.commands.redo();
    expect(editor.getHTML()).not.toContain('data-attachment-id');
  });

  it('undoes the insertion itself', () => {
    editor.commands.insertAudioAttachment({ attachmentId: 'audio-1' });
    editor.commands.undo();
    expect(editor.getHTML()).not.toContain('data-attachment-id');
  });
});
