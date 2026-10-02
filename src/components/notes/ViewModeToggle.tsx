import { LayoutGrid, Rows3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { useViewMode } from '@/context/viewModeProvider.tsx';
import { cn } from '@/lib/utils.ts';

/** The icon shows the layout you will switch to, Keep-style, and the accessible label names it. */
export function ViewModeToggle({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useViewMode();
  const next = viewMode === 'masonry' ? 'stack' : 'masonry';

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setViewMode(next)}
      aria-label={t('notes.view.toggle')}
      title={t(`notes.view.${next}`)}
      className={cn('text-muted-foreground', className)}
    >
      {viewMode === 'masonry' ? <Rows3 /> : <LayoutGrid />}
    </Button>
  );
}
