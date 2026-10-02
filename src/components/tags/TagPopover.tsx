import { Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { Input } from '@/components/ui/input.tsx';
import { LabeledCheckbox } from '@/components/ui/LabeledCheckbox.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import type { Tag } from '@/models.ts';

type TagPopoverProps = {
  /** Every existing tag, unfiltered. */
  tags: Tag[];
  assignedIds: Set<string>;
  onToggle: (tag: Tag) => void;
  /** Create-on-the-fly, then assign. Only offered when the name is unused. */
  onCreate: (name: string) => void;
  /** Defaults to a "＋ Label" button. */
  trigger?: ReactNode;
};

/** Presentational on purpose: it holds only the filter text, and `NoteTagsBar` owns the data. */
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
    /*
     * `modal` is load-bearing: the editor Dialog's `react-remove-scroll` blocks the wheel outside
     * its subtree, and this portals to `body`. Modal registers its content as a scrollable shard.
     */
    <Popover modal>
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
              <LabeledCheckbox
                label={tag.name}
                checked={assignedIds.has(tag.id)}
                onToggle={() => onToggle(tag)}
                className="w-full rounded-md px-1 py-1.5 hover:bg-accent"
                labelClassName="truncate"
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
