import type { TooltipContentProps } from '@radix-ui/react-tooltip';
import type React from 'react';
import { Toggle } from '@/components/ui/toggle.tsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip.tsx';
import { cn } from '@/lib/utils.ts';

interface ToolbarButtonProps extends React.ComponentProps<typeof Toggle> {
  isActive?: boolean;
  tooltip?: string;
  tooltipOptions?: TooltipContentProps;
}

export const ToolbarButton = ({
  isActive,
  tooltip,
  tooltipOptions,
  className,
  children,
  ...props
}: ToolbarButtonProps) => {
  const toggleButton = (
    <Toggle className={cn({ 'bg-accent': isActive }, className)} {...props}>
      {children}
    </Toggle>
  );

  if (!tooltip) {
    return toggleButton;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{toggleButton}</TooltipTrigger>
      <TooltipContent {...tooltipOptions}>
        <div className="flex flex-col items-center text-center">{tooltip}</div>{' '}
      </TooltipContent>
    </Tooltip>
  );
};

export default ToolbarButton;
