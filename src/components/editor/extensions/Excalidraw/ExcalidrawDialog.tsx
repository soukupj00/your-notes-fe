import '@excalidraw/excalidraw/index.css';
import { Excalidraw } from '@excalidraw/excalidraw';
import { XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
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
              the bottom edge with its own mobile toolbar. */}
          <div className="min-h-0 flex-1">
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
