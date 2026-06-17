import { Toggle } from '@/components/ui/toggle.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { getShortcutKeys } from '@/utils/platform.ts';

interface HistoryActionButtonProps {
  icon?: React.ReactNode;
  title?: string;
  tooltip?: string;
  tooltipOptions?: React.ComponentProps<typeof TooltipContent>;
  disabled?: boolean;
  shortcutKeys?: string[];
  color?: string;
  loading?: boolean;
  isActive?: boolean;
  action?: () => void;
  children?: React.ReactNode;
}

function HistoryActionButton({
  icon,
  tooltip,
  tooltipOptions,
  action,
  isActive,
  children,
  ...props
}: HistoryActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Toggle size="sm" className="rounded-md p-0" disabled={isActive} onClick={action}>
          {icon}
          {children && <>{children}</>}
        </Toggle>
      </TooltipTrigger>
      {tooltip && (
        <TooltipContent {...tooltipOptions}>
          <div className="flex flex-col items-center text-center">
            {tooltip}
            {!!props?.shortcutKeys?.length && (
              <span>
                {getShortcutKeys(props.shortcutKeys)
                  .map((k) => k.symbol)
                  .join(' + ')}
              </span>
            )}
          </div>
        </TooltipContent>
      )}
    </Tooltip>
  );
}

export default HistoryActionButton;
