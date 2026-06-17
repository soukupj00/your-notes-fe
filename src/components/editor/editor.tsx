import Bold from '@tiptap/extension-bold';
import Document from '@tiptap/extension-document';
import Italic from '@tiptap/extension-italic';
import { BulletList, ListItem, OrderedList } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Strike from '@tiptap/extension-strike';
import Text from '@tiptap/extension-text';
import { Color, TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import type React from 'react';
import { useEffect } from 'react';
import { TextColorPickerButton } from '@/components/editor/extensions/text-color/TextColorPickerButton.tsx';
import FormatSection from '@/components/editor/menus/toolbars/FormatSection.tsx';
import ListSection from '@/components/editor/menus/toolbars/ListSection.tsx';

type EditorProps = {
  content?: string;
  editable?: boolean;
  onUpdate?: (content: string) => void;
};

export const Editor: React.FC<EditorProps> = ({ content, editable, onUpdate }) => {
  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Strike,
      Underline,
      BulletList,
      OrderedList,
      ListItem,
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
      {editable && <FormatSection editor={editor} />}
      {editable && <TextColorPickerButton editor={editor} />}
      {editable && <ListSection editor={editor} />}

      {/* Editable area */}
      <EditorContent
        editor={editor}
        className="prose prose-sm min-h-[150px] max-w-none focus:outline-none"
      />
      {editable && <FormatSection editor={editor} />}
      {editable && <TextColorPickerButton editor={editor} />}
      {editable && <ListSection editor={editor} />}
    </div>
  );
};
