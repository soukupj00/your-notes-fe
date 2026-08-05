import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CardActions } from '@/components/cards/CardActions.tsx';
import { CardMedia } from '@/components/cards/CardMedia.tsx';
import { CardPin } from '@/components/cards/CardPin.tsx';
import { NoteBody } from '@/components/NoteBody.tsx';
import { TagPills } from '@/components/tags/TagPills.tsx';
import { Card } from '@/components/ui/card.tsx';
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
    updateNote,
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
            /* pe-9 reserves the pin's corner so a long title never runs under
               it. Reserved rather than revealed: the card's height must not
               change when the pointer arrives. */
            className="wrap-break-word mb-1.5 line-clamp-3 min-w-0 max-w-full text-pretty pe-9 font-display text-foreground text-title"
          >
            {note.header}
          </h2>
        ) : (
          <span className="sr-only">{t('notes.editNoteTitle')}</span>
        )}

        {hasProse && (
          <NoteBody
            html={prose}
            // A preview's checkboxes are a picture of the note, not a control:
            // the card opens the note, and a tick that toggled here would be a
            // tick that never got saved.
            className="wrap-anywhere line-clamp-6 min-w-0 max-w-full text-body text-foreground [&_*]:max-w-full [&_input]:pointer-events-none [&_li]:text-body [&_p]:text-body"
          />
        )}

        {/* Foot rail A from DESIGN.md. Labels get the flexible side; controls
            keep their real 44px hit areas and wrap below rather than squeezing
            the note's scarce horizontal axis. The rail owns its own `ml-auto`,
            which is what keeps it right-aligned on a note with no labels at
            all, so the pills do not need a matching `mr-auto`. */}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <TagPills tags={tags} maxVisible={3} className="min-w-0" />

          <CardActions
            note={note}
            onArchive={handleArchive}
            onRestore={handleRestore}
            onTrash={handleTrash}
            onColorChange={(color) => void updateNote(note.id, { color })}
          />
        </div>
      </div>
    </Card>
  );
};
