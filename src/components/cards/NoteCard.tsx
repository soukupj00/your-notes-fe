import { MoreVertical } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CardMedia } from '@/components/cards/CardMedia.tsx';
import { CardPin } from '@/components/cards/CardPin.tsx';
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
import { stripAttachmentNodes } from '@/lib/note-attachments.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { cn, stripHtml } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

interface NoteCardProps {
  note: Note;
  onSelect: (id: string, opts?: { autoplayFirstAudio?: boolean }) => void;
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
  const liveTags = useTagsForNote(note.id);
  const tags = note.tags ?? liveTags;

  // Attachments are summarised by CardMedia, so the text preview renders the
  // prose only - otherwise an image-heavy note would show each attachment twice
  // and push its own words off the bottom of the clamp.
  const prose = stripAttachmentNodes(note.body);
  const hasProse = stripHtml(prose).trim().length > 0;

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

      {/* Outside the content layer so it stacks above the media too - the pin is
          never occluded by an attachment. Only shown for a note that can be
          pinned: pinning is meaningless in the archive and the trash. */}
      {note.state === 'active' && (
        <CardPin
          pinned={Boolean(note.pinnedAt)}
          onToggle={note.pinnedAt ? handleUnpin : handlePin}
        />
      )}

      <div className="relative z-10 p-[0.9rem_1rem_0.85rem]">
        {/* Above the title, as in the lab: what a note *looks* like is the
            fastest way to recognise it again in a wall. */}
        <CardMedia noteId={note.id} body={note.body} onOpen={(opts) => onSelect(note.id, opts)} />

        {note.header ? (
          <h2
            dir="auto"
            /* pe-8 reserves the pin's corner so a long title never runs under
               it. Reserved rather than revealed: the card's height must not
               change when the pointer arrives. */
            className="mb-1.5 line-clamp-3 min-w-0 max-w-full text-pretty break-words pe-8 font-display text-foreground text-title [overflow-wrap:anywhere]"
          >
            {note.header}
          </h2>
        ) : (
          <span className="sr-only">{t('notes.editNoteTitle')}</span>
        )}

        {hasProse && (
          <NoteBody
            html={prose}
            className="line-clamp-6 min-w-0 max-w-full break-words text-body text-foreground [overflow-wrap:anywhere] [&_*]:max-w-full [&_li]:text-body [&_p]:text-body"
          />
        )}

        {/* Foot rail A from DESIGN.md. Labels get the flexible side; controls
            keep their real 44px hit areas and wrap below rather than squeezing
            the note's scarce horizontal axis. */}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <TagPills tags={tags} maxVisible={3} className="mr-auto min-w-0" />

          <div className="ml-auto flex shrink-0 items-center gap-0.5">
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
