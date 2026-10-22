import { ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { icons } from '@/components/icons';
import { cn } from '@/lib/utils.ts';
import { COMPACT_FOLD_SLOTS } from './foldMarker';
import { resolveLayout } from './resolveLayout';
import type { ToolbarLayout, WidthClass } from './types';

interface ToolbarPreviewStripProps {
  layout: ToolbarLayout;
  widthClass: WidthClass;
}

/**
 * A picture of the bar from the registry: a live TipTap would pull the editor into the
 * settings bundle. `aria-hidden`, because the list below is the real control.
 */
export function ToolbarPreviewStrip({ layout, widthClass }: ToolbarPreviewStripProps) {
  const { t } = useTranslation();
  const compact = widthClass === 'compact';
  const slots = resolveLayout(layout, widthClass).flatMap((entry) =>
    entry.collapsed
      ? [{ key: entry.family.id, icon: entry.family.icon, menu: true }]
      : entry.items.map((item) => ({ key: item.id, icon: item.icon, menu: false }))
  );

  return (
    // `data-tour` is here, not on the section, which is taller than a phone screen
    // while the inert Tour cannot scroll. Only Settings mounts the strip, so it is unique.
    <div data-tour="settings-toolbar" className="flex flex-col gap-1 px-4 py-3">
      <span className="text-muted-foreground text-xs">{t('settings.toolbar.preview')}</span>
      <div
        aria-hidden
        data-testid="toolbar-preview"
        className={cn(
          'flex items-center gap-1 rounded-control border bg-background p-1',
          // Mirrors the real compact bar, or it would show a bar the phone never draws.
          compact
            ? 'justify-between overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'flex-wrap'
        )}
      >
        {slots.map(({ key, icon, menu }, index) => {
          const Icon = icons[icon];
          return (
            <span key={key} className="flex items-center">
              {compact && index === COMPACT_FOLD_SLOTS && (
                // The fold, drawn so the count and the picture agree.
                <span className="mr-1 h-7 w-px shrink-0 bg-border" />
              )}
              <span className="flex size-7 shrink-0 items-center justify-center rounded-control text-muted-foreground">
                <Icon className="size-4" />
                {menu && <ChevronDown className="size-2.5 opacity-60" />}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default ToolbarPreviewStrip;
