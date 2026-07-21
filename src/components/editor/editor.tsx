import type { Editor as TiptapEditor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Blockquote } from '@/components/editor/extensions/Blockquote';
import { Bold } from '@/components/editor/extensions/Bold';
import { BulletList } from '@/components/editor/extensions/BulletList';
import { Clear } from '@/components/editor/extensions/Clear';
import { Color } from '@/components/editor/extensions/Color';
import { ColorPreview } from '@/components/editor/extensions/color-preview';
import { FontFamily } from '@/components/editor/extensions/FontFamily';
import { FontSize } from '@/components/editor/extensions/FontSize';
import { Heading } from '@/components/editor/extensions/Heading';
import { Highlight } from '@/components/editor/extensions/Highlight';
import { createImage } from '@/components/editor/extensions/Image';
import { dedupeForeignImages, insertImageFiles } from '@/components/editor/extensions/Image/insert';
import { Italic } from '@/components/editor/extensions/Italic';
import { ListItem } from '@/components/editor/extensions/ListItem';
import { createMathematics } from '@/components/editor/extensions/Mathematics';
import { OrderedList } from '@/components/editor/extensions/OrderedList';
import { Strike } from '@/components/editor/extensions/Strike';
import { TaskList } from '@/components/editor/extensions/TaskList';
import { Underline } from '@/components/editor/extensions/Underline';
import BlocksSection from '@/components/editor/menus/toolbars/BlocksSection.tsx';
import FontSection from '@/components/editor/menus/toolbars/FontSection.tsx';
import FormatSection from '@/components/editor/menus/toolbars/FormatSection.tsx';
import HeadingSection from '@/components/editor/menus/toolbars/HeadingSection.tsx';
import ListSection from '@/components/editor/menus/toolbars/ListSection.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import { cn } from '@/lib/utils.ts';

type EditorProps = {
  content?: string;
  editable?: boolean;
  onUpdate?: (content: string) => void;
  /** Focus the editor body on mount (cursor at end). */
  autoFocus?: boolean;
  /**
   * On mobile, pin the toolbar to the bottom of the scroll container so it rides
   * above the virtual keyboard (see the sheet's `interactive-widget` viewport
   * meta). Desktop keeps the toolbar on top.
   */
  stickyToolbarOnMobile?: boolean;
  /** Extra classes for the editor root (e.g. `flex-1` inside a full-screen sheet). */
  className?: string;
  /** Resolves the owning note id for image inserts (creating a draft note if needed). */
  getNoteId?: () => Promise<string>;
};

/** Imperative handle so a parent (e.g. a dialog) can drop the cursor into the body. */
export type EditorHandle = { focus: () => void };

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { content, editable, onUpdate, autoFocus, stickyToolbarOnMobile, className, getNoteId },
  ref
) {
  const { t } = useTranslation();
  // Math node onClick handlers need the live editor, which does not exist yet when
  // the extensions array is built; a ref lets those closures reach it at click time.
  const editorRef = useRef<TiptapEditor | null>(null);

  const { createAttachment, getAttachment, cloneAttachment } = useAttachmentActions();
  const imageDeps = useMemo(
    () => ({
      getNoteId:
        getNoteId ??
        (async () => {
          throw new Error('getNoteId not provided');
        }),
      createAttachment,
      getAttachment,
      cloneAttachment,
      onError: (code: AttachmentErrorCode) => toast(t(`editor.image.errors.${code}`)),
      t,
    }),
    [getNoteId, createAttachment, getAttachment, cloneAttachment, t]
  );

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
      createImage(imageDeps),
      BulletList,
      OrderedList,
      ListItem,
      TaskList,
      TaskItem,
      Clear,
      createMathematics(() => editorRef.current, t),
      Color,
      Highlight,
      FontFamily,
      FontSize,
      TextStyle,
      ColorPreview,
    ],
    content,
    editable,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
    editorProps: {
      handlePaste: (_view, event) => {
        const files = event.clipboardData?.files;
        const ed = editorRef.current;
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
          void insertImageFiles(ed, files, imageDeps);
          return true;
        }
        // Cross-note HTML paste with existing attachment nodes: let the default
        // paste happen, then reclaim any foreign images into owned clones.
        const html = event.clipboardData?.getData('text/html');
        if (ed && html?.includes('data-attachment-id')) {
          queueMicrotask(() => void dedupeForeignImages(ed, imageDeps));
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        const ed = editorRef.current;
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
          void insertImageFiles(ed, files, imageDeps);
          return true;
        }
        return false;
      },
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

  useImperativeHandle(ref, () => ({ focus: () => editor?.commands.focus('end') }), [editor]);

  if (!editor) {
    return null;
  }

  // Clicking the empty area below the text (not on the text itself or a control)
  // drops the cursor at the end, so the whole content region feels editable.
  const focusOnEmptyClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('.tiptap') || target.closest('button, input, [role="button"], a, select')) {
      return;
    }
    e.preventDefault();
    editor.commands.focus('end');
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: click just forwards focus into the editor; keyboard users already reach it via Tab.
    <div
      className={cn('relative flex flex-col rounded-xl border p-4', className)}
      onMouseDown={editable ? focusOnEmptyClick : undefined}
    >
      {/* Toolbar. Desktop: on top (DOM order). Mobile + stickyToolbarOnMobile:
          ordered last and pinned to the bottom of the scroll container (no
          border; the editor is padding-free on mobile, so no margin cancelling). */}
      {editable && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1',
            stickyToolbarOnMobile &&
              'sticky bottom-0 z-10 order-last bg-background py-2 sm:static sm:order-none sm:py-0'
          )}
        >
          <HeadingSection editor={editor} />
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-[orientation=vertical]:h-6 sm:block"
          />
          <FormatSection editor={editor} />
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-[orientation=vertical]:h-6 sm:block"
          />
          <ListSection editor={editor} />
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-[orientation=vertical]:h-6 sm:block"
          />
          <BlocksSection editor={editor} />
          <Separator
            orientation="vertical"
            className="mx-1 hidden data-[orientation=vertical]:h-6 sm:block"
          />
          <FontSection editor={editor} />
        </div>
      )}

      {/* Editable area. `flex-1` lets it fill a full-screen sheet so a
          sticky-bottom toolbar sits at the screen edge even with little text;
          `cursor-text` makes the empty space read as editable. */}
      <EditorContent
        editor={editor}
        className="prose prose-sm min-h-[150px] max-w-none flex-1 cursor-text focus:outline-none"
      />
    </div>
  );
});
