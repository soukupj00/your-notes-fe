import type { Editor as TiptapEditor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import { TaskItem } from '@tiptap/extension-list';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { TextStyle } from '@tiptap/extension-text-style';
import { EditorContent, useEditor } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import type React from 'react';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { createAudio } from '@/components/editor/extensions/Audio';
import {
  dedupeForeignAttachments,
  insertAttachmentFiles,
} from '@/components/editor/extensions/attachments/insert';
import { Blockquote } from '@/components/editor/extensions/Blockquote';
import { Bold } from '@/components/editor/extensions/Bold';
import { BulletList } from '@/components/editor/extensions/BulletList';
import { Clear } from '@/components/editor/extensions/Clear';
import { Color } from '@/components/editor/extensions/Color';
import { ColorPreview } from '@/components/editor/extensions/color-preview';
import { createExcalidraw } from '@/components/editor/extensions/Excalidraw';
import { commitExcalidrawScene } from '@/components/editor/extensions/Excalidraw/commit';
import { ExcalidrawDialog } from '@/components/editor/extensions/Excalidraw/ExcalidrawDialog';
import {
  type ExcalidrawScene,
  emptyScene,
  parseScene,
} from '@/components/editor/extensions/Excalidraw/scene';
import { createFile } from '@/components/editor/extensions/File';
import { FontFamily } from '@/components/editor/extensions/FontFamily';
import { FontSize } from '@/components/editor/extensions/FontSize';
import { Heading } from '@/components/editor/extensions/Heading';
import { Highlight } from '@/components/editor/extensions/Highlight';
import { createImage } from '@/components/editor/extensions/Image';
import { Italic } from '@/components/editor/extensions/Italic';
import { ListItem } from '@/components/editor/extensions/ListItem';
import { createMathematics } from '@/components/editor/extensions/Mathematics';
import { OrderedList } from '@/components/editor/extensions/OrderedList';
import { Strike } from '@/components/editor/extensions/Strike';
import { TaskList } from '@/components/editor/extensions/TaskList';
import { Underline } from '@/components/editor/extensions/Underline';
import { createVideo } from '@/components/editor/extensions/Video';
import BlocksSection from '@/components/editor/menus/toolbars/BlocksSection.tsx';
import FontSection from '@/components/editor/menus/toolbars/FontSection.tsx';
import FormatSection from '@/components/editor/menus/toolbars/FormatSection.tsx';
import HeadingSection from '@/components/editor/menus/toolbars/HeadingSection.tsx';
import ListSection from '@/components/editor/menus/toolbars/ListSection.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import { cn } from '@/lib/utils.ts';

// Excalidraw resolves its bundled fonts/assets relative to this origin - pin it
// to the app root so it works the same under the PWA's service-worker scope.
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/';
}

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
  /** Best-effort: autoplay the first audioAttachment node once the editor is
   *  ready (set when the note was opened via its card's audio chip). */
  autoplayFirstAudio?: boolean;
};

/** Imperative handle so a parent (e.g. a dialog) can drop the cursor into the body,
 *  or (e.g. a test) reach the live TipTap editor instance. */
export type EditorHandle = { focus: () => void; getEditor: () => TiptapEditor | null };

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    content,
    editable,
    onUpdate,
    autoFocus,
    stickyToolbarOnMobile,
    className,
    getNoteId,
    autoplayFirstAudio,
  },
  ref
) {
  const { t } = useTranslation();
  // Math node onClick handlers need the live editor, which does not exist yet when
  // the extensions array is built; a ref lets those closures reach it at click time.
  const editorRef = useRef<TiptapEditor | null>(null);

  const { createAttachment, getAttachment, cloneAttachment, updateAttachment } =
    useAttachmentActions();

  // The single shared Excalidraw editing modal (the live canvas lives here, not
  // inline in the document). `attachmentId === null` is a new drawing (Save
  // creates); otherwise we edit that row. `onDelete` funnels the modal's Delete
  // and the preview's corner-X through the same node removal.
  const [excalidraw, setExcalidraw] = useState<{
    open: boolean;
    attachmentId: string | null;
    initialScene: ExcalidrawScene | null;
    onDelete?: () => void;
    // Bumped on every open so the dialog remounts (fresh dirty/empty state) even
    // when the same drawing - or another new one - is opened twice in a row.
    key: number;
  }>({ open: false, attachmentId: null, initialScene: null, key: 0 });
  const openSeqRef = useRef(0);

  const openExcalidraw = useCallback(
    (args: { attachmentId?: string; onDelete?: () => void }) => {
      const { attachmentId, onDelete } = args;
      const key = ++openSeqRef.current;
      if (!attachmentId) {
        setExcalidraw({
          open: true,
          attachmentId: null,
          initialScene: emptyScene(),
          onDelete,
          key,
        });
        return;
      }
      // One-shot read to seed the editor; the modal edits its own copy and
      // commits on Save. Fall back to an empty scene if the row is unreadable.
      void getAttachment(attachmentId).then(async (att) => {
        const scene = att ? parseScene(await att.blob.text()) : null;
        setExcalidraw({
          open: true,
          attachmentId,
          initialScene: scene ?? emptyScene(),
          onDelete,
          key,
        });
      });
    },
    [getAttachment]
  );

  const attachmentDeps = useMemo(
    () => ({
      getNoteId:
        getNoteId ??
        (async () => {
          throw new Error('getNoteId not provided');
        }),
      createAttachment,
      getAttachment,
      cloneAttachment,
      updateAttachment,
      openExcalidraw,
      onError: (code: AttachmentErrorCode) => toast(t(`editor.image.errors.${code}`)),
      t,
    }),
    [
      getNoteId,
      createAttachment,
      getAttachment,
      cloneAttachment,
      updateAttachment,
      openExcalidraw,
      t,
    ]
  );
  // useEditor builds the node (and its stored getter) exactly once, so all three
  // entry points must reach the *current* attachmentDeps through a stable getter over
  // a ref, not the first-render closure. The ref is refreshed every render; the
  // getter identity never changes (mirrors createMathematics's live-editor ref).
  const attachmentDepsRef = useRef(attachmentDeps);
  attachmentDepsRef.current = attachmentDeps;
  const getAttachmentDeps = useRef(() => attachmentDepsRef.current).current;

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
      createImage(getAttachmentDeps),
      createAudio(getAttachmentDeps),
      createVideo(getAttachmentDeps),
      createFile(getAttachmentDeps),
      createExcalidraw(getAttachmentDeps),
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
          void insertAttachmentFiles(ed, files, 'image', attachmentDepsRef.current, (id) =>
            ed.chain().focus().insertImageAttachment({ attachmentId: id }).run()
          );
          return true;
        }
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('audio/'))) {
          void insertAttachmentFiles(ed, files, 'audio', attachmentDepsRef.current, (id) =>
            ed.chain().focus().insertAudioAttachment({ attachmentId: id }).run()
          );
          return true;
        }
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('video/'))) {
          void insertAttachmentFiles(ed, files, 'video', attachmentDepsRef.current, (id) =>
            ed.chain().focus().insertVideoAttachment({ attachmentId: id }).run()
          );
          return true;
        }
        // Cross-note HTML paste with existing attachment nodes: let the default
        // paste happen, then reclaim any foreign images into owned clones.
        const html = event.clipboardData?.getData('text/html');
        if (ed && html?.includes('data-attachment-id')) {
          queueMicrotask(() => void dedupeForeignAttachments(ed, attachmentDepsRef.current));
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        const ed = editorRef.current;
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('image/'))) {
          void insertAttachmentFiles(ed, files, 'image', attachmentDepsRef.current, (id) =>
            ed.chain().focus().insertImageAttachment({ attachmentId: id }).run()
          );
          return true;
        }
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('audio/'))) {
          void insertAttachmentFiles(ed, files, 'audio', attachmentDepsRef.current, (id) =>
            ed.chain().focus().insertAudioAttachment({ attachmentId: id }).run()
          );
          return true;
        }
        if (ed && files && Array.from(files).some((f) => f.type.startsWith('video/'))) {
          void insertAttachmentFiles(ed, files, 'video', attachmentDepsRef.current, (id) =>
            ed.chain().focus().insertVideoAttachment({ attachmentId: id }).run()
          );
          return true;
        }
        return false;
      },
    },
    shouldRerenderOnTransaction: true,
    // Client-only SPA (no SSR): render the editor view after commit, not during
    // React's render phase. With `true`, content that mounts a React node view
    // (e.g. AudioNodeView) makes TipTap call flushSync mid-render -> "flushSync
    // was called from inside a lifecycle method" on any note with audio.
    immediatelyRender: false,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Best-effort autoplay-on-open: find the first audioAttachment node and stash
  // its id on editor storage; AudioNodeView reads and clears the flag once its
  // <audio> element is ready. Guarded by a ref (not just the effect's deps) so
  // it fires at most once per editor instance - an existing note's real body
  // only lands via the setContent below (it's loaded async and seeded as ''
  // at mount), so the scan must run against the doc setContent just applied,
  // not the pre-load one; a seeded draft's content is already there at mount,
  // so this still fires on the very first run for that case too.
  const autoplayScannedRef = useRef(false);
  useEffect(() => {
    if (!editor) return;
    // setContent mounts React node views (AudioNodeView); with
    // shouldRerenderOnTransaction, the resulting transaction forces a
    // synchronous React re-render, during which TipTap mounts the node view via
    // flushSync -> "flushSync was called from inside a lifecycle method". Run it
    // in a microtask so the mount never happens inside React's render/commit
    // phase. The autoplay scan must see the applied doc, so it runs after.
    queueMicrotask(() => {
      if (content !== editor.getHTML()) {
        editor.commands.setContent(content ?? '');
      }
      if (autoplayFirstAudio && !autoplayScannedRef.current) {
        let firstAudioId: string | null = null;
        editor.state.doc.descendants((node) => {
          if (firstAudioId) return false;
          if (node.type.name === 'audioAttachment') {
            firstAudioId = node.attrs.attachmentId as string;
            return false;
          }
          return true;
        });
        // Only latch the guard once something is actually found: the real body
        // for an existing note lands via a LATER setContent (loaded async,
        // seeded as '' at mount), so an empty first pass must not block that
        // later scan.
        if (firstAudioId) {
          autoplayScannedRef.current = true;
          editor.storage.autoplayFirstAudioId = firstAudioId;
        }
      }
    });
  }, [content, editor, autoplayFirstAudio]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus('end'),
      getEditor: () => editorRef.current,
    }),
    [editor]
  );

  // Commit-on-Save: create+insert for a new drawing, updateAttachment for an
  // edit. Reads the live deps/editor via refs (the node was built once at mount).
  const handleExcalidrawSave = useCallback(
    async (scene: ExcalidrawScene) => {
      try {
        await commitExcalidrawScene(
          attachmentDepsRef.current,
          excalidraw.attachmentId,
          scene,
          (id) =>
            editorRef.current
              ?.chain()
              .focus()
              .insertExcalidrawAttachment({ attachmentId: id })
              .run()
        );
      } catch (err) {
        console.error('Editor: excalidraw save failed', err);
        attachmentDepsRef.current.onError('insert-failed');
      } finally {
        setExcalidraw((s) => ({ ...s, open: false }));
      }
    },
    [excalidraw.attachmentId]
  );

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
    <>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: click just forwards focus into the editor; keyboard users already reach it via Tab. */}
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

      {/* One shared Excalidraw editing surface for the whole editor. Remounted per
        open (keyed) so its dirty/empty state is always fresh. */}
      <ExcalidrawDialog
        key={excalidraw.key}
        open={excalidraw.open}
        mode={excalidraw.attachmentId ? 'edit' : 'new'}
        initialScene={excalidraw.initialScene}
        onSave={handleExcalidrawSave}
        onDelete={excalidraw.onDelete}
        onClose={() => setExcalidraw((s) => ({ ...s, open: false }))}
        t={t}
      />
    </>
  );
});
