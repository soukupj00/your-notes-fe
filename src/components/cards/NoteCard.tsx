import { FileText, MoreVertical, Play, Video } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { NoteBody } from '@/components/NoteBody.tsx';
import { TagPills } from '@/components/tags/TagPills.tsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { type LifecycleSnapshot, useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useTagsForNote } from '@/hooks/data/useTagsForNote.ts';
import {
  bodyHasAttachment,
  bodyHasAudio,
  bodyHasFile,
  bodyHasVideo,
} from '@/lib/attachment-html.ts';
import { stripHtml } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

interface NoteCardProps {
  note: Note;
  onSelect: (id: string, opts?: { autoplayFirstAudio?: boolean }) => void;
}

interface NoteCardAttachmentButtonProps {
  label: string;
  onActivate: () => void;
  children: React.ReactNode;
}

/** A media affordance nested inside the clickable card surface. */
function NoteCardAttachmentButton({ label, onActivate, children }: NoteCardAttachmentButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
      className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onSelect }) => {
  const { t } = useTranslation();
  const {
    purgeNote,
    restoreNote,
    revertLifecycle,
    pinNote,
    unpinNote,
    archiveNote,
    trashNote,
    restoreToActive,
  } = useNoteActions();
  const tags = useTagsForNote(note.id);

  // stripHtml drops the <img data-attachment-id> tag along with the rest of the
  // markup, so an image-only Body (no text) needs the attachment check too -
  // otherwise the card renders blank (no header, no NoteBody).
  const hasBody = stripHtml(note.body).trim().length > 0 || bodyHasAttachment(note.body);
  const hasAudio = bodyHasAudio(note.body);
  const hasVideo = bodyHasVideo(note.body);
  const hasFile = bodyHasFile(note.body);

  // Every lifecycle action follows the same contract: run the transition, then
  // offer its snapshot back as a one-click undo. Sharing the wrapper keeps a
  // new action from shipping without an undo.
  const withUndo =
    (run: (id: string) => Promise<LifecycleSnapshot | null>, message: string) => async () => {
      const before = await run(note.id);
      if (!before) return;
      toast(message, {
        action: { label: t('notes.undo'), onClick: () => revertLifecycle(note.id, before) },
      });
    };

  const handlePin = withUndo(pinNote, t('notes.pinned'));
  const handleUnpin = withUndo(unpinNote, t('notes.unpinned'));
  const handleArchive = withUndo(archiveNote, t('notes.archived'));
  const handleTrash = withUndo(trashNote, t('notes.movedToTrash'));
  const handleRestore = withUndo(restoreToActive, t('notes.restored'));

  // Purge is the one irreversible action, so its undo works differently: it
  // re-puts the captured note plus the rows the cascade removed.
  const handlePurge = async () => {
    const removed = await purgeNote(note.id);
    toast(t('notes.deletedForever'), {
      action: { label: t('notes.undo'), onClick: () => restoreNote(note, removed) },
    });
  };

  const open = () => onSelect(note.id);

  return (
    <Card
      // Not a <button>: the card contains a menu trigger, and nesting
      // interactive elements is invalid/inaccessible. A role="button" div with
      // keyboard handling keeps the whole card clickable without the nesting.
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        // Only activate when the key originated on the card itself. React
        // synthetic events bubble through the portalled dropdown menu, so
        // without this an Enter/Space on the menu trigger or a menu item (e.g.
        // Move to trash) would also open the editor.
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      className="relative mb-4 w-full cursor-pointer break-inside-avoid shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        {note.header ? (
          <h2 className="font-semibold text-lg leading-tight">{note.header}</h2>
        ) : (
          <span className="sr-only">{t('notes.editNoteTitle')}</span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t('notes.menu')}
            onClick={(e) => e.stopPropagation()}
            className="-mt-1 -mr-1 ml-auto shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          {/* The menu is state-aware: a trashed note offers recovery and
              permanent deletion, everything else offers the forward moves. */}
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {note.state === 'trashed' ? (
              <>
                <DropdownMenuItem onClick={handleRestore}>{t('notes.restore')}</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handlePurge}
                  className="text-destructive focus:text-destructive"
                >
                  {t('notes.deleteForever')}
                </DropdownMenuItem>
              </>
            ) : (
              <>
                {note.state === 'active' &&
                  (note.pinnedAt ? (
                    <DropdownMenuItem onClick={handleUnpin}>{t('notes.unpin')}</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={handlePin}>{t('notes.pin')}</DropdownMenuItem>
                  ))}
                {note.state === 'archived' ? (
                  <DropdownMenuItem onClick={handleRestore}>{t('notes.restore')}</DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleArchive}>{t('notes.archive')}</DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleTrash}
                  className="text-destructive focus:text-destructive"
                >
                  {t('notes.moveToTrash')}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-3">
        {hasBody && <NoteBody html={note.body} className="line-clamp-6" />}
        {/* Read-only here: labels are changed from the editor (and, in Slice 4,
            the card's own overflow menu). */}
        <TagPills tags={tags} />
      </CardContent>

      {/* Always-visible audio/video/file affordances: pinned bottom-right, in a
          flex row so all three coexist without overlapping. They survive the
          card's line-clamp even on long notes. Audio opens the note and
          autoplays its first audio (same intent the old inline chip carried);
          video and file just open the note - no autoplay. */}
      {(hasAudio || hasVideo || hasFile) && (
        <div className="absolute right-2 bottom-2 z-10 flex gap-2">
          {hasAudio && (
            <NoteCardAttachmentButton
              label={t('notes.playAudio')}
              onActivate={() => onSelect(note.id, { autoplayFirstAudio: true })}
            >
              <Play className="size-5 translate-x-px" />
            </NoteCardAttachmentButton>
          )}
          {hasVideo && (
            <NoteCardAttachmentButton
              label={t('notes.playVideo')}
              onActivate={() => onSelect(note.id)}
            >
              <Video className="size-5" />
            </NoteCardAttachmentButton>
          )}
          {hasFile && (
            <NoteCardAttachmentButton
              label={t('notes.openFile')}
              onActivate={() => onSelect(note.id)}
            >
              <FileText className="size-5" />
            </NoteCardAttachmentButton>
          )}
        </div>
      )}
    </Card>
  );
};
