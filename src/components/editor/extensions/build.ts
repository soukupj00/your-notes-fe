import type { Editor as TiptapEditor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { Typography } from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extensions';
import { createAudio } from './Audio';
import type { AttachmentDeps } from './attachments/deps';
import { Blockquote } from './Blockquote';
import { Bold } from './Bold';
import { BulletList } from './BulletList';
import type { TFunction } from './button-types';
import { Clear } from './Clear';
import { Code } from './Code';
import { CodeBlock } from './CodeBlock';
import { Color } from './Color';
import { ColorPreview } from './color-preview';
import { createExcalidraw } from './Excalidraw';
import { createFile } from './File';
import { FontFamily } from './FontFamily';
import { FontSize } from './FontSize';
import { Heading } from './Heading';
import { Highlight } from './Highlight';
import { HorizontalRule } from './HorizontalRule';
import { History } from './history';
import { createImage } from './Image';
import { Italic } from './Italic';
import { createLink } from './Link';
import { ListItem } from './ListItem';
import { createMathematics } from './Mathematics';
import { OrderedList } from './OrderedList';
import { createSlashMenu } from './SlashMenu';
import { Strike } from './Strike';
import { TaskList } from './TaskList';
import { TextAlign } from './TextAlign';
import { Underline } from './Underline';
import { createVideo } from './Video';

interface BuildOptions {
  /** Live attachment dependencies, read through a getter because the nodes are
   *  built once but the deps change every render. */
  getDeps: () => AttachmentDeps;
  /** The live editor, which does not exist yet while this array is built. */
  getEditor: () => TiptapEditor | null;
  t: TFunction;
}

/**
 * Every extension the note editor mounts, in one place.
 *
 * Extracted from `editor.tsx` so the toolbar registry can be tested against the
 * *real* mounted set: a registry id that names an extension nobody registers is a
 * button that silently never appears, which is exactly the class of bug the
 * `videoAttachment` omission was.
 */
export function buildEditorExtensions({ getDeps, getEditor, t }: BuildOptions) {
  return [
    Document,
    Paragraph,
    Text,
    Bold,
    Italic,
    Strike,
    Underline,
    Heading,
    Blockquote,
    createImage(getDeps),
    createAudio(getDeps),
    createVideo(getDeps),
    createFile(getDeps),
    createExcalidraw(getDeps),
    BulletList,
    OrderedList,
    ListItem,
    TaskList,
    TaskItem,
    Clear,
    Code,
    CodeBlock,
    HorizontalRule,
    TextAlign,
    createLink(t),
    Typography,
    // Undo/redo. Registered for its commands *and* its buttons: without it a
    // phone, which has no Ctrl+Z, has no way to undo at all.
    History,
    createSlashMenu(getDeps, t),
    // Only the body gets a placeholder - the title input has its own, and a
    // second prompt on every empty paragraph would be noise.
    Placeholder.configure({
      placeholder: ({ node }) => (node.type.name === 'paragraph' ? t('editor.placeholder') : ''),
      showOnlyWhenEditable: true,
    }),
    createMathematics(getEditor, t),
    Color,
    Highlight,
    FontFamily,
    FontSize,
    TextStyle,
    ColorPreview,
  ];
}
