import { Slot } from '@radix-ui/react-slot';
import type { TooltipContentProps } from '@radix-ui/react-tooltip';
import * as React from 'react';
import { type IconName, icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ButtonViewReturnComponentProps } from '@/types';
import { getShortcutKeys } from '@/utils/platform.ts';

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
  /** Icon name */
  icon?: IconName;
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
      icon,
      children,
      asChild = false,
      toggle = false,
      ...rest
    },
    ref
  ) => {
    const Comp = asChild ? Slot : toggle ? Toggle : Button;

    const Icon = icon ? icons[icon] : undefined;

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Comp
            ref={ref}
            onClick={action}
            disabled={disabled || loading}
            data-state={isActive?.() ? 'on' : 'off'}
            size="sm"
            // Icon-only buttons need an accessible name; the visual tooltip is not exposed to AT.
            aria-label={tooltip}
            className={cn('flex h-8 w-8 items-center justify-center p-0', className)}
            {...rest}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {children}
          </Comp>
        </TooltipTrigger>

        {tooltip && (
          <TooltipContent side="top" align="center" {...tooltipOptions}>
            <div className="flex max-w-[200px] flex-col items-center gap-1 text-center">
              <span>{tooltip}</span>
              {!!shortcutKeys?.length && (
                <span className="text-muted-foreground text-xs">
                  {getShortcutKeys(shortcutKeys)
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
);

ActionButton.displayName = 'ActionButton';

export { ActionButton };
