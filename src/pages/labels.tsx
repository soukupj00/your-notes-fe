import { ArrowDownUp, Combine, Palette, Plus } from 'lucide-react';
import type React from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { NoteColorPicker } from '@/components/color-picker/NoteColorPicker.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmDeleteButton } from '@/components/ui/ConfirmDeleteButton.tsx';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { SortableList, SortableRow } from '@/components/ui/SortableList.tsx';
import { Spinner } from '@/components/ui/Spinner.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useTagActions } from '@/hooks/data/useTagActions.ts';
import { useTagNoteCounts } from '@/hooks/data/useTagNoteCounts.ts';
import { useTags } from '@/hooks/data/useTags.ts';
import { useFocusOnMount } from '@/hooks/useFocusOnMount.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import type { ArrangeKind } from '@/lib/label-order.ts';
import { noteColorAttrs } from '@/lib/note-colors.ts';
import { cn } from '@/lib/utils.ts';
import type { Tag } from '@/models.ts';

const ARRANGE_KINDS: ArrangeKind[] = ['az', 'za', 'newest', 'oldest'];
const HIGHLIGHT_MS = 2000;

/** New-label row: the only place a label is created without going through a note. */
function CreateLabelRow({ onCreated }: { onCreated: (tag: Tag) => void }) {
  const { t } = useTranslation();
  const { createTag } = useTagActions();
  const [name, setName] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void createTag(name).then(onCreated);
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

/** The ⇅ menu: a one-off rewrite of the order, toasted with its undo. */
function ArrangeLabelsMenu() {
  const { t } = useTranslation();
  const { arrangeTags } = useTagActions();

  const arrange = async (kind: ArrangeKind) => {
    const undo = await arrangeTags(kind);
    toast(t(`labels.arrange.done_${kind}`), {
      action: { label: t('notes.undo'), onClick: () => void undo() },
    });
  };

  return (
    <DropdownMenu>
      <IconTooltip label={t('labels.arrange.label')}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t('labels.arrange.label')}
            className="aria-expanded:bg-accent"
          >
            <ArrowDownUp aria-hidden />
          </Button>
        </DropdownMenuTrigger>
      </IconTooltip>
      <DropdownMenuContent align="end" className="w-50">
        <DropdownMenuLabel>{t('labels.arrange.label')}</DropdownMenuLabel>
        {ARRANGE_KINDS.map((kind) => (
          <DropdownMenuItem key={kind} onClick={() => void arrange(kind)}>
            {t(`labels.arrange.${kind}`)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface LabelRowProps {
  tag: Tag;
  tags: Tag[];
  noteCount: number;
  justCreated: boolean;
}

/** One label: drag handle, colour, inline rename, note count, merge-into, delete. */
function LabelRow({ tag, tags, noteCount, justCreated }: LabelRowProps) {
  const { t } = useTranslation();
  const { updateTag, deleteTag, mergeTags } = useTagActions();
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState(tag.name);
  const [colorOpen, setColorOpen] = useState(false);
  const [mergeTarget, setMergeTarget] = useState<Tag | null>(null);
  // A merge rewrites every note link for the label, so it is the one action here
  // that can visibly take a moment on a large database.
  const [merging, setMerging] = useState(false);

  const others = tags.filter((other) => other.id !== tag.id);

  const scrollIntoViewIfNew = useCallback(
    (row: HTMLLIElement | null) => {
      if (justCreated) row?.scrollIntoView({ block: 'nearest' });
    },
    [justCreated]
  );

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
    <li ref={scrollIntoViewIfNew} data-just-created={justCreated || undefined}>
      <SortableRow
        id={tag.id}
        handleLabel={t('labels.dragHandle', { name: tag.name })}
        handleClassName="text-foreground/60 [&_svg]:size-5"
        className={cn(
          'gap-1 py-2 pr-1 pl-1 sm:pr-3',
          justCreated && 'bg-primary/15',
          !reducedMotion && 'transition-colors duration-700'
        )}
      >
        <Popover open={colorOpen} onOpenChange={setColorOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={t('labels.color', { name: tag.name })}
              {...noteColorAttrs(tag.color)}
              className="touch-reach m-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-note-swatch-ring bg-note-swatch text-muted-foreground transition-shadow hover:ring-2 hover:ring-ring/50 hover:ring-offset-1 hover:ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {!tag.color && <Palette className="size-4" aria-hidden />}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <NoteColorPicker
              value={tag.color}
              onChange={(color) => void updateTag(tag.id, { color })}
              onEscape={() => setColorOpen(false)}
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
          className="h-8 min-w-0 border-transparent bg-transparent px-2.5 shadow-none hover:border-input focus-visible:border-input sm:px-3 dark:bg-transparent"
        />

        <span className="shrink-0 px-1.5 text-muted-foreground text-sm tabular-nums">
          <span aria-hidden className="sm:hidden">
            {noteCount}
          </span>
          <span className="sr-only sm:not-sr-only">
            {t('labels.noteCount', { count: noteCount })}
          </span>
        </span>

        {others.length > 0 && (
          <DropdownMenu>
            <IconTooltip label={t('labels.mergeInto')}>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={merging}
                  aria-label={merging ? t('labels.merging') : t('labels.mergeInto')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {merging ? <Spinner /> : <Combine aria-hidden />}
                </Button>
              </DropdownMenuTrigger>
            </IconTooltip>
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
          triggerClassName="touch-target size-9 rounded-md"
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
            if (!mergeTarget) return;
            setMerging(true);
            void mergeTags(tag.id, mergeTarget.id).finally(() => setMerging(false));
          }}
        />
      </SortableRow>
    </li>
  );
}

/** Manage-labels view (`/labels`): create, order, rename, colour, merge, delete. */
export default function LabelsPage() {
  const { t } = useTranslation();
  const headingRef = useFocusOnMount<HTMLHeadingElement>();
  const tags = useTags();
  const noteCounts = useTagNoteCounts();
  const { moveTag } = useTagActions();
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const highlight = (tag: Tag) => {
    setJustCreated(tag.id);
    clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setJustCreated(null), HIGHLIGHT_MS);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Visible on desktop, carried by the topbar on mobile - see the same
          heading in `settings.tsx` for why it stays in the DOM regardless. */}
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="sr-only sm:not-sr-only sm:mb-6 sm:font-semibold sm:text-2xl sm:focus-visible:outline-none"
      >
        {t('nav.labels')}
      </h1>

      <CreateLabelRow onCreated={highlight} />

      {tags.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t('labels.empty')}</p>
      ) : (
        <>
          <div className="mb-2.5 flex items-center justify-between text-muted-foreground text-sm">
            <span>{t('labels.count', { count: tags.length })}</span>
            <ArrangeLabelsMenu />
          </div>
          <SortableList
            ids={tags.map((tag) => tag.id)}
            nameOf={(id) => tags.find((tag) => tag.id === id)?.name ?? ''}
            onReorder={(activeId, overId) => void moveTag(activeId, overId)}
          >
            <ul className="divide-y rounded-lg border bg-card [&>li:first-child>*]:rounded-t-lg [&>li:last-child>*]:rounded-b-lg">
              {tags.map((tag) => (
                <LabelRow
                  key={tag.id}
                  tag={tag}
                  tags={tags}
                  noteCount={noteCounts[tag.id] ?? 0}
                  justCreated={tag.id === justCreated}
                />
              ))}
            </ul>
          </SortableList>
        </>
      )}
    </div>
  );
}
