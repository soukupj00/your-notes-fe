import '@excalidraw/excalidraw/index.css';
import { Excalidraw } from '@excalidraw/excalidraw';
import { XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ExcalidrawScene } from './scene';

/** Minimal structural view of the bits of Excalidraw's imperative API we read on
 *  Save. Kept local (not imported from the package's type path) so the dialog is
 *  decoupled from the heavy lib's type surface. */
interface ExcalidrawApi {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  getFiles: () => Record<string, unknown>;
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
  // dirty = onChange has fired since open (cheap over-approximation; Excalidraw
  // may fire an initial onChange - accepted). Gates the discard-confirm.
  const [dirty, setDirty] = useState(false);
  // Save is disabled while the scene has no elements. Seeded from the initial
  // scene (an existing drawing is immediately saveable) and kept fresh on change.
  const [hasElements, setHasElements] = useState((initialScene?.elements.length ?? 0) > 0);
  const [confirm, setConfirm] = useState<'discard' | 'delete' | null>(null);

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
          // Relative units only. Mobile: true fullscreen. sm+: large centered
          // surface. Flex column: slim header (actions top-right) + canvas fill.
          className="flex h-[100dvh] w-screen max-w-none flex-col gap-0 rounded-none p-0 sm:h-[88vh] sm:w-[92vw] sm:max-w-[75rem] sm:rounded-lg"
        >
          <DialogHeader className="flex shrink-0 flex-row items-center gap-2 space-y-0 border-b p-3 text-left">
            <DialogTitle className="flex-1">{t('editor.excalidraw.title')}</DialogTitle>
            {/* Description is required by Radix for a11y; the title says enough. */}
            <DialogDescription className="sr-only">
              {t('editor.excalidraw.title')}
            </DialogDescription>
            {mode === 'edit' && onDelete && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => setConfirm('delete')}
              >
                {t('editor.excalidraw.deleteModal')}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              aria-label={t('editor.excalidraw.cancel')}
              onClick={requestClose}
            >
              <XIcon className="size-4" />
            </Button>
            <Button size="sm" disabled={!hasElements} onClick={() => void handleSave()}>
              {t('editor.excalidraw.save')}
            </Button>
          </DialogHeader>

          {/* Actions live top-right (not a bottom footer) because Excalidraw owns
              the bottom edge with its own mobile toolbar. */}
          <div className="min-h-0 flex-1">
            <Excalidraw
              initialData={initialScene as never}
              excalidrawAPI={(api: unknown) => {
                apiRef.current = api as ExcalidrawApi;
              }}
              onChange={(elements: readonly unknown[]) => {
                setDirty(true);
                setHasElements(elements.length > 0);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Discard-confirm: shown when cancelling a dirty scene. */}
      <Dialog
        open={confirm === 'discard'}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('editor.excalidraw.discardTitle')}</DialogTitle>
            <DialogDescription>{t('editor.excalidraw.discardDescription')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t('editor.excalidraw.discardCancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirm(null);
                onClose();
              }}
            >
              {t('editor.excalidraw.discardConfirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete-confirm: edit mode only. */}
      <Dialog
        open={confirm === 'delete'}
        onOpenChange={(next) => {
          if (!next) setConfirm(null);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('editor.excalidraw.deleteModal')}</DialogTitle>
            <DialogDescription>{t('attachments.confirmDelete.description')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              {t('editor.excalidraw.discardCancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirm(null);
                onDelete?.();
              }}
            >
              {t('editor.excalidraw.deleteModal')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ExcalidrawDialog;
