import { MoreVertical } from 'lucide-react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
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
import { stripHtml } from '@/lib/utils.ts';
import type { Note } from '@/models.ts';

interface NoteCardProps {
  note: Note;
  onSelect: (id: string) => void;
}

// How many checklist items to preview on a card before we stop.
const CHECKLIST_PREVIEW_LIMIT = 4;

export const NoteCard: React.FC<NoteCardProps> = ({ note, onSelect }) => {
  const { t } = useTranslation();
  const { deleteNote, restoreNote } = useNoteActions();

  const hasBody = stripHtml(note.body).trim().length > 0;
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
      className="mb-4 w-full cursor-pointer break-inside-avoid shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
        {hasBody && (
          // Rendered rich-text preview, clamped. Self-authored HTML from our own
          // editor, so rendering it directly is acceptable at local-only scale.
          <div
            className="prose prose-sm line-clamp-6 max-w-none text-foreground"
            // biome-ignore lint/security/noDangerouslySetInnerHtml: preview of the note's own editor HTML
            dangerouslySetInnerHTML={{ __html: note.body ?? '' }}
          />
        )}

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
    </Card>
  );
};
