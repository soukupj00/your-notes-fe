import '@excalidraw/excalidraw/index.css';
import { Excalidraw } from '@excalidraw/excalidraw';
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
      isDeleted: candidate.isDeleted,
    };
  }
  return element;
}

/** The dirty check compares only what the user authors: element versions and the
 *  background colour. onChange also fires for viewport, zoom and selection. */
function sceneFingerprint(scene: ExcalidrawScene): string {
  return JSON.stringify({
    elements: scene.elements.map(elementFingerprint),
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
  t: (k: string) => string;
}

/** The one shared drawing surface; the node view is only a preview that opens it.
 *  Cancel is dirty-guarded, Delete is confirm-guarded, backdrop and Escape never
 *  dismiss. The parent keys it per drawing so its state resets on each open. */
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
  const [hasElements, setHasElements] = useState((initialScene?.elements.length ?? 0) > 0);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);

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
    if (dirty) setConfirm('discard');
    else onClose();
  };

  const handleSave = async () => {
    const api = apiRef.current;
    if (!api) return;
    const elements = api.getSceneElements();
    if (elements.length === 0) return;
    await onSave({ elements, appState: api.getAppState(), files: api.getFiles() });
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
              disabled={!hasElements}
              onClick={() => void handleSave()}
            />
            {mode === 'edit' && onDelete && (
              <DeleteButton
                variant="ghost"
                size="sm"
                label={t('editor.excalidraw.deleteAction')}
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirm('delete')}
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
              bottom edge. The drag clamp above bounds the drawing, not overflow-hidden. */}
          <div ref={canvasAreaRef} className="min-h-0 flex-1 overflow-hidden">
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
                setHasElements(elements.length > 0);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
        title={
          confirm === 'delete'
            ? t('editor.excalidraw.deleteModal')
            : t('editor.excalidraw.discardTitle')
        }
        description={
          confirm === 'delete'
            ? t('attachments.confirmDelete.description')
            : t('editor.excalidraw.discardDescription')
        }
        confirmLabel={
          confirm === 'delete'
            ? t('editor.excalidraw.deleteAction')
            : t('editor.excalidraw.discardConfirm')
        }
        cancelLabel={t('editor.excalidraw.discardCancel')}
        onConfirm={() => {
          if (confirm === 'delete') onDelete?.();
          else onClose();
        }}
      />
    </>
  );
}

export default ExcalidrawDialog;
