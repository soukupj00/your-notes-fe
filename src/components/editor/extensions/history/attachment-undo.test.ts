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

/**
 * Deleting an attachment node is an ordinary document edit, so undo has to bring
 * it back. That only holds because the attachment *row* is not deleted with the
 * node - orphan collection is deferred to save (see `collectOrphans`). If GC
 * ever moves back to delete-time, undo would restore a node pointing at bytes
 * that no longer exist, and these tests are what should fail.
 */
function createEditor() {
  return new Editor({
    extensions: [Document, Paragraph, Text, createAudio(() => deps), History],
    content: '<p></p>',
  });
}

/**
 * Close the current history group.
 *
 * ProseMirror groups edits made within `newGroupDelay` (500ms) into one undo
 * step, and a test does everything in the same tick - so without this, inserting
 * and deleting collapse into a single step and undo would appear to work for the
 * wrong reason. In the app the two are always seconds apart.
 */
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
