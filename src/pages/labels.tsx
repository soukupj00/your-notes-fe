import { Palette, Plus } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NoteColorPicker } from '@/components/color-picker/NoteColorPicker.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { useTagActions } from '@/hooks/data/useTagActions.ts';
import { useTags } from '@/hooks/data/useTags.ts';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';
import { noteColorStyle } from '@/lib/note-colors.ts';
import type { Tag } from '@/models.ts';

/** New-label row: the only place a label is created without going through a note. */
function CreateLabelRow() {
  const { t } = useTranslation();
  const { createTag } = useTagActions();
  const [name, setName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void createTag(name);
    setName('');
  };

  return (
    <form onSubmit={submit} className="mb-4 flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t('labels.namePlaceholder')}
        aria-label={t('labels.namePlaceholder')}
      />
      <Button type="submit" variant="outline" disabled={!name.trim()} className="gap-1">
        <Plus className="size-4" aria-hidden />
        {t('labels.create')}
      </Button>
    </form>
  );
}

/** One label: colour, inline rename, merge-into, delete. */
function LabelRow({ tag, tags }: { tag: Tag; tags: Tag[] }) {
  const { t } = useTranslation();
  const { updateTag, deleteTag, mergeTags } = useTagActions();
  const [name, setName] = useState(tag.name);
  const [mergeTarget, setMergeTarget] = useState<Tag | null>(null);

  const others = tags.filter((other) => other.id !== tag.id);

  // Rename commits on blur/Enter; an emptied field snaps back rather than
  // leaving a nameless label behind.
  const commitName = () => {
    if (name.trim() && name.trim() !== tag.name) {
      void updateTag(tag.id, { name });
    } else {
      setName(tag.name);
    }
  };

  return (
    <li className="flex items-center gap-2 px-3 py-2">
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={t('labels.color', { name: tag.name })}
            style={noteColorStyle(tag.color)}
            className="flex size-7 shrink-0 items-center justify-center rounded-full border text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {!tag.color && <Palette className="size-4" aria-hidden />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-2">
          <NoteColorPicker
            value={tag.color}
            onChange={(color) => void updateTag(tag.id, { color })}
          />
        </PopoverContent>
      </Popover>

      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setName(tag.name);
        }}
        aria-label={t('labels.rename', { name: tag.name })}
        className="h-8 border-transparent bg-transparent hover:border-input focus-visible:border-input"
      />

      {others.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="shrink-0">
              {t('labels.merge')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {others.map((other) => (
              <DropdownMenuItem key={other.id} onClick={() => setMergeTarget(other)}>
                {other.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <ConfirmDeleteButton
        onConfirm={() => void deleteTag(tag.id)}
        label={t('labels.delete', { name: tag.name })}
        title={t('labels.confirmDelete.title')}
        description={t('labels.confirmDelete.description')}
        confirmLabel={t('labels.confirmDelete.confirm')}
        cancelLabel={t('labels.confirmDelete.cancel')}
      />

      {/* Merge deletes the source label, so it asks first - and names both
          sides, since which one survives is the whole question. */}
      <ConfirmDialog
        open={mergeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMergeTarget(null);
        }}
        title={t('labels.confirmMerge.title')}
        description={t('labels.confirmMerge.description', {
          source: tag.name,
          target: mergeTarget?.name ?? '',
        })}
        confirmLabel={t('labels.confirmMerge.confirm')}
        cancelLabel={t('labels.confirmMerge.cancel')}
        onConfirm={() => {
          if (mergeTarget) void mergeTags(tag.id, mergeTarget.id);
        }}
      />
    </li>
  );
}

/** Manage-labels view (`/settings/labels`): create, rename, colour, merge, delete. */
export default function LabelsPage() {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const tags = useTags();

  return (
    <div className="mx-auto max-w-2xl">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="mb-6 font-semibold text-2xl focus-visible:outline-none"
      >
        {t('nav.labels')}
      </h1>

      <CreateLabelRow />

      {tags.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('labels.empty')}</p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {tags.map((tag) => (
            <LabelRow key={tag.id} tag={tag} tags={tags} />
          ))}
        </ul>
      )}
    </div>
  );
}
