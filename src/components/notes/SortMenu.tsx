import { ArrowDownUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useNoteSearchState } from '@/hooks/useNoteSearchState.ts';
import {
  NOTE_SORT_DIRECTIONS,
  NOTE_SORT_FIELDS,
  type NoteSortDirection,
  type NoteSortField,
} from '@/lib/note-search-params.ts';

/**
 * Field and direction are separate choices, since "title" is as likely wanted Z→A as A→Z.
 * The same single-select `ToggleGroup` as the theme switcher, so the two behave alike.
 */
export function SortMenu() {
  const { t } = useTranslation();
  const { search, setSearch } = useNoteSearchState();

  return (
    <Popover>
      <IconTooltip label={t('notes.sort.label')}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="touch-target size-8"
            aria-label={t('notes.sort.label')}
          >
            <ArrowDownUp className="size-4" />
          </Button>
        </PopoverTrigger>
      </IconTooltip>
      <PopoverContent align="end" className="flex w-56 flex-col gap-3 p-3">
        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-muted-foreground text-xs">{t('notes.sort.byLabel')}</p>
          <ToggleGroup
            type="single"
            value={search.sort}
            // Radix clears the value when the active item is pressed again;
            // keeping the current one makes it behave like a radio group.
            onValueChange={(next) => setSearch({ sort: (next as NoteSortField) || search.sort })}
            variant="outline"
            size="sm"
            className="flex-col items-stretch"
            aria-label={t('notes.sort.byLabel')}
          >
            {NOTE_SORT_FIELDS.map((field) => (
              <ToggleGroupItem key={field} value={field} className="justify-start">
                {t(`notes.sort.field.${field}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="font-medium text-muted-foreground text-xs">{t('notes.sort.orderLabel')}</p>
          <ToggleGroup
            type="single"
            value={search.dir}
            onValueChange={(next) => setSearch({ dir: (next as NoteSortDirection) || search.dir })}
            variant="outline"
            size="sm"
            className="flex-col items-stretch"
            aria-label={t('notes.sort.orderLabel')}
          >
            {NOTE_SORT_DIRECTIONS.map((dir) => (
              <ToggleGroupItem key={dir} value={dir} className="justify-start">
                {/* Ascending means oldest-first for dates but A→Z for titles,
                    so the wording follows the field the user picked. */}
                {t(`notes.sort.dir.${search.sort === 'title' ? 'title' : 'date'}.${dir}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </PopoverContent>
    </Popover>
  );
}
