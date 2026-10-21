import { Slot } from '@radix-ui/react-slot';
import type { TooltipContentProps } from '@radix-ui/react-tooltip';
import * as React from 'react';
import { type IconName, icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { getShortcutKeys } from '@/lib/shortcut-keys.ts';
import { cn } from '@/lib/utils';
import type { ButtonViewReturnComponentProps } from '@/types';

/**
 * A button's name as a menu row, or `null` on a bar; why context: editor/CLAUDE.md.
 * Trap: a portal keeps its tree place, so an `ActionButton` inside a leaf's popover
 * would draw as a row too. None do today.
 */
const MenuRowLabelContext = React.createContext<string | null>(null);

export const MenuRowLabelProvider = MenuRowLabelContext.Provider;

export interface ActionButtonProps {
  disabled?: boolean;
  shortcutKeys?: string[];
  className?: string;
  /** For runtime-only values: the colour triggers wear the colour they would apply. */
  style?: React.CSSProperties;
  loading?: boolean;
  tooltip?: string;
  tooltipOptions?: TooltipContentProps;
  action?: ButtonViewReturnComponentProps['action'];
  isActive?: ButtonViewReturnComponentProps['isActive'];
  icon?: IconName;
  children?: React.ReactNode;
  asChild?: boolean;
  toggle?: boolean;
  /** Off where the label is already visible. `tooltip` stays the accessible name either way. */
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
    const menuRowLabel = React.useContext(MenuRowLabelContext);
    // On a touch device a shortcut is noise in the one place the user reads the
    // button's name, so it is hidden.
    const finePointer = useFinePointer();

    // Flattens Button's filled `default` variant with classes rather than `variant`,
    // because `Comp` is a union and TS only sees Toggle's narrower variant type.
    const flatButton = !toggle && 'bg-transparent text-foreground shadow-none';

    // A class, not just `data-[state=on]`: a `PopoverTrigger asChild` overwrites
    // `data-state` with `open`/`closed`, which hid the active highlight.
    const activeToggle = toggle && isActive?.() && 'bg-accent text-accent-foreground';

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
              'flex size-8 items-center justify-center p-0',
              flatButton,
              'hover:bg-muted hover:text-foreground',
              activeToggle,
              // Before `className`, so a caller can still override the menu-row shape.
              menuRowLabel !== null && 'h-9 w-full justify-start gap-2 px-2.5',
              className
            )}
            {...rest}
          >
            {Icon && <Icon className="size-4" />}
            {menuRowLabel !== null && (
              <span className="flex-1 text-left font-normal text-sm">{menuRowLabel}</span>
            )}
            {children}
          </Comp>
        </TooltipTrigger>

        {/* Inside a menu the name is already on the row, and a tooltip would float
            over the popover rather than beside the row. */}
        {tooltip && showTooltip && menuRowLabel === null && (
          <TooltipContent side="top" align="center" {...tooltipOptions}>
            <div className="flex max-w-[200px] flex-col items-center gap-1 text-center">
              <span>{tooltip}</span>
              {/* Not `text-muted-foreground`: page ink measured ~1.1:1 on the accent
                  surface in both themes. Hierarchy comes from spacing, not dimming. */}
              {finePointer && !!shortcutKeys?.length && (
                <span className="text-primary-foreground text-xs tracking-wide">
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
