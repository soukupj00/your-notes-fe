import { FileText, MoreVertical, Play, Video } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { NoteBody } from '@/components/NoteBody.tsx';
import { Card, CardContent, CardHeader } from '@/components/ui/card.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Separator } from '@/components/ui/separator.tsx';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
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

// How many checklist items to preview on a card before we stop.
const CHECKLIST_PREVIEW_LIMIT = 4;

export const NoteCard: React.FC<NoteCardProps> = ({ note, onSelect }) => {
  const { t } = useTranslation();
  const { deleteNote, restoreNote } = useNoteActions();

  // stripHtml drops the <img data-attachment-id> tag along with the rest of the
  // markup, so an image-only Body (no text) needs the attachment check too -
  // otherwise the card renders blank (no header, no NoteBody, no checklist).
  const hasBody = stripHtml(note.body).trim().length > 0 || bodyHasAttachment(note.body);
  const hasAudio = bodyHasAudio(note.body);
  const hasVideo = bodyHasVideo(note.body);
  const hasFile = bodyHasFile(note.body);
  const checklist = note.checklist ?? [];

  const handleDelete = async () => {
    const removed = await deleteNote(note.id);
    toast(t('notes.deleted'), {
      action: {
        label: t('notes.undo'),
        onClick: () => restoreNote(note, removed),
      },
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
        // Delete) would also open the editor.
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
            className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              {t('notes.delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent className="space-y-3">
        {hasBody && <NoteBody html={note.body} className="line-clamp-6" />}

        {checklist.length > 0 && (
          <div>
            {hasBody && <Separator className="my-2" />}
            <ul className="space-y-1">
              {checklist.slice(0, CHECKLIST_PREVIEW_LIMIT).map((item, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: read-only, unreordered preview; checklist items are plain strings with no stable id (revisit when checklist editing lands)
                <li key={index} className="flex items-center gap-2">
                  <Checkbox disabled aria-hidden />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
              {checklist.length > CHECKLIST_PREVIEW_LIMIT && (
                <li className="text-muted-foreground text-xs">
                  +{checklist.length - CHECKLIST_PREVIEW_LIMIT}
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>

      {/* Always-visible audio/video/file affordances: pinned bottom-right, in a
          flex row so all three coexist without overlapping. They survive the
          card's line-clamp even on long notes. Audio opens the note and
          autoplays its first audio (same intent the old inline chip carried);
          video and file just open the note - no autoplay. */}
      {(hasAudio || hasVideo || hasFile) && (
        <div className="absolute right-2 bottom-2 z-10 flex gap-2">
          {hasAudio && (
            <button
              type="button"
              aria-label={t('notes.playAudio')}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(note.id, { autoplayFirstAudio: true });
              }}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Play className="size-5 translate-x-px" />
            </button>
          )}
          {hasVideo && (
            <button
              type="button"
              aria-label={t('notes.playVideo')}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(note.id);
              }}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Video className="size-5" />
            </button>
          )}
          {hasFile && (
            <button
              type="button"
              aria-label={t('notes.openFile')}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(note.id);
              }}
              className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileText className="size-5" />
            </button>
          )}
        </div>
      )}
    </Card>
  );
};
