import type { Editor as TiptapEditor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Blockquote } from '@/components/editor/extensions/Blockquote';
import { Bold } from '@/components/editor/extensions/Bold';
import { BulletList } from '@/components/editor/extensions/BulletList';
import { Clear } from '@/components/editor/extensions/Clear';
import { Heading } from '@/components/editor/extensions/Heading';
import { Italic } from '@/components/editor/extensions/Italic';
import { ListItem } from '@/components/editor/extensions/ListItem';
import { createMathematics } from '@/components/editor/extensions/Mathematics';
import { OrderedList } from '@/components/editor/extensions/OrderedList';
import { Strike } from '@/components/editor/extensions/Strike';
import { TaskList } from '@/components/editor/extensions/TaskList';
import { TextColorPickerButton } from '@/components/editor/extensions/text-color/TextColorPickerButton.tsx';
import { Underline } from '@/components/editor/extensions/Underline';
import BlocksSection from '@/components/editor/menus/toolbars/BlocksSection.tsx';
import FormatSection from '@/components/editor/menus/toolbars/FormatSection.tsx';
import HeadingSection from '@/components/editor/menus/toolbars/HeadingSection.tsx';
import ListSection from '@/components/editor/menus/toolbars/ListSection.tsx';
import { Separator } from '@/components/ui/separator.tsx';

type EditorProps = {
  content?: string;
  editable?: boolean;
  onUpdate?: (content: string) => void;
};

export const Editor: React.FC<EditorProps> = ({ content, editable, onUpdate }) => {
  const { t } = useTranslation();
  // Math node onClick handlers need the live editor, which does not exist yet when
  // the extensions array is built; a ref lets those closures reach it at click time.
  const editorRef = useRef<TiptapEditor | null>(null);
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Strike,
      Underline,
      Heading,
      Blockquote,
      BulletList,
      OrderedList,
      ListItem,
      TaskList,
      TaskItem,
      Clear,
      createMathematics(() => editorRef.current, t),
      Color,
      TextStyle,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
    shouldRerenderOnTransaction: true,
    immediatelyRender: true,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content ?? '');
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative rounded-xl border p-4">
      {/* Floating toolbar */}
      {editable && (
        <div className="flex flex-wrap items-center gap-1">
          <HeadingSection editor={editor} />
          <Separator orientation="vertical" className="mx-1" style={{ height: '1.5rem' }} />
          <FormatSection editor={editor} />
          <TextColorPickerButton editor={editor} />
          <Separator orientation="vertical" className="mx-1" style={{ height: '1.5rem' }} />
          <ListSection editor={editor} />
          <Separator orientation="vertical" className="mx-1" style={{ height: '1.5rem' }} />
          <BlocksSection editor={editor} />
        </div>
      )}

      {/* Editable area */}
      <EditorContent
        editor={editor}
        className="prose prose-sm min-h-[150px] max-w-none focus:outline-none"
      />
    </div>
  );
};
