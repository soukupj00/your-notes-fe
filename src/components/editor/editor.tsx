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
import type { AttachmentDeps } from '@/components/editor/extensions/attachments/deps';
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
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
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
  /** Focus the editor body on mount (cursor at end). */
  autoFocus?: boolean;
  /**
   * On mobile, pin the toolbar to the bottom of the scroll container so it rides
   * above the virtual keyboard (see the sheet's `interactive-widget` viewport
   * meta). Desktop keeps the toolbar on top.
   */
  stickyToolbarOnMobile?: boolean;
  /**
   * Rendered inside the editor's own column, after the content and *before* the
   * toolbar.
   *
   * It exists so the note bar (labels, colour, pin) can sit above a sticky
   * toolbar rather than below it. A sticky element cannot leave its parent's
   * box, so while the bar was a sibling *after* this component the toolbar
   * bottomed out at this column's edge - roughly 80px above the keyboard, with
   * the note bar and the sheet's own padding stacked underneath it. Handing the
   * bar in rather than pinning a second one keeps the rule the mobile editor was
   * built on: the format toolbar is the only fixed chrome, because formatting is
   * a typing move and a second permanent strip costs the axis a phone has least
   * of.
   */
  footer?: React.ReactNode;
  /** Extra classes for the editor root (e.g. `flex-1` inside a full-screen sheet). */
  className?: string;
  /** Resolves the owning note id for image inserts (creating a draft note if needed). */
  getNoteId?: () => Promise<string>;
  /** Best-effort: autoplay the first audioAttachment node once the editor is
   *  ready (set when the note was opened via its card's audio chip). */
  autoplayFirstAudio?: boolean;
  /** Start a capture as soon as the editor is ready (quick-capture speed-dial). */
  initialCapture?: CaptureKind;
};

/** A capture the speed-dial can hand straight to the editor. */
export type CaptureKind = 'audio' | 'drawing' | 'picture';

/** Imperative handle so a parent (e.g. a dialog) can drop the cursor into the body,
 *  or (e.g. a test) reach the live TipTap editor instance. */
export type EditorHandle = { focus: () => void; getEditor: () => TiptapEditor | null };

/** Route pasted or dropped media files through the matching attachment insertion flow. */
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
  },
  ref
) {
  const { t } = useTranslation();
  const { preferences } = usePreferences();
  const reducedMotion = useReducedMotion();
  // Math node onClick handlers need the live editor, which does not exist yet when
  // the extensions array is built; a ref lets those closures reach it at click time.
  const editorRef = useRef<TiptapEditor | null>(null);
  // Only rendered for an auto-started picture capture; the toolbar's own
  // picker button keeps its own input.
  const pictureInputRef = useRef<HTMLInputElement>(null);

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

  // Same shape, same reason: the checklist FLIP plugin is built once but has to
  // see the preference as it is at the moment a checkbox is ticked, not as it
  // was when the note opened. Reduced motion is a hard killswitch (DESIGN.md),
  // so it is read here rather than inside the plugin.
  const animateChecklistRef = useRef(!reducedMotion);
  animateChecklistRef.current = !reducedMotion;
  const getAnimateChecklist = useRef(() => animateChecklistRef.current).current;

  /*
   * `extensions`, `editorProps` and `content` are all stabilised for one reason:
   * TipTap re-checks its options on every render (`useEditor` is called with no
   * deps, so the editor is never recreated) and any key that fails reference
   * equality costs a `setOptions` -> `view.setProps` -> full ProseMirror view
   * pass, stacked on top of the one the keystroke already triggered. Event
   * handlers are exempt from that comparison, so `onUpdate` may stay inline.
   *
   * Nothing here needs to be reactive: every live value already reaches the
   * built extensions through a stable getter over a ref (see above), and the
   * translator resolves the current language at call time rather than at build
   * time - so a captured `t` is not stale, provided its consumers call it
   * lazily (see `createLink`).
   */
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
        if (ed && files && insertTransferredAttachments(ed, files, attachmentDepsRef.current)) {
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
      handleDrop: (_view: EditorView, event: Event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        const ed = editorRef.current;
        return Boolean(
          ed && files && insertTransferredAttachments(ed, files, attachmentDepsRef.current)
        );
      },
    }),
    []
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
    // Client-only SPA (no SSR): render the editor view after commit, not during
    // React's render phase. With `true`, content that mounts a React node view
    // (e.g. AudioNodeView) makes TipTap call flushSync mid-render -> "flushSync
    // was called from inside a lifecycle method" on any note with audio.
    immediatelyRender: false,
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Best-effort autoplay-on-open: find the first audioAttachment node and ask
  // the audio extension's coordinator to play it. The coordinator handles both
  // load orderings because the note body and attachment blob are independent
  // IndexedDB reads.
  // Guarded by a ref (not just the effect's deps) so it fires at most once per
  // editor instance - an existing note's real body only lands via the
  // setContent below (it's loaded async and seeded as '' at mount), so the
  // scan must run against the doc setContent just applied, not the pre-load
  // one; a seeded draft's content is already there at mount, so this still
  // fires on the very first run for that case too.
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
          editor.storage.audioAttachment.autoplay.requestAutoplay(firstAudioId);
        }
      }
    });
  }, [content, editor, autoplayFirstAudio]);

  // One-shot auto-capture: the speed-dial picked a medium, so open straight
  // into it instead of making the user hunt for the same button in the toolbar.
  // Best-effort by nature - the picture picker needs the tap's user activation
  // to still be live, and a browser that has let it lapse simply shows the
  // editor with its toolbar, which is the same place the user was heading.
  const captureStartedRef = useRef(false);
  useEffect(() => {
    if (!editor || !initialCapture || captureStartedRef.current) return;
    captureStartedRef.current = true;
    if (initialCapture === 'drawing') {
      openExcalidraw({});
    } else if (initialCapture === 'audio') {
      editor.storage.audioAttachment.capture.requestRecording();
    } else {
      pictureInputRef.current?.click();
    }
  }, [editor, initialCapture, openExcalidraw]);

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
          ordered last and pinned to the bottom of the scroll container. Which
          buttons it holds is the user's stored Layout, not a hardcoded list -
          see `toolbar/EditorToolbar.tsx` and ADR 0011. */}
        {editable && (
          <EditorToolbar
            editor={editor}
            layouts={preferences.toolbar}
            stickyOnMobile={stickyToolbarOnMobile}
          />
        )}

        {/* Editable area. `flex-1` lets it fill a full-screen sheet so a
          sticky-bottom toolbar sits at the screen edge even with little text;
          `cursor-text` makes the empty space read as editable. */}
        <EditorContent
          editor={editor}
          className="prose prose-sm min-h-[150px] max-w-none flex-1 cursor-text focus:outline-none"
        />

        {/* The note bar, when a caller hands one in. It is in the flow rather
            than pinned: `EditorContent` above is `flex-1`, so on a note that
            fits it is pushed down and sits just above the toolbar exactly as it
            used to, and on a long one it scrolls away instead of taxing the
            screen for the whole session. Ordered before the toolbar in the DOM
            and *not* given `order-last`, which is what puts the toolbar under
            it once the toolbar is sticky. */}
        {footer}

        {/* A link's own controls belong on the link: `openOnClick` is off inside
            the editor, so this is the only way to see where one points. */}
        {editable && <LinkBubbleMenu editor={editor} t={t} />}

        {/* Checklist reorder. Mounted here rather than from the extension because
            the grip is a React portal that needs the live editor instance. */}
      </div>

      {/* Auto-started picture capture. `accept="image/*"` with no `capture`
        attribute: the mobile sheet then offers camera *and* gallery, and Linux
        Chrome does not grey out the selection the way a narrow MIME list makes
        it. */}
      {initialCapture === 'picture' && (
        <input
          ref={pictureInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          data-testid="auto-capture-picture-input"
          onChange={(event) => {
            const files = event.target.files;
            const ed = editorRef.current;
            if (files?.length && ed) {
              void insertImageAttachmentFiles(ed, files, attachmentDepsRef.current, (id) =>
                ed.chain().focus().insertImageAttachment({ attachmentId: id }).run()
              );
            }
            event.target.value = '';
          }}
        />
      )}

      {/* One shared Excalidraw editing surface for the whole editor. The canvas
        is loaded only when opened, then cached by React for later opens. */}
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
