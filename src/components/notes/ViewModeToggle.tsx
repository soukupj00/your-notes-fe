import { LayoutGrid, Rows3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { useViewMode } from '@/context/viewModeProvider.tsx';
import { cn } from '@/lib/utils.ts';

/** The icon, the tooltip and the name all show the layout a press switches to, Keep-style. */
export function ViewModeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useViewMode();
  const next = viewMode === 'masonry' ? 'stack' : 'masonry';

  const label = t(`notes.view.${next}`);

  return (
    <IconTooltip label={label}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setViewMode(next)}
        aria-label={label}
        className={cn('text-muted-foreground', className)}
      >
        {viewMode === 'masonry' ? <Rows3 /> : <LayoutGrid />}
      </Button>
    </IconTooltip>
  );
}
