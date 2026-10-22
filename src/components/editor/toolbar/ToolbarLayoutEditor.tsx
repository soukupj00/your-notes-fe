import { ChevronLeft, ChevronRight, Group, Ungroup } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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

interface ToolbarLayoutEditorProps {
  /** On in Settings, which has no note open; off over the editor, whose real bar is live. */
  showPreview?: boolean;
}

/**
 * Mounted in Settings and over the editor (ADR 0011, decision 10). It edits the Layout of the
 * Width Class this screen is in, and writes straight through: the bar behind the sheet is the
 * preview.
 */
export function ToolbarLayoutEditor({ showPreview }: ToolbarLayoutEditorProps) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const widthClass = useWidthClass();
  const [openFamilyId, setOpenFamilyId] = useState<string | null>(null);

  // Reconciled, because the stored blob may be empty or predate half the registry,
  // and the editor must show every family the user could turn on.
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
          {/* The width is named here, or a leaf list is the easiest place to edit
              the wrong one of the two Layouts. */}
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
      <p className="border-b px-4 py-3 text-sm">
        {t(`settings.toolbar.width.current.${widthClass}`)}
      </p>

      {showPreview && <ToolbarPreviewStrip layout={layout} widthClass={widthClass} />}

      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <span className="mr-auto text-sm">{t('settings.toolbar.preset.legend')}</span>
        {PRESETS.map((preset) => (
          <Button
            key={preset}
            type="button"
            variant="outline"
            size="sm"
            // A stamp, not a mode (decision 9): nothing remembers it, so there is no
            // active state and no Reset button; re-stamping the default is the reset.
            onClick={() => write(toolbarPreset(preset, widthClass))}
          >
            {t(`settings.toolbar.preset.${preset}`)}
            {preset === DEFAULT_PRESET[widthClass] && (
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

/** Where a 360px phone stops showing buttons: a marker, not a limit (`COMPACT_FOLD_SLOTS`). */
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
