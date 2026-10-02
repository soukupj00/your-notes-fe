import type { Editor as TiptapEditor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { Typography } from '@tiptap/extension-typography';
import { Placeholder } from '@tiptap/extensions';
import { createAudio } from './Audio';
import type { AttachmentDeps } from './attachments/deps';
import type { TFunction } from './button-types';
import { Clear } from './Clear';
import { Color } from './Color';
import { ColorPreview } from './color-preview';
import { createExcalidraw } from './Excalidraw';
import { createFile } from './File';
import { FontFamily } from './FontFamily';
import { FontSize } from './FontSize';
import {
  Blockquote,
  Bold,
  BulletList,
  Code,
  CodeBlock,
  HorizontalRule,
  Italic,
  OrderedList,
  Strike,
  Underline,
} from './formatting';
import { Heading } from './Heading';
import { Highlight } from './Highlight';
import { History } from './history';
import { createImage } from './Image';
import { createLink } from './Link';
import { ListItem } from './ListItem';
import { createMathematics } from './Mathematics';
import { createSlashMenu } from './SlashMenu';
import { TaskItem } from './TaskItem';
import { ChecklistFlip, TaskList } from './TaskList';
import { TextAlign } from './TextAlign';
import { createVideo } from './Video';

interface BuildOptions {
  /** Live attachment dependencies, read through a getter because the nodes are
   *  built once but the deps change every render. */
  getDeps: () => AttachmentDeps;
  /** The live editor, which does not exist yet while this array is built. */
  getEditor: () => TiptapEditor | null;
  /** Read live, like `getDeps`. Optional, so a headless test gets no animation. */
  animateChecklist?: () => boolean;
  t: TFunction;
}

/** Lives outside `editor.tsx` so the toolbar registry is tested against the real mounted
 *  set: an id naming an unregistered extension is a button that silently never appears. */
export function buildEditorExtensions({ getDeps, getEditor, animateChecklist, t }: BuildOptions) {
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
    TaskItem.configure({ gripLabel: () => t('editor.taskItem.grip') }),
    ChecklistFlip.configure({ animate: animateChecklist ?? (() => false) }),
    Clear,
    Code,
    CodeBlock,
    HorizontalRule,
    TextAlign,
    createLink(t),
    Typography,
    // Registered for its buttons too: a phone has no Ctrl+Z, so they are its only undo.
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
