import type { Editor as TiptapEditor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { resolveShortcuts, type ShortcutBindings } from '@/lib/shortcuts.ts';
import { createAudio } from './Audio/Audio';
import type { AttachmentDeps } from './attachments/deps';
import { createBodyHint } from './BodyHint/BodyHint';
import type { TFunction } from './button-types';
import { Clear } from './Clear/Clear';
import { Color } from './Color/Color';
import { ColorPreview } from './color-preview';
import { createExcalidraw } from './Excalidraw/Excalidraw';
import { createFile } from './File/File';
import { FontFamily } from './FontFamily/FontFamily';
import { FontSize } from './FontSize/FontSize';
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
import { Heading } from './Heading/Heading';
import { Highlight } from './Highlight/Highlight';
import { History } from './history/History';
import { createImage } from './Image/Image';
import { Link } from './Link/Link';
import { ListItem } from './ListItem/ListItem';
import { createMathematics } from './Mathematics/Mathematics';
import { createShortcuts } from './Shortcuts/Shortcuts';
import { createSlashMenu } from './SlashMenu/SlashMenu';
import { TaskItem } from './TaskItem/TaskItem';
import { ChecklistFlip } from './TaskList/ChecklistFlip';
import { TaskList } from './TaskList/TaskList';
import { TextAlign } from './TextAlign/TextAlign';
import { TextPrompt } from './TextPrompt/textPrompt';
import { Typography } from './Typography/Typography';
import { createVideo } from './Video/Video';

interface BuildOptions {
  /** Live attachment dependencies, read through a getter because the nodes are
   *  built once but the deps change every render. */
  getDeps: () => AttachmentDeps;
  /** The live editor, which does not exist yet while this array is built. */
  getEditor: () => TiptapEditor | null;
  /** Read live, like `getDeps`. Optional, so a headless test gets no animation. */
  animateChecklist?: () => boolean;
  /** Read live, like `getDeps`. Optional, so a headless test gets the defaults. */
  getShortcuts?: () => ShortcutBindings;
  t: TFunction;
}

/** Lives outside `editor.tsx` so the toolbar registry is tested against the real mounted
 *  set: an id naming an unregistered extension is a button that silently never appears. */
export function buildEditorExtensions({
  getDeps,
  getEditor,
  animateChecklist,
  getShortcuts = () => resolveShortcuts({}),
  t,
}: BuildOptions) {
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
    Link,
    Typography,
    // Registered for its buttons too: a phone has no Ctrl+Z, so they are its only undo.
    History,
    createSlashMenu(getDeps, t),
    createBodyHint(t),
    createMathematics(getEditor, t),
    createShortcuts(getShortcuts, t),
    TextPrompt,
    Color,
    Highlight,
    FontFamily,
    FontSize,
    TextStyle,
    ColorPreview,
  ];
}
