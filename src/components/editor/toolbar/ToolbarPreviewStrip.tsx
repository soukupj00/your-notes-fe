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
 * What the bar will look like, drawn from the registry rather than from a live
 * editor.
 *
 * Settings has no note open to preview against, and mounting a real TipTap
 * instance to show eight icons would pull the whole editor into the settings
 * route's bundle. So this is deliberately a **picture**: the same icons in the
 * same order, no actions, no active state.
 *
 * It is `aria-hidden` because it restates the list below it, which is the real
 * control and is already announced in order.
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
    <div className="flex flex-col gap-1 px-3 py-3">
      <span className="text-muted-foreground text-xs">{t('settings.toolbar.preview')}</span>
      <div
        aria-hidden
        data-testid="toolbar-preview"
        className={cn(
          'flex items-center gap-1 rounded-control border bg-background p-1',
          // The real compact bar scrolls rather than wrapping, and the preview
          // has to make the same promise - a wrapped preview would show a bar
          // the phone never draws.
          compact
            ? 'overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
            : 'flex-wrap'
        )}
      >
        {slots.map(({ key, icon, menu }, index) => {
          const Icon = icons[icon];
          return (
            <span key={key} className="flex items-center">
              {compact && index === COMPACT_FOLD_SLOTS && (
                // Where the phone's screen ends, drawn in the picture itself so
                // the count and the shape agree.
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
