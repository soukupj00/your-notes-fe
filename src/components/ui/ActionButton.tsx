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
  /**
   * Show the floating tooltip. Turn it off where the label is already visible -
   * inside a menu, a tooltip is both redundant and mispositioned, because it
   * floats over the popover rather than beside the row it describes. `tooltip`
   * is still the accessible name either way.
   */
  showTooltip?: boolean;
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
      showTooltip = true,
      ...rest
    },
    ref
  ) => {
    const Comp = asChild ? Slot : toggle ? Toggle : Button;

    // Non-toggle toolbar buttons (media pickers, undo/redo, the mic) fall through
    // to Button's `default` variant, which is what made them read as filled purple
    // slabs beside the flat toggle buttons. Neutralise it here rather than passing
    // `variant`: `Comp` is a union, and only `Toggle`'s narrower variant type is
    // visible to TS at the call site. These classes win via tailwind-merge and
    // give the same rest/hover treatment as a Toggle in its off state.
    const flatButton = !toggle && 'bg-transparent text-foreground shadow-none';

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
            className={cn(
              'flex h-8 w-8 items-center justify-center p-0',
              flatButton,
              'hover:bg-muted hover:text-foreground',
              className
            )}
            {...rest}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {children}
          </Comp>
        </TooltipTrigger>

        {tooltip && showTooltip && (
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
