import { Ellipsis } from 'lucide-react';
import type { Ref } from 'react';
import { useTranslation } from 'react-i18next';
import type { QuickCaptureAction } from '@/components/notes/quickCaptureActions.ts';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';

interface CaptureStartsProps {
  actions: QuickCaptureAction[];
  /** The first `fit` are inline, the rest in the ⋯ menu, in the same order. */
  fit: number;
  onPick: (action: QuickCaptureAction) => void;
  ref?: Ref<HTMLDivElement>;
}

/** The desktop bar's Starts. A menu item picks inside its click, so a picker Start still opens. */
export function CaptureStarts({ actions, fit, onPick, ref }: CaptureStartsProps) {
  const { t } = useTranslation();
  const overflow = actions.slice(fit);

  return (
    <div ref={ref} className="flex shrink-0 items-center gap-1">
      {actions.slice(0, fit).map((action) => (
        <IconTooltip key={action.key} label={t(action.labelKey)}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t(action.labelKey)}
            onClick={() => onPick(action)}
          >
            <action.Icon className="size-4" />
          </Button>
        </IconTooltip>
      ))}
      {overflow.length > 0 && (
        <DropdownMenu>
          <IconTooltip label={t('notes.capture.more')}>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('notes.capture.more')}
              >
                <Ellipsis className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </IconTooltip>
          <DropdownMenuContent align="end">
            {overflow.map((action) => (
              <DropdownMenuItem
                key={action.key}
                className="coarse:min-h-11"
                onSelect={() => onPick(action)}
              >
                <action.Icon aria-hidden />
                {t(action.labelKey)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
