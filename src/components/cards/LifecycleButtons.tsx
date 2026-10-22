import { Archive, ArchiveRestore, type LucideIcon, RotateCcw, Trash2 } from 'lucide-react';
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
 * The lifecycle pair on a Card's rail and an open Note's bar: archive or restore, then trash; in
 * the trash, restore then archive. Clicks stop here, so a Card does not also open its Note.
 */
export function LifecycleButtons({
  state,
  onArchive,
  onRestore,
  onTrash,
  className,
}: LifecycleButtonsProps) {
  const { t } = useTranslation();

  const button = (label: string, Icon: LucideIcon, onPress: () => void) => (
    <IconTooltip label={label}>
      <button
        type="button"
        aria-label={label}
        onClick={(e) => {
          e.stopPropagation();
          onPress();
        }}
        className={className}
      >
        <Icon className="size-4" aria-hidden />
      </button>
    </IconTooltip>
  );

  const archive = button(t('notes.archive'), Archive, onArchive);
  const trash = button(t('notes.moveToTrash'), Trash2, onTrash);

  // Both restores leave through `restoreToActive`, but un-archiving and un-trashing are
  // different gestures, so each has its own icon.
  if (state === 'active') {
    return (
      <>
        {archive}
        {trash}
      </>
    );
  }
  const restoreIcon = state === 'archived' ? ArchiveRestore : RotateCcw;
  return (
    <>
      {button(t('notes.restore'), restoreIcon, onRestore)}
      {state === 'archived' ? trash : archive}
    </>
  );
}
