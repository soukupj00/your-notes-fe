import { ChevronLeft, ChevronRight, Group, Ungroup } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { icons } from '@/components/icons';
import { Button } from '@/components/ui/button.tsx';
import { SortableList, SortableRow } from '@/components/ui/SortableList.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Toggle } from '@/components/ui/toggle.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { COMPACT_FOLD_SLOTS, foldIndex } from './foldMarker';
import { moveFamily, moveMember, setMemberOn, updateFamily } from './layoutEdits';
import { type ToolbarPresetId, toolbarPreset } from './presets';
import { getToolbarFamily, itemsInFamily, TOOLBAR_ITEMS } from './registry';
import { reconcileLayout } from './resolveLayout';
import { ToolbarPreviewStrip } from './ToolbarPreviewStrip';
import type { ToolbarFamilyPref, ToolbarLayout, WidthClass } from './types';
import { useWidthClass } from './useWidthClass';

const WIDTH_CLASSES: WidthClass[] = ['compact', 'wide'];
const PRESETS: ToolbarPresetId[] = ['minimal', 'balanced', 'everything'];

interface ToolbarLayoutEditorProps {
  /**
   * Which Layout opens first. Defaults to the window's own Width Class, which is
   * the one the user is looking at while they edit.
   */
  initialWidthClass?: WidthClass;
  /**
   * Draw a static picture of the resulting bar above the list.
   *
   * On in Settings, which has no note open; off in the sheet over the editor,
   * where the real bar is a few pixels away and updating live - a second,
   * lesser copy of it there would be noise.
   */
  showPreview?: boolean;
}

/**
 * The one editor for a Toolbar Layout, mounted both in Settings and in the sheet
 * over the editor dialog (ADR 0011, decision 10).
 *
 * It edits **one Width Class at a time** rather than one list with overflow
 * rules: a phone and a desktop want different bars, and a single list would have
 * to guess which one an edit meant.
 *
 * Every change writes straight through to the stored blob. There is no draft and
 * no Save: the bar behind the sheet is the preview, and a settings screen that
 * could be abandoned half-applied would need a discard prompt for a decision
 * nobody is making.
 */
export function ToolbarLayoutEditor({ initialWidthClass, showPreview }: ToolbarLayoutEditorProps) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const windowWidthClass = useWidthClass();
  const [widthClass, setWidthClass] = useState<WidthClass>(initialWidthClass ?? windowWidthClass);
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);

  // Reconciled rather than raw: the stored blob may be empty (never customised)
  // or predate half the registry, and the editor has to show every family the
  // user could turn on, not only the ones they have already met.
  const layout = reconcileLayout(preferences.toolbar[widthClass], widthClass);
  const write = (next: ToolbarLayout) =>
    setPreference('toolbar', { ...preferences.toolbar, [widthClass]: next });

  const familyName = (id: string) => {
    const family = getToolbarFamily(id);
    return family ? t(family.labelKey) : id;
  };
  const itemName = (id: string) => t(TOOLBAR_ITEMS.find((item) => item.id === id)?.labelKey ?? id);

  const openFamily = openFamilyId ? layout.find((entry) => entry.id === openFamilyId) : undefined;
  if (openFamily) {
    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b p-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setOpenFamilyId(null)}
          >
            <ChevronLeft className="size-4" aria-hidden />
            {t('settings.toolbar.back')}
          </Button>
          {/* The Width Class travels into the drill-in: these switches apply to
              one of the two Layouts, and a leaf list with no width on it is the
              easiest place in the feature to edit the wrong one. */}
          <span className="ml-auto truncate text-muted-foreground text-xs">
            {familyName(openFamily.id)} · {t(`settings.toolbar.width.${widthClass}`)}
          </span>
        </div>
        {showPreview && <ToolbarPreviewStrip layout={layout} widthClass={widthClass} />}
        <LeafList
          family={openFamily}
          nameOf={itemName}
          onReorder={(activeId, overId) =>
            write(moveMember(layout, openFamily.id, activeId, overId))
          }
          onToggle={(memberId, on) => write(setMemberOn(layout, openFamily.id, memberId, on))}
        />
      </div>
    );
  }

  const fold = widthClass === 'compact' ? foldIndex(layout) : null;

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-sm">{t('settings.toolbar.width.legend')}</span>
          <span className="text-muted-foreground text-xs">{t('settings.toolbar.width.hint')}</span>
        </span>
        <ToggleGroup
          type="single"
          value={widthClass}
          onValueChange={(next) => setWidthClass((next as WidthClass) || widthClass)}
          variant="outline"
          size="sm"
          aria-label={t('settings.toolbar.width.legend')}
        >
          {WIDTH_CLASSES.map((option) => (
            <ToggleGroupItem key={option} value={option}>
              {t(`settings.toolbar.width.${option}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {showPreview && <ToolbarPreviewStrip layout={layout} widthClass={widthClass} />}

      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <span className="mr-auto text-sm">{t('settings.toolbar.preset.legend')}</span>
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            // A preset is a stamp, not a mode (decision 9): it writes a whole
            // Layout and nothing remembers that it did, so there is no active
            // state to show and no separate Reset - re-stamping Balanced *is*
            // the reset, and one button per outcome beats two that agree.
            onClick={() => write(toolbarPreset(preset, widthClass))}
          >
            {t(`settings.toolbar.preset.${preset}`)}
            {preset === 'balanced' && (
              <span className="text-muted-foreground text-xs">
                {t('settings.toolbar.preset.isDefault')}
              </span>
            )}
          </Button>
        ))}
      </div>

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
    </div>
  );
}

/**
 * Where a 360px phone stops showing buttons.
 *
 * Not a limit - a Layout may run past it, and the bar scrolls. It is here so the
 * arrangement is made against the real constraint rather than discovered on the
 * phone afterwards.
 */
function FoldMarker() {
  const { t } = useTranslation();
  return (
    <p className="flex items-center gap-2 px-3 py-1 text-[0.7rem] text-muted-foreground uppercase tracking-wide">
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

/** One family: drag to order, tap the name to drill in, collapse it, or turn it off. */
function FamilyRow({ family, name, onOpen, onToggle, onCollapse }: FamilyRowProps) {
  const { t } = useTranslation();
  const registryFamily = getToolbarFamily(family.id);
  // A stored family this build cannot render still holds the user's order, so it
  // keeps its row - but there is nothing honest to say about its contents.
  const Icon = registryFamily ? icons[registryFamily.icon] : null;
  const on = family.members.filter((member) => member.on).length;

  return (
    <SortableRow id={family.id} handleLabel={t('dnd.handle', { name })}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!registryFamily}
        className="flex min-h-11 flex-1 items-center gap-2 rounded-md px-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-60"
      >
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm">{name}</span>
          <span className="text-muted-foreground text-xs">
            {t('settings.toolbar.family.summary', { on, total: family.members.length })}
          </span>
        </span>
        <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      {registryFamily?.collapsible && (
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

/** A family's buttons: one flat, single-level list, so nested drag never exists. */
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
