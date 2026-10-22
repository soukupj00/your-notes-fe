import { Archive, ArchiveRestore, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import type { NoteState } from '@/models.ts';

interface LifecycleButtonsProps {
  state: NoteState;
  onArchive: () => void;
  onRestore: () => void;
  onTrash: () => void;
  className: string;
}

/**
 * Archive or restore, then trash: the same pair on a Card's rail and an open Note's bar. Clicks
 * stop here, so a Card does not also open its Note.
 */
export function LifecycleButtons({
  state,
  onArchive,
  onRestore,
  onTrash,
  className,
}: LifecycleButtonsProps) {
  const { t } = useTranslation();

  // Both leave through `restoreToActive`, but un-archiving and un-trashing are different
  // gestures, so each has its own icon.
  const isActive = state === 'active';
  const LeaveIcon = isActive ? Archive : state === 'archived' ? ArchiveRestore : RotateCcw;

  return (
    <>
      <IconTooltip label={t(isActive ? 'notes.archive' : 'notes.restore')}>
        <button
          type="button"
          aria-label={t(isActive ? 'notes.archive' : 'notes.restore')}
          onClick={(e) => {
            e.stopPropagation();
            if (isActive) onArchive();
            else onRestore();
          }}
          className={className}
        >
          <LeaveIcon className="size-4" aria-hidden />
        </button>
      </IconTooltip>

      {state !== 'trashed' && (
        <IconTooltip label={t('notes.moveToTrash')}>
          <button
            type="button"
            aria-label={t('notes.moveToTrash')}
            onClick={(e) => {
              e.stopPropagation();
              onTrash();
            }}
            className={className}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </IconTooltip>
      )}
    </>
  );
}
