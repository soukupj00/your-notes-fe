import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ButtonViewReturnComponentProps } from '@/types';
import { getShortcutKeys } from '@/utils/platform.ts';
import { Slot } from '@radix-ui/react-slot';
import type { TooltipContentProps } from '@radix-ui/react-tooltip';
import * as React from 'react';

export interface ActionButtonProps {
  /** Whether button is disabled */
  disabled?: boolean;
  /** Keyboard shortcut keys */
  shortcutKeys?: string[];
  /** Custom CSS class */
  className?: string;
  /** Loading state */
  loading?: boolean;
  /** Tooltip text */
  tooltip?: string;
  /** Tooltip options */
  tooltipOptions?: TooltipContentProps;
  /** Click handler */
  action?: ButtonViewReturnComponentProps['action'];
  /** Active state checker */
  isActive?: ButtonViewReturnComponentProps['isActive'];
  /** Child elements (icon + text) */
  children?: React.ReactNode;
  /** Render as child */
  asChild?: boolean;
  /** Use Toggle instead of Button */
  toggle?: boolean;
}

const ActionButton = React.forwardRef<HTMLButtonElement, ActionButtonProps>(
  (
    {
      disabled = false,
      className,
      loading,
      shortcutKeys,
      tooltip,
      tooltipOptions,
      action,
      isActive,
      children,
      asChild = false,
      toggle = false,
      ...rest
    },
    ref
  ) => {
    const Comp = asChild ? Slot : toggle ? Toggle : Button;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Comp
            ref={ref}
            onClick={action}
            disabled={disabled || loading}
            data-state={isActive?.() ? 'on' : 'off'}
            size="sm"
            className={cn('flex h-8 w-8 items-center justify-center p-0', className)}
            {...rest}
          >
            {children}
          </Comp>
        </TooltipTrigger>

        {tooltip && (
          <TooltipContent side="top" align="center" {...tooltipOptions}>
            <div className="flex max-w-[200px] flex-col items-center gap-1 text-center">
              <span>{tooltip}</span>
              {!!shortcutKeys?.length && (
                <span className="text-muted-foreground text-xs">
                  {getShortcutKeys(shortcutKeys)}
                </span>
              )}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    );
  }
);

ActionButton.displayName = 'ActionButton';

export { ActionButton };
