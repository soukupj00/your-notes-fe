import '@excalidraw/excalidraw/index.css';
import { Excalidraw } from '@excalidraw/excalidraw';
import { useBlocker, useRouter } from '@tanstack/react-router';
import { XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DeleteButton, SaveButton } from '@/components/ui/EntityActionButtons';
import type { TFunction } from '../button-types';
import { type ExcalidrawScene, emptyScene } from './scene';

/** Local structural type, so the dialog does not depend on the package's type paths. */
interface ExcalidrawApi {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  /** Recomputes the canvas offsets Excalidraw caches. */
  refresh: () => void;
}

function elementFingerprint(element: unknown): unknown {
  if (!element || typeof element !== 'object') return element;
  const candidate = element as Record<string, unknown>;
  if ('id' in candidate && ('version' in candidate || 'versionNonce' in candidate)) {
    return {
      id: candidate.id,
      version: candidate.version,
      versionNonce: candidate.versionNonce,
    };
  }
  return element;
}

/** Excalidraw's onChange keeps erased elements, flagged; Save and the dirty check read
 *  only the live ones. */
function isLive(element: unknown): boolean {
  return !(element as { isDeleted?: boolean } | null)?.isDeleted;
}

/** The dirty check compares only what the user authors: element versions and the
 *  background colour. onChange also fires for viewport, zoom and selection. */
function sceneFingerprint(scene: ExcalidrawScene): string {
  return JSON.stringify({
    elements: scene.elements.filter(isLive).map(elementFingerprint),
    viewBackgroundColor: scene.appState.viewBackgroundColor ?? '#ffffff',
  });
}

export interface ExcalidrawDialogProps {
  open: boolean;
  /** 'new' has no attachment yet, so Save creates one. */
  mode: 'new' | 'edit';
  initialScene: ExcalidrawScene | null;
  /** Commit. Never called with an empty scene (Save is disabled then). */
  onSave: (scene: ExcalidrawScene) => void | Promise<void>;
  /** Edit mode only: remove the drawing (node + row). */
  onDelete?: () => void;
  /** Discard + close (the parent owns `open`). */
  onClose: () => void;
  t: TFunction;
}

/** The one shared drawing surface; the node view is only a preview that opens it.
 *  Cancel and a navigation away are dirty-guarded, Delete is confirm-guarded, backdrop
 *  and Escape never dismiss. The parent keys it per drawing so its state resets on each open. */
export function ExcalidrawDialog({
  open,
  mode,
  initialScene,
  onSave,
  onDelete,
  onClose,
  t,
}: ExcalidrawDialogProps) {
  const apiRef = useRef<ExcalidrawApi | null>(null);
  const initialFingerprintRef = useRef(
    initialScene ? sceneFingerprint(initialScene) : sceneFingerprint(emptyScene())
  );
  const [dirty, setDirty] = useState(false);
  const [hasElements, setHasElements] = useState(initialScene?.elements.some(isLive) ?? false);
  const [saving, setSaving] = useState(false);
  // `kind` outlives `open`, so the texts hold still while the confirm fades out.
  const [confirm, setConfirm] = useState<{ kind: 'discard' | 'delete'; open: boolean }>({
    kind: 'discard',
    open: false,
  });
  const ask = (kind: 'discard' | 'delete') => setConfirm({ kind, open: true });

  // The platform Back pops the Note's history entry (ADR 0014) and would take a dirty
  // Drawing with it, so the navigation is refused and repeated once Discard is chosen.
  // Why it answers at once and owns its beforeunload: src/components/editor/CLAUDE.md.
  const router = useRouter();
  const blockedLeaveRef = useRef<(() => void) | null>(null);
  useBlocker({
    disabled: !dirty,
    enableBeforeUnload: false,
    shouldBlockFn: ({ action, next }) => {
      if (saving) return true;
      blockedLeaveRef.current = () => {
        if (action === 'BACK') router.history.back({ ignoreBlocker: true });
        else if (action === 'FORWARD') router.history.forward({ ignoreBlocker: true });
        else
          void router.navigate({
            to: next.pathname,
            search: next.search,
            replace: action === 'REPLACE',
            ignoreBlocker: true,
          });
      };
      ask('discard');
      return true;
    },
  });

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Withholds moves above the canvas during a canvas drag: pointer capture would let a
  // stroke run into the header, off-screen but still exported.
  // Why a capture-phase window listener: src/components/editor/CLAUDE.md, Excalidraw.
  useEffect(() => {
    if (!open) return;
    let drawing = false;

    const onDown = (event: PointerEvent) => {
      const area = canvasAreaRef.current;
      drawing = Boolean(area && event.target instanceof Node && area.contains(event.target));
    };
    const onMove = (event: PointerEvent) => {
      if (!drawing) return;
      const top = canvasAreaRef.current?.getBoundingClientRect().top;
      if (top !== undefined && event.clientY < top) event.stopPropagation();
    };
    const onUp = () => {
      drawing = false;
    };

    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('pointermove', onMove, true);
    window.addEventListener('pointerup', onUp, true);
    window.addEventListener('pointercancel', onUp, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onUp, true);
    };
  }, [open]);

  const requestClose = () => {
    blockedLeaveRef.current = null;
    if (dirty) ask('discard');
    else onClose();
  };

  const handleSave = async () => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (elements.length === 0 || saving) return;
    setSaving(true);
    try {
      await onSave({ elements, appState: api.getAppState(), files: api.getFiles() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) requestClose();
        }}
      >
        <DialogContent
          showCloseButton={false}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          // Belt and braces for any later reposition: `refresh()` recomputes the
          // offsets Excalidraw caches. It does not resize the canvas, which is
          // why the scale animation has to go rather than be corrected after.
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) apiRef.current?.refresh();
          }}
          // `zoom-in-100` is load-bearing: Excalidraw measures its canvas mid-entrance and
          // never re-measures, so a scale animation puts every stroke off the cursor.
          // Details: src/components/editor/CLAUDE.md, Excalidraw.
          className="data-[state=closed]:zoom-out-100 data-[state=open]:zoom-in-100 flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none border-0 p-0 sm:h-[92vh] sm:w-[94vw] sm:max-w-none sm:rounded-lg sm:border"
        >
          <DialogHeader className="flex shrink-0 flex-row items-center gap-2 space-y-0 border-b p-3 text-left">
            <DialogTitle className="flex-1">{t('editor.excalidraw.title')}</DialogTitle>
            {/* Description is required by Radix for a11y; the title says enough. */}
            <DialogDescription className="sr-only">
              {t('editor.excalidraw.title')}
            </DialogDescription>
            <SaveButton
              size="sm"
              label={t('editor.excalidraw.save')}
              disabled={!hasElements || saving}
              onClick={() => void handleSave()}
            />
            {mode === 'edit' && onDelete && (
              <DeleteButton
                variant="ghost"
                size="sm"
                label={t('editor.excalidraw.deleteAction')}
                className="text-destructive hover:text-destructive"
                onClick={() => ask('delete')}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('editor.excalidraw.cancel')}
              onClick={requestClose}
            >
              <XIcon className="size-4" />
            </Button>
          </DialogHeader>

          {/* Actions sit in the header because Excalidraw's mobile toolbar owns the
              bottom edge. The drag clamp above bounds the drawing, not overflow-hidden.
              Excalidraw always draws its light theme, so the browser's own parts in it stay light. */}
          <div ref={canvasAreaRef} className="min-h-0 flex-1 overflow-hidden [color-scheme:light]">
            <Excalidraw
              initialData={initialScene as never}
              excalidrawAPI={(api: unknown) => {
                apiRef.current = api as ExcalidrawApi;
              }}
              onChange={(elements, appState, files) => {
                setDirty(
                  sceneFingerprint({
                    elements,
                    appState: appState as unknown as Record<string, unknown>,
                    files: files as unknown as Record<string, unknown>,
                  }) !== initialFingerprintRef.current
                );
                setHasElements(elements.some(isLive));
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm.open}
        onOpenChange={(open) => setConfirm((current) => ({ ...current, open }))}
        title={
          confirm.kind === 'delete'
            ? t('editor.excalidraw.deleteModal')
            : t('editor.excalidraw.discardTitle')
        }
        description={
          confirm.kind === 'delete'
            ? t('attachments.confirmDelete.description')
            : t('editor.excalidraw.discardDescription')
        }
        confirmLabel={
          confirm.kind === 'delete'
            ? t('editor.excalidraw.deleteAction')
            : t('editor.excalidraw.discardConfirm')
        }
        cancelLabel={t('editor.excalidraw.discardCancel')}
        onConfirm={() => {
          if (confirm.kind === 'delete') return onDelete?.();
          onClose();
          blockedLeaveRef.current?.();
        }}
      />
    </>
  );
}

export default ExcalidrawDialog;
