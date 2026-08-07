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

/** Minimal structural view of the bits of Excalidraw's imperative API we read on
 *  Save. Kept local (not imported from the package's type path) so the dialog is
 *  decoupled from the heavy lib's type surface. */
interface ExcalidrawApi {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
  /** Recomputes the canvas offsets Excalidraw caches. See `onAnimationEnd` below. */
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

/** Excalidraw's onChange includes transient canvas state such as viewport size,
 *  zoom, and selection. Those changes are not drawing edits. Element versions
 *  change for every persisted element mutation, while the background color is
 *  the only app-state value authored as part of the drawing in this slice. */
function sceneFingerprint(scene: ExcalidrawScene): string {
  return JSON.stringify({
    elements: scene.elements.map(elementFingerprint),
    viewBackgroundColor: scene.appState.viewBackgroundColor ?? '#ffffff',
  });
}

export interface ExcalidrawDialogProps {
  open: boolean;
  /** 'new' has no attachment yet (Save creates); 'edit' updates an existing row. */
  mode: 'new' | 'edit';
  /** emptyScene() for 'new'; the parsed stored scene for 'edit'. */
  initialScene: ExcalidrawScene | null;
  /** Commit. Never called with an empty scene (Save is disabled then). */
  onSave: (scene: ExcalidrawScene) => void | Promise<void>;
  /** Edit mode only: remove the drawing (node + row). */
  onDelete?: () => void;
  /** Discard + close (the parent owns `open`). */
  onClose: () => void;
  t: (k: string) => string;
}

/** The single shared Excalidraw editing surface. The live canvas lives here (not
 *  inline in the ProseMirror document); the NodeView is a passive preview that
 *  opens this. Three distinct guarded verbs: Save (commit; disabled when empty),
 *  Cancel/X (discard, dirty-guarded), Delete (edit-mode only, confirm-guarded).
 *  Backdrop and Escape never dismiss. Keyed by drawing identity in the parent so
 *  local state resets on each open. */
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
  // Save is disabled while the scene has no elements. Seeded from the initial
  // scene (an existing drawing is immediately saveable) and kept fresh on change.
  const [hasElements, setHasElements] = useState((initialScene?.elements.length ?? 0) > 0);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);

  const canvasAreaRef = useRef<HTMLDivElement>(null);

  /*
   * Bound the drawable region to the canvas row.
   *
   * The canvas takes a pointer capture on pointerdown, and from then on every
   * move is delivered to it regardless of what is physically under the cursor.
   * So a stroke begun below the header kept extending as the pointer travelled
   * up into the header, writing scene elements above the canvas top: clipped
   * from view, unreachable without panning, and still present in the exported
   * image. A drag could reach that strip even though a press could never start
   * there, which is what made it feel arbitrary.
   *
   * Hit-testing cannot fix this - capture bypasses it - so the moves themselves
   * have to be withheld. A capture-phase listener on `window` sees each move
   * before it can reach the canvas (capture runs root-down, and this one is
   * registered on open, ahead of the window listeners Excalidraw attaches when
   * a drag begins). Above the boundary the event is stopped, so the stroke
   * simply pauses at the edge and resumes if the pointer comes back down.
   *
   * Gated on a drag that started in the canvas, so ordinary pointer traffic
   * over the header - hovering Save, aiming at the close button - is untouched.
   */
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
    if (elements.length === 0) return; // Save never persists an empty scene.
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
          /*
           * `zoom-in-100` cancels the shared dialog's `zoom-in-95` entrance, and
           * that is load-bearing rather than taste. Excalidraw sizes its canvas
           * from `getBoundingClientRect`, which reports the *transformed* box,
           * while a transform leaves layout size untouched - so a ResizeObserver
           * never fires and the wrong number is never corrected. Opening mid-scale
           * cached the container at ~98.5%, leaving the drawable surface ~18px
           * narrower than the frame and every stroke landing off the cursor by a
           * margin that grew with the dialog, i.e. worst on desktop. The fade is
           * kept; only the geometry-corrupting part is dropped.
           *
           * Sizing is relative units only. Mobile: true fullscreen. sm+: as much
           * of the viewport as it can take - a drawing surface has no readable
           * line length to cap, so unlike the text editor it is not held to a
           * content width, and `sm:max-w-none` is required to beat the shared
           * dialog's `sm:max-w-lg`.
           *
           * `border-0` on mobile because a fullscreen surface has nothing to be
           * bordered against - the shared dialog's 1px frame would sit on the
           * screen edge. The desktop frame comes back at sm+.
           */
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

          {/* Actions live top-right (not a bottom footer) because Excalidraw owns
              the bottom edge with its own mobile toolbar. `overflow-hidden` keeps
              the canvas painting inside its own row; the drawable region is
              bounded by the clamp in `useEffect` above, not by this. */}
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
