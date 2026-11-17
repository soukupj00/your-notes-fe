import type { Editor as TiptapEditor } from '@tiptap/core';
import type { EditorView } from '@tiptap/pm/view';
import { EditorContent, useEditor } from '@tiptap/react';
import 'katex/dist/katex.min.css';
import type React from 'react';
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { AudioRecorderHost } from '@/components/editor/extensions/Audio/AudioRecorderHost';
import {
  dedupeForeignAttachments,
  insertFiles,
  insertTransferredFiles,
} from '@/components/editor/extensions/attachments/insert';
import { buildEditorExtensions } from '@/components/editor/extensions/build';
import {
  ExcalidrawDialogHost,
  useOpenDrawing,
} from '@/components/editor/extensions/Excalidraw/ExcalidrawDialogHost';
import { LinkBubbleMenu } from '@/components/editor/extensions/Link/LinkBubbleMenu';
import { TextPromptHost } from '@/components/editor/extensions/TextPrompt/TextPromptHost';
import { EditorToolbar } from '@/components/editor/toolbar/EditorToolbar.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useSync } from '@/context/SyncProvider.tsx';
import { useAttachmentActions } from '@/hooks/data/useAttachmentActions.ts';
import { useLatest } from '@/hooks/useLatest.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import { ATTACHMENT_SPECS, type AttachmentErrorCode, MiB } from '@/lib/attachments.ts';
import { bodyHasAttachment } from '@/lib/body.ts';
import type { Intent } from '@/lib/intent.ts';
import { cn } from '@/lib/utils.ts';
import type { AttachmentKind } from '@/models.ts';

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
  /** What the Editor does as it opens, beyond showing the Note (CONTEXT.md "Intent"). */
  intent?: Intent;
};

/** `getEditor` exists for tests that need the live TipTap instance. */
export type EditorHandle = {
  focus: (at?: 'start' | 'end') => void;
  getEditor: () => TiptapEditor | null;
};

// TipTap moves focus a frame later, and a key pressed in that frame lands where focus was.
function focusNow(editor: TiptapEditor, at: 'start' | 'end') {
  editor.commands.focus(at);
  editor.view.focus();
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
    intent,
  },
  ref
) {
  const { t, i18n } = useTranslation();
  const { preferences } = usePreferences();
  const reducedMotion = useReducedMotion();
  // Math node onClick handlers need the live editor, which does not exist yet when
  // the extensions array is built; a ref lets those closures reach it at click time.
  const editorRef = useRef<TiptapEditor | null>(null);

  const { createAttachment, getAttachment, watchAttachment, cloneAttachment, updateAttachment } =
    useAttachmentActions();
  const { download: downloadAttachment } = useSync();

  const { drawing, openExcalidraw, closeExcalidraw } = useOpenDrawing(getAttachment);

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
      onError: (code: AttachmentErrorCode, kind: AttachmentKind) =>
        toast(
          t(`editor.attachment.errors.${code}`, { max: ATTACHMENT_SPECS[kind].maxBytes / MiB })
        ),
      t,
      locale: i18n.language,
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
      i18n.language,
    ]
  );
  // useEditor builds the extensions once, so they must reach the *current* deps
  // through a stable getter, not the first-render closure.
  const getAttachmentDeps = useLatest(attachmentDeps);
  // Same reason: the checklist FLIP plugin must see reduced motion as it is when a
  // box is ticked. It is a hard killswitch (DESIGN.md Motion).
  const getAnimateChecklist = useLatest(!reducedMotion);
  const getShortcuts = useLatest(useShortcuts().bindings);

  // `extensions`, `editorProps` and `content` stay referentially stable, or every
  // render costs a full ProseMirror view pass: see editor/CLAUDE.md (`editor.tsx`).
  // Event handlers are exempt from TipTap's option check, so `onUpdate` stays inline.
  const extensions = useMemo(
    () =>
      buildEditorExtensions({
        getDeps: getAttachmentDeps,
        getEditor: () => editorRef.current,
        animateChecklist: getAnimateChecklist,
        getShortcuts,
        t,
      }),
    [getAttachmentDeps, getAnimateChecklist, getShortcuts, t]
  );

  const editorProps = useMemo(
    () => ({
      handlePaste: (_view: EditorView, event: ClipboardEvent) => {
        const files = event.clipboardData?.files;
        const ed = editorRef.current;
        if (ed && files && insertTransferredFiles(ed, files, getAttachmentDeps())) {
          return true;
        }
        // Cross-note HTML paste with existing attachment nodes: let the default
        // paste happen, then reclaim any foreign images into owned clones.
        const html = event.clipboardData?.getData('text/html');
        if (ed && bodyHasAttachment(html)) {
          queueMicrotask(() => void dedupeForeignAttachments(ed, getAttachmentDeps()));
        }
        return false;
      },
      handleDrop: (_view: EditorView, event: Event) => {
        const files = (event as DragEvent).dataTransfer?.files;
        const ed = editorRef.current;
        return Boolean(ed && files && insertTransferredFiles(ed, files, getAttachmentDeps()));
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
  const autoplay = intent?.kind === 'play';
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
      if (autoplay && !autoplayScannedRef.current) {
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
  }, [content, editor, autoplay]);

  // The Intent's one-shot act. A picker Start arrives as files, because the picker can only open
  // inside the tap that chose it (`useStartPicker`); a checklist is the dialog's body seed, and
  // `play` is the autoplay scan above.
  const intentStartedRef = useRef(false);
  useEffect(() => {
    if (!editor || intentStartedRef.current) return;
    if (intent?.kind !== 'record' && intent?.kind !== 'draw' && intent?.kind !== 'files') return;
    intentStartedRef.current = true;
    if (intent.kind === 'record') editor.storage.audioAttachment.capture.requestRecording();
    else if (intent.kind === 'draw') openExcalidraw({});
    else void insertFiles(intent.attachment, editor, intent.files, getAttachmentDeps());
  }, [editor, getAttachmentDeps, intent, openExcalidraw]);

  useImperativeHandle(
    ref,
    () => ({
      focus: (at = 'end') => {
        if (editor) focusNow(editor, at);
      },
      getEditor: () => editorRef.current,
    }),
    [editor]
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
    focusNow(editor, 'end');
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
        {editable && <TextPromptHost editor={editor} t={t} />}
      </div>

      <ExcalidrawDialogHost
        drawing={drawing}
        onClose={closeExcalidraw}
        editorRef={editorRef}
        getDeps={getAttachmentDeps}
      />
    </>
  );
});
