import { Slot } from '@radix-ui/react-slot';
import type { TooltipContentProps } from '@radix-ui/react-tooltip';
import * as React from 'react';
import { type IconName, icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { cn } from '@/lib/utils';
import type { ButtonViewReturnComponentProps } from '@/types';
import { getShortcutKeys } from '@/utils/platform.ts';

/**
 * The name a button takes when it is a row in a menu rather than an icon on a
 * bar, or `null` on a bar.
 *
 * Context rather than a prop because the button that needs the name is often not
 * the one the menu renders: `link`, the five attachment pickers and the colour
 * triggers are all custom components that *wrap* an `ActionButton`, so a prop
 * would have to be threaded through - and remembered by - every one of them,
 * and by every one added later. The menu states the name once, and whichever
 * `ActionButton` ends up being the row picks it up.
 *
 * The one hazard is that a component's own popover stays inside this provider
 * (a React portal keeps its place in the tree), so an `ActionButton` rendered
 * *inside* a leaf's popover would also draw itself as a row. None do today -
 * their popovers hold inputs, swatches and plain `Button`s.
 */
const MenuRowLabelContext = React.createContext<string | null>(null);

export const MenuRowLabelProvider = MenuRowLabelContext.Provider;

export interface ActionButtonProps {
  disabled?: boolean;
  shortcutKeys?: string[];
  className?: string;
  /**
   * Inline styles, for the one thing a class cannot express: a value only known
   * at runtime. The colour triggers wear the colour they would apply.
   */
  style?: React.CSSProperties;
  loading?: boolean;
  tooltip?: string;
  tooltipOptions?: TooltipContentProps;
  /** Click handler */
  action?: ButtonViewReturnComponentProps['action'];
  /** Active state checker */
  isActive?: ButtonViewReturnComponentProps['isActive'];
  icon?: IconName;
  children?: React.ReactNode;
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
    const menuRowLabel = React.useContext(MenuRowLabelContext);
    // A shortcut is only actionable on a machine that has the keys. On a phone
    // or tablet it is noise in the one place a touch user reads the button's
    // name, so it is suppressed rather than shown and ignored.
    const finePointer = useFinePointer();

    // Non-toggle toolbar buttons (media pickers, undo/redo, the mic) fall through
    // to Button's `default` variant, which is what made them read as filled purple
    // slabs beside the flat toggle buttons. Neutralise it here rather than passing
    // `variant`: `Comp` is a union, and only `Toggle`'s narrower variant type is
    // visible to TS at the call site. These classes win via tailwind-merge and
    // give the same rest/hover treatment as a Toggle in its off state.
    const flatButton = !toggle && 'bg-transparent text-foreground shadow-none';

    // `Toggle` styles its on state off `data-[state=on]`, which is only reliable
    // when nothing else owns that attribute. A `PopoverTrigger asChild` does own
    // it - it writes `open`/`closed` over ours - so every button that opens a
    // popover (link, the colour triggers, a collapsed family) silently lost its
    // active highlight. Carrying the same styling as a class makes the active
    // state the button's own business again, whoever it is wrapped in.
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
              // A menu row is a full-width label, not a square. Applied before
              // `className` so a caller can still override it.
              menuRowLabel !== null && 'h-9 w-full justify-start gap-2 px-2',
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

        {/* Inside a menu the name is already on the row, so a tooltip would be
            both redundant and mispositioned - it floats over the popover rather
            than beside the row it describes. */}
        {tooltip && showTooltip && menuRowLabel === null && (
          <TooltipContent side="top" align="center" {...tooltipOptions}>
            <div className="flex max-w-[200px] flex-col items-center gap-1 text-center">
              <span>{tooltip}</span>
              {finePointer && !!shortcutKeys?.length && (
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
