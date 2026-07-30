import { FileText, MoreVertical, Play, Video } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { NoteBody } from '@/components/NoteBody.tsx';
import { TagPills } from '@/components/tags/TagPills.tsx';
import { Card } from '@/components/ui/card.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { type LifecycleSnapshot, useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useTagsForNote } from '@/hooks/data/useTagsForNote.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import {
  bodyHasAttachment,
  bodyHasAudio,
  bodyHasFile,
  bodyHasVideo,
} from '@/lib/attachment-html.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { cn, stripHtml } from '@/lib/utils.ts';
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
  const reducedMotion = useReducedMotion();

  return (
    <button
      type="button"
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onActivate();
      }}
      className={cn(
        'flex size-11 items-center justify-center rounded-control bg-note-chip text-note-on-chip shadow-rest hover:shadow-note-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        !reducedMotion &&
          'transition-[background-color,color,box-shadow,transform] hover:scale-[1.04]'
      )}
    >
      {children}
    </button>
  );
}

export const NoteCard: React.FC<NoteCardProps> = ({ note, onSelect }) => {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
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
      {...noteColorAttrs(note.color)}
      data-pinned={note.pinnedAt ? '' : undefined}
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
      className="group relative isolate w-full cursor-pointer break-inside-avoid gap-0 rounded-card border-0 bg-transparent py-0 text-card-foreground shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {/* Only this material layer scales. Keeping text and media off the
          transformed layer prevents Chromium from bitmap-stretching them. */}
      <div
        data-slot="note-card-surface"
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-0 z-0 rounded-card border border-note-border bg-note-surface shadow-note group-hover:border-note-border-hover group-hover:shadow-note-lift',
          !reducedMotion &&
            'transition-[transform,border-color,box-shadow] duration-200 group-hover:scale-[1.02]'
        )}
      />

      <div className="relative z-10 p-[0.9rem_1rem_0.85rem]">
        {note.header ? (
          <h2 dir="auto" className="mb-1.5 font-display text-foreground text-title">
            {note.header}
          </h2>
        ) : (
          <span className="sr-only">{t('notes.editNoteTitle')}</span>
        )}

        {hasBody && (
          <NoteBody
            html={note.body}
            className="line-clamp-6 text-body text-foreground [&_li]:text-body [&_p]:text-body"
          />
        )}

        {/* Foot rail A from DESIGN.md. Labels get the flexible side; controls
            keep their real 44px hit areas and wrap below rather than squeezing
            the note's scarce horizontal axis. */}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <TagPills tags={tags} className="mr-auto min-w-0" />

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
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

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label={t('notes.menu')}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'flex size-11 shrink-0 items-center justify-center rounded-control text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-rest focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                  !reducedMotion &&
                    'transition-[background-color,color,box-shadow,transform] hover:scale-[1.04]'
                )}
              >
                <MoreVertical className="size-4" />
              </DropdownMenuTrigger>
              {/* The menu is state-aware: a trashed note offers recovery and
                  permanent deletion, everything else offers the forward moves. */}
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                {note.state === 'trashed' ? (
                  <>
                    <DropdownMenuItem onClick={handleRestore}>
                      {t('notes.restore')}
                    </DropdownMenuItem>
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
                        <DropdownMenuItem onClick={handleUnpin}>
                          {t('notes.unpin')}
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={handlePin}>{t('notes.pin')}</DropdownMenuItem>
                      ))}
                    {note.state === 'archived' ? (
                      <DropdownMenuItem onClick={handleRestore}>
                        {t('notes.restore')}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={handleArchive}>
                        {t('notes.archive')}
                      </DropdownMenuItem>
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
          </div>
        </div>
      </div>
    </Card>
  );
};
