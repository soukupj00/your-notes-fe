import type { Editor as TiptapEditor } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import { EditorContent, useEditor } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import type React from 'react';
import {
  forwardRef,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AudioRecorderHost } from '@/components/editor/extensions/Audio';
import type {
  AttachmentDeps,
  ExcalidrawOpenArgs,
} from '@/components/editor/extensions/attachments/deps';
import {
  dedupeForeignAttachments,
  insertAttachmentFiles,
} from '@/components/editor/extensions/attachments/insert';
import { buildEditorExtensions } from '@/components/editor/extensions/build';
import { commitExcalidrawScene } from '@/components/editor/extensions/Excalidraw/commit';
import {
  type ExcalidrawScene,
  emptyScene,
  parseScene,
} from '@/components/editor/extensions/Excalidraw/scene';
import { insertImageAttachmentFiles } from '@/components/editor/extensions/Image/insert';
import { LinkBubbleMenu } from '@/components/editor/extensions/Link';
import { insertVideoAttachmentFiles } from '@/components/editor/extensions/Video/insert.ts';
import { EditorToolbar } from '@/components/editor/toolbar/EditorToolbar.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useSync } from '@/context/SyncProvider.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useLatest } from '@/hooks/useLatest.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import type { AttachmentErrorCode } from '@/lib/attachments.ts';
import { cn } from '@/lib/utils.ts';

const ExcalidrawDialog = lazy(
  () => import('@/components/editor/extensions/Excalidraw/ExcalidrawDialog')
);

// Excalidraw resolves its bundled fonts/assets relative to this origin - pin it
// to the app root so it works the same under the PWA's service-worker scope.
if (typeof window !== 'undefined') {
  (window as unknown as { EXCALIDRAW_ASSET_PATH?: string }).EXCALIDRAW_ASSET_PATH = '/';
}

type EditorProps = {
  content?: string;
  editable?: boolean;
  onUpdate?: (content: string) => void;
  autoFocus?: boolean;
  /** Mobile only: pin the toolbar to the bottom so it rides above the virtual keyboard. */
  stickyToolbarOnMobile?: boolean;
  /**
   * The note bar, rendered inside this column so it sits above the sticky toolbar,
   * which cannot leave its parent's box. Why it is not pinned: editor/CLAUDE.md.
   */
  footer?: React.ReactNode;
  className?: string;
  /** Resolves the owning note id for attachment inserts, creating the draft note if needed. */
  getNoteId?: () => Promise<string>;
  /** Set when the note was opened from its card's audio chip. Best-effort. */
  autoplayFirstAudio?: boolean;
  /** Start a capture as soon as the editor is ready (quick-capture speed-dial). */
  initialCapture?: CaptureKind;
  /** Images chosen by a picker Start, inserted once when the editor is ready. */
  initialFiles?: File[];
};

/** A capture the speed-dial can hand straight to the editor. A picture is not
 *  one: its picker can only open inside the tap, so it arrives as `initialFiles`. */
export type CaptureKind = 'audio' | 'drawing';

/** `getEditor` exists for tests that need the live TipTap instance. */
export type EditorHandle = { focus: () => void; getEditor: () => TiptapEditor | null };

function insertTransferredAttachments(
  editor: TiptapEditor,
  files: FileList,
  deps: AttachmentDeps
): boolean {
  const transferredFiles = Array.from(files);

  if (transferredFiles.some((file) => file.type.startsWith('image/'))) {
    void insertImageAttachmentFiles(editor, files, deps, (id) =>
      editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
    );
    return true;
  }
  if (transferredFiles.some((file) => file.type.startsWith('audio/'))) {
    void insertAttachmentFiles(editor, files, 'audio', deps, (id) =>
      editor.chain().focus().insertAudioAttachment({ attachmentId: id }).run()
    );
    return true;
  }
  if (transferredFiles.some((file) => file.type.startsWith('video/'))) {
    void insertVideoAttachmentFiles(editor, files, deps, (id) =>
      editor.chain().focus().insertVideoAttachment({ attachmentId: id }).run()
    );
    return true;
  }
  return false;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  {
    content,
    editable,
    onUpdate,
    autoFocus,
    stickyToolbarOnMobile,
    footer,
    className,
    getNoteId,
    autoplayFirstAudio,
    initialCapture,
    initialFiles,
  },
  ref
) {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const reducedMotion = useReducedMotion();
  // Math node onClick handlers need the live editor, which does not exist yet when
  // the extensions array is built; a ref lets those closures reach it at click time.
  const editorRef = useRef<TiptapEditor | null>(null);

  const { createAttachment, getAttachment, watchAttachment, cloneAttachment, updateAttachment } =
    useAttachmentActions();
  const { download: downloadAttachment } = useSync();

  // One shared Excalidraw modal; the live canvas never lives inline in the doc.
  // `attachmentId: null` is a new drawing that Save creates. `onDelete` is the
  // same node removal as the preview's corner X.
  const [excalidraw, setExcalidraw] = useState<{
    open: boolean;
    attachmentId: string | null;
    initialScene: ExcalidrawScene | null;
    onDelete?: () => void;
    onReplace?: (attachmentId: string) => void;
    // Bumped on every open so the dialog remounts (fresh dirty/empty state) even
    // when the same drawing - or another new one - is opened twice in a row.
    key: number;
  }>({ open: false, attachmentId: null, initialScene: null, key: 0 });
  const openSeqRef = useRef(0);

  const openExcalidraw = useCallback(
    (args: ExcalidrawOpenArgs) => {
      const { attachmentId, onDelete, onReplace } = args;
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
      // One-shot read: the modal edits its own copy and commits on Save.
      void getAttachment(attachmentId).then(async (att) => {
        const scene = att?.blob ? parseScene(await att.blob.text()) : null;
        setExcalidraw({
          open: true,
          attachmentId,
          initialScene: scene ?? emptyScene(),
          onDelete,
          onReplace,
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
      watchAttachment,
      downloadAttachment,
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
      watchAttachment,
      downloadAttachment,
      cloneAttachment,
      updateAttachment,
      openExcalidraw,
      t,
    ]
  );
  // useEditor builds the extensions once, so they must reach the *current* deps
  // through a stable getter, not the first-render closure.
  const getAttachmentDeps = useLatest(attachmentDeps);
  // Same reason: the checklist FLIP plugin must see reduced motion as it is when a
  // box is ticked. It is a hard killswitch (DESIGN.md Motion).
  const getAnimateChecklist = useLatest(!reducedMotion);

  // `extensions`, `editorProps` and `content` stay referentially stable, or every
  // render costs a full ProseMirror view pass: see editor/CLAUDE.md (`editor.tsx`).
  // Event handlers are exempt from TipTap's option check, so `onUpdate` stays inline.
  const extensions = useMemo(
    () =>
      buildEditorExtensions({
        getDeps: getAttachmentDeps,
        getEditor: () => editorRef.current,
        animateChecklist: getAnimateChecklist,
        t,
      }),
    [getAttachmentDeps, getAnimateChecklist, t]
  );

  const editorProps = useMemo(
    () => ({
      handlePaste: (_view: EditorView, event: ClipboardEvent) => {
        const files = event.clipboardData?.files;
        const ed = editorRef.current;
        if (ed && files && insertTransferredAttachments(ed, files, getAttachmentDeps())) {
          return true;
        }
        // Cross-note HTML paste with existing attachment nodes: let the default
        // paste happen, then reclaim any foreign images into owned clones.
        const html = event.clipboardData?.getData('text/html');
        if (ed && html?.includes('data-attachment-id')) {
          queueMicrotask(() => void dedupeForeignAttachments(ed, getAttachmentDeps()));
        }
        return false;
      },
      handleDrop: (_view: EditorView, event: Event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        const ed = editorRef.current;
        return Boolean(ed && files && insertTransferredAttachments(ed, files, getAttachmentDeps()));
      },
    }),
    [getAttachmentDeps]
  );

  // Creation-time only. The `content` prop is not a controlled value: the
  // microtask effect below owns every later change, and letting the option
  // itself churn would defeat the stabilisation above on every keystroke.
  const initialContent = useRef(content).current;

  const editor = useEditor({
    extensions,
    content: initialContent,
    editable,
    autofocus: autoFocus ? 'end' : false,
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML());
    },
    editorProps,
    shouldRerenderOnTransaction: true,
    // With `true`, a React node view (e.g. AudioNodeView) makes TipTap call flushSync
    // mid-render: "flushSync was called from inside a lifecycle method".
    immediatelyRender: false,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Autoplay fires at most once per editor. The audio coordinator handles either
  // load order, since the body and the blob are independent IndexedDB reads.
  const autoplayScannedRef = useRef(false);
  useEffect(() => {
    if (!editor) return;
    // A microtask keeps setContent's node-view mount out of React's render and commit
    // phase, where TipTap's flushSync throws. The autoplay scan runs after it so it
    // sees the applied doc.
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
        // Latch only on a hit: an existing note's body lands through a later
        // setContent (it mounts as ''), so an empty first pass must not block it.
        if (firstAudioId) {
          autoplayScannedRef.current = true;
          editor.storage.audioAttachment.autoplay.requestAutoplay(firstAudioId);
        }
      }
    });
  }, [content, editor, autoplayFirstAudio]);

  // One-shot open intents from the speed-dial. A picker Start arrives as files,
  // because the picker can only open inside the tap that chose it (`useStartPicker`).
  const intentStartedRef = useRef(false);
  useEffect(() => {
    if (!editor || intentStartedRef.current) return;
    if (!initialCapture && !initialFiles?.length) return;
    intentStartedRef.current = true;
    if (initialCapture === 'drawing') {
      openExcalidraw({});
    } else if (initialCapture === 'audio') {
      editor.storage.audioAttachment.capture.requestRecording();
    }
    if (initialFiles?.length) {
      void insertImageAttachmentFiles(editor, initialFiles, getAttachmentDeps(), (id) =>
        editor.chain().focus().insertImageAttachment({ attachmentId: id }).run()
      );
    }
  }, [editor, getAttachmentDeps, initialCapture, initialFiles, openExcalidraw]);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus('end'),
      getEditor: () => editorRef.current,
    }),
    [editor]
  );

  const replaceExcalidraw = excalidraw.onReplace;
  // Commit-on-Save: every Save mints a new row. A new drawing inserts its node,
  // an edit repoints the existing one.
  const handleExcalidrawSave = useCallback(
    async (scene: ExcalidrawScene) => {
      try {
        await commitExcalidrawScene(getAttachmentDeps(), excalidraw.attachmentId, scene, (id) => {
          if (excalidraw.attachmentId) {
            replaceExcalidraw?.(id);
            return;
          }
          editorRef.current?.chain().focus().insertExcalidrawAttachment({ attachmentId: id }).run();
        });
      } catch (err) {
        console.error('Editor: excalidraw save failed', err);
        getAttachmentDeps().onError('insert-failed');
      } finally {
        setExcalidraw((s) => ({ ...s, open: false }));
      }
    },
    [excalidraw.attachmentId, getAttachmentDeps, replaceExcalidraw]
  );

  if (!editor) {
    return null;
  }

  // So the empty space below the text also reads as editable.
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
        {/* First in the DOM; with `stickyOnMobile` it is ordered under the note bar. */}
        {editable && (
          <EditorToolbar
            editor={editor}
            layouts={preferences.toolbar}
            stickyOnMobile={stickyToolbarOnMobile}
          />
        )}

        <EditorContent
          editor={editor}
          className="prose prose-sm min-h-[150px] max-w-none flex-1 cursor-text focus:outline-none"
        />

        {/* Mounted whenever the editor is editable, whatever the toolbar shows. */}
        {editable && <AudioRecorderHost editor={editor} getDeps={getAttachmentDeps} />}
        {footer}

        {/* `openOnClick` is off inside the editor, so this is the only way to see
            where a link points. */}
        {editable && <LinkBubbleMenu editor={editor} t={t} />}
      </div>

      {excalidraw.open && (
        <Suspense
          fallback={
            <div
              className="fixed inset-0 z-50 flex items-center justify-center gap-2 bg-background/80"
              role="status"
              aria-label={t('editor.excalidraw.title')}
            >
              <Spinner className="size-6" />
            </div>
          }
        >
          <ExcalidrawDialog
            key={excalidraw.key}
            open
            mode={excalidraw.attachmentId ? 'edit' : 'new'}
            initialScene={excalidraw.initialScene}
            onSave={handleExcalidrawSave}
            onDelete={excalidraw.onDelete}
            onClose={() => setExcalidraw((s) => ({ ...s, open: false }))}
            t={t}
          />
        </Suspense>
      )}
    </>
  );
});
