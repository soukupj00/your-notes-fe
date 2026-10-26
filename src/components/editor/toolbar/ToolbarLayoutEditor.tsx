import { ChevronLeft, Group, Ungroup } from 'lucide-react';
import { type ComponentType, type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { icons } from '@/components/icons';
import { Button } from '@/components/ui/button.tsx';
import { SortableList, SortableRow } from '@/components/ui/SortableList.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Toggle } from '@/components/ui/toggle.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { COMPACT_FOLD_SLOTS, foldIndex } from './foldMarker';
import { moveFamily, moveMember, setMemberOn, updateFamily } from './layoutEdits';
import { DEFAULT_PRESET, type ToolbarPresetId, toolbarPreset } from './presets';
import { getToolbarFamily, itemsInFamily, TOOLBAR_ITEMS } from './registry';
import { reconcileLayout } from './resolveLayout';
import { ToolbarPreviewStrip } from './ToolbarPreviewStrip';
import type { ToolbarFamilyPref, ToolbarLayout } from './types';
import { useWidthClass } from './useWidthClass';

const PRESETS: ToolbarPresetId[] = ['minimal', 'balanced', 'everything'];

/**
 * A titled block of the editor: a heading above its own card in Settings, a band in the sheet.
 * `bare` content is controls rather than rows, so Settings puts no card around it.
 */
type ToolbarEditorSection = ComponentType<{ title?: string; bare?: boolean; children: ReactNode }>;

export interface ToolbarLayoutEditorProps {
  /** On in Settings, which has no note open; off over the editor, whose real bar is live. */
  showPreview?: boolean;
  Section?: ToolbarEditorSection;
  /**
   * Settings keeps the open group in the URL, so Back closes it; without these the editor keeps
   * its own.
   */
  openFamilyId?: string | null;
  onOpenFamilyChange?: (id: string | null) => void;
}

/** The sheet's own title is its `<h2>`, so a band's heading is an `<h3>`. */
function SheetSection({
  title,
  bare,
  children,
}: {
  title?: string;
  bare?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="border-b last:border-b-0">
      {title && <h3 className="px-4 pt-3 font-medium text-muted-foreground text-xs">{title}</h3>}
      {bare ? <div className="px-4 py-3">{children}</div> : children}
    </section>
  );
}

/**
 * Mounted in Settings and over the editor (ADR 0011, decision 10). It edits the Layout of the
 * Width Class this screen is in, and writes straight through: the bar behind the sheet is the
 * preview.
 */
export function ToolbarLayoutEditor({
  showPreview,
  Section = SheetSection,
  openFamilyId: requestedFamilyId = null,
  onOpenFamilyChange,
}: ToolbarLayoutEditorProps) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const widthClass = useWidthClass();
  const [ownFamilyId, setOwnFamilyId] = useState<string | null>(null);
  const openFamilyId = onOpenFamilyChange ? requestedFamilyId : ownFamilyId;
  const setOpenFamilyId = onOpenFamilyChange ?? setOwnFamilyId;

  // Reconciled, because the stored blob may be empty or predate half the registry,
  // and the editor must show every family the user could turn on.
  const layout = reconcileLayout(preferences.toolbar[widthClass], widthClass);
  const write = (next: ToolbarLayout) =>
    setPreference('toolbar', { ...preferences.toolbar, [widthClass]: next });

  // A stamp, not a mode (decision 9): nothing remembers it, so there is no active state. One tap
  // wipes a hand-built layout, so the Undo is what makes it safe. It merges into what is stored
  // then, so it never touches the other Width Class.
  const reset = (preset: ToolbarPresetId) => {
    const before = preferences.toolbar[widthClass];
    void write(toolbarPreset(preset, widthClass));
    toast(t('settings.toolbar.reset.done', { preset: t(`settings.toolbar.preset.${preset}`) }), {
      action: {
        label: t('notes.undo'),
        onClick: () =>
          void setPreference('toolbar', (stored) => ({ ...stored, [widthClass]: before })),
      },
    });
  };

  const familyName = (id: string) => {
    const family = getToolbarFamily(id);
    return family ? t(family.labelKey) : id;
  };
  const itemName = (id: string) => t(TOOLBAR_ITEMS.find((item) => item.id === id)?.labelKey ?? id);

  const preview = showPreview && (
    <Section title={t('settings.toolbar.preview')} bare>
      <ToolbarPreviewStrip layout={layout} widthClass={widthClass} />
    </Section>
  );

  const openFamily = openFamilyId ? layout.find((entry) => entry.id === openFamilyId) : undefined;
  if (openFamily) {
    return (
      <>
        {preview}
        <Section>
          <div className="flex items-center gap-2 border-b p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 gap-1"
              onClick={() => setOpenFamilyId(null)}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t('settings.toolbar.back')}
            </Button>
            {/* The width is named here, or a leaf list is the easiest place to edit
              the wrong one of the two Layouts. Wrapped, never cut: the width moves down whole. */}
            <span className="ml-auto min-w-0 text-right text-muted-foreground text-xs">
              <span>{familyName(openFamily.id)} ·</span>{' '}
              <span className="whitespace-nowrap">{t(`settings.toolbar.width.${widthClass}`)}</span>
            </span>
          </div>
          <LeafList
            family={openFamily}
            nameOf={itemName}
            onReorder={(activeId, overId) =>
              write(moveMember(layout, openFamily.id, activeId, overId))
            }
            onToggle={(memberId, on) => write(setMemberOn(layout, openFamily.id, memberId, on))}
          />
        </Section>
      </>
    );
  }

  const fold = widthClass === 'compact' ? foldIndex(layout) : null;

  return (
    <>
      <Section title={t('settings.toolbar.preset.legend')} bare>
        <fieldset
          aria-label={t('settings.toolbar.preset.legend')}
          className="grid min-w-0 grid-cols-3 gap-2"
        >
          {PRESETS.map((preset) => (
            <Button
              key={preset}
              type="button"
              variant="outline"
              className="h-auto min-h-11 flex-col gap-0 whitespace-normal px-2 py-1.5 leading-tight"
              onClick={() => reset(preset)}
            >
              {t(`settings.toolbar.preset.${preset}`)}
              {preset === DEFAULT_PRESET[widthClass] && (
                <span className="font-normal text-muted-foreground text-xs">
                  {t('settings.toolbar.preset.isDefault')}
                </span>
              )}
            </Button>
          ))}
        </fieldset>
      </Section>

      {preview}

      <Section title={t('settings.toolbar.groups')}>
        <SortableList
          ids={layout.map((family) => family.id)}
          nameOf={familyName}
          onReorder={(activeId, overId) => write(moveFamily(layout, activeId, overId))}
        >
          <ul className="divide-y">
            {layout.map((family, index) => (
              <li key={family.id}>
                {index === fold && <FoldMarker />}
                <FamilyRow
                  family={family}
                  name={familyName(family.id)}
                  onOpen={() => setOpenFamilyId(family.id)}
                  onToggle={(on) => write(updateFamily(layout, family.id, { on }))}
                  onCollapse={(collapsed) => write(updateFamily(layout, family.id, { collapsed }))}
                />
              </li>
            ))}
          </ul>
        </SortableList>
      </Section>
    </>
  );
}

/** Where a 360px phone stops showing buttons: a marker, not a limit (`COMPACT_FOLD_SLOTS`). */
function FoldMarker() {
  const { t } = useTranslation();
  return (
    <p className="flex items-center gap-2 px-4 py-1 text-[0.7rem] text-muted-foreground uppercase tracking-wide">
      <span aria-hidden className="h-px flex-1 bg-border" />
      {/* `slots`, not `count`: `count` is i18next's plural selector, and this
          key has no plural forms to select. */}
      {t('settings.toolbar.fold', { slots: COMPACT_FOLD_SLOTS })}
      <span aria-hidden className="h-px flex-1 bg-border" />
    </p>
  );
}

interface FamilyRowProps {
  family: ToolbarFamilyPref;
  name: string;
  onOpen: () => void;
  onToggle: (on: boolean) => void;
  onCollapse: (collapsed: boolean) => void;
}

function FamilyRow({ family, name, onOpen, onToggle, onCollapse }: FamilyRowProps) {
  const { t } = useTranslation();
  const registryFamily = getToolbarFamily(family.id);
  // A stored family this build cannot render still holds the user's order, so it
  // keeps its row - but there is nothing honest to say about its contents.
  const Icon = registryFamily ? icons[registryFamily.icon] : null;
  const counts = {
    on: family.members.filter((member) => member.on).length,
    count: family.members.length,
  };

  return (
    <SortableRow id={family.id} handleLabel={t('dnd.handle', { name })}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!registryFamily}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:active:bg-accent enabled:hover:bg-accent disabled:opacity-60"
      >
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">{name}</span>
          {/* Short, so the name fits a phone in Czech; the sentence is for a screen reader. */}
          <span aria-hidden className="whitespace-nowrap text-muted-foreground text-xs">
            {t('settings.toolbar.family.count', { on: counts.on, total: counts.count })}
          </span>
          <span className="sr-only"> {t('settings.toolbar.family.summary', counts)}</span>
        </span>
      </button>

      {registryFamily?.collapsible ? (
        <Toggle
          size="sm"
          className="touch-target size-11"
          pressed={family.collapsed}
          onPressedChange={onCollapse}
          aria-label={t('settings.toolbar.family.collapse', { name })}
          title={t(
            family.collapsed
              ? 'settings.toolbar.family.collapsed'
              : 'settings.toolbar.family.expanded'
          )}
        >
          {family.collapsed ? (
            <Group className="size-4" aria-hidden />
          ) : (
            <Ungroup className="size-4" aria-hidden />
          )}
        </Toggle>
      ) : (
        <span aria-hidden className="size-11 shrink-0" />
      )}

      <Switch
        className="touch-reach mx-2"
        checked={family.on}
        onCheckedChange={onToggle}
        aria-label={t('settings.toolbar.family.show', { name })}
      />
    </SortableRow>
  );
}

interface LeafListProps {
  family: ToolbarFamilyPref;
  nameOf: (id: string) => string;
  onReorder: (activeId: string, overId: string) => void;
  onToggle: (memberId: string, on: boolean) => void;
}

/** Flat and single-level, so nested drag never exists. */
function LeafList({ family, nameOf, onReorder, onToggle }: LeafListProps) {
  const { t } = useTranslation();
  const registryFamily = getToolbarFamily(family.id);
  const items = registryFamily ? itemsInFamily(registryFamily.id) : [];

  return (
    <SortableList
      ids={family.members.map((member) => member.id)}
      nameOf={nameOf}
      onReorder={onReorder}
    >
      <ul className="divide-y">
        {family.members.map((member) => {
          const item = items.find((entry) => entry.id === member.id);
          const Icon = item ? icons[item.icon] : null;
          const name = nameOf(member.id);
          return (
            <li key={member.id}>
              <SortableRow id={member.id} handleLabel={t('dnd.handle', { name })}>
                <span className="flex min-h-11 flex-1 items-center gap-2 px-1">
                  {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                  <span className="truncate text-sm">{name}</span>
                </span>
                <Switch
                  className="touch-reach mx-2"
                  checked={member.on}
                  onCheckedChange={(next) => onToggle(member.id, next)}
                  aria-label={t('settings.toolbar.item.show', { name })}
                />
              </SortableRow>
            </li>
          );
        })}
      </ul>
    </SortableList>
  );
}

export default ToolbarLayoutEditor;
