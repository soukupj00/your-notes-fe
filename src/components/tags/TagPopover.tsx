import { Check, Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { cn } from '@/lib/utils.ts';
import type { Tag } from '@/models.ts';

/**
 * One row of the list: a real checkbox wrapped in its label, so the whole row
 * is one hit target with native keyboard and label-click behaviour.
 *
 * Not the shared `ui/checkbox`: Radix renders that as a `<button>`, which a
 * `<label>` cannot activate natively - the row's text would be dead to clicks.
 * The input is visually hidden and a styled span stands in, so it still looks
 * like every other checkbox in the app.
 */
function TagCheckbox({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex w-full cursor-pointer items-center gap-2 rounded-md px-1 py-1.5 text-sm hover:bg-accent">
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
          checked && 'border-primary bg-primary text-primary-foreground'
        )}
      >
        {checked && <Check className="size-3.5" />}
      </span>
      <span className="truncate">{label}</span>
    </label>
  );
}

type TagPopoverProps = {
  /** Every existing tag, unfiltered. */
  tags: Tag[];
  /** Ids of the tags currently on the note. */
  assignedIds: Set<string>;
  onToggle: (tag: Tag) => void;
  /** Create-on-the-fly, then assign. Only offered when the name is unused. */
  onCreate: (name: string) => void;
  /** Custom trigger (e.g. a menu item on the card). Defaults to a "＋ Label" button. */
  trigger?: ReactNode;
};

/**
 * The one label-assignment surface: filter the existing tags, tick the ones
 * that belong on this note, or create a new one from whatever you typed.
 *
 * Presentational on purpose - it holds only the filter text. Data and
 * persistence live in `NoteTagsBar`, so the card's `⋮` menu can mount the same
 * popover against the same handlers.
 */
export function TagPopover({ tags, assignedIds, onToggle, onCreate, trigger }: TagPopoverProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const trimmed = query.trim();
  const lower = trimmed.toLowerCase();
  const filtered = trimmed ? tags.filter((tag) => tag.name.toLowerCase().includes(lower)) : tags;
  // Creating is only offered when the typed name isn't already a tag - matching
  // `createTag`, which returns the existing tag rather than a case-variant copy.
  const canCreate = trimmed !== '' && !tags.some((tag) => tag.name.toLowerCase() === lower);

  const create = () => {
    onCreate(trimmed);
    setQuery('');
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <Plus className="size-4" aria-hidden />
            {t('tags.add')}
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-2 p-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && canCreate) {
              e.preventDefault();
              create();
            }
          }}
          placeholder={t('tags.filterPlaceholder')}
          aria-label={t('tags.filterPlaceholder')}
          className="h-8"
        />

        <ul className="max-h-56 space-y-px overflow-y-auto">
          {filtered.map((tag) => (
            <li key={tag.id}>
              <TagCheckbox
                label={tag.name}
                checked={assignedIds.has(tag.id)}
                onToggle={() => onToggle(tag)}
              />
            </li>
          ))}
        </ul>

        {canCreate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={create}
            className="w-full justify-start gap-2"
          >
            <Plus className="size-4" aria-hidden />
            <span className="truncate">{t('tags.create', { name: trimmed })}</span>
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
