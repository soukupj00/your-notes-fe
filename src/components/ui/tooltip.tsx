'use client';

import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as React from 'react';

import { cn } from '@/lib/utils';

const GAP = 4;

const TooltipProvider = TooltipPrimitive.Provider;

const Tooltip = TooltipPrimitive.Root;

const TooltipTrigger = TooltipPrimitive.Trigger;

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = GAP, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'fade-in-0 zoom-in-95 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 origin-[--radix-tooltip-content-transform-origin] animate-in overflow-hidden rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-xs data-[state=closed]:animate-out',
        className
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

/** Inside it, a tooltip on a lower row of this element opens below the element rather than over
 *  the rows above; the first row keeps the default. For the wrapped toolbar on Wide. */
const TooltipFloorContext = React.createContext<React.RefObject<HTMLElement | null> | null>(null);
const TooltipFloorProvider = TooltipFloorContext.Provider;

/** Spread `root` on the `Tooltip`, `trigger` on its `TooltipTrigger` and `content` last on its `TooltipContent`. */
function useTooltipFloor() {
  const floor = React.useContext(TooltipFloorContext);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [offset, setOffset] = React.useState<number | null>(null);

  // Measured on open only: resetting on close would flip the tooltip's side mid fade-out.
  const onOpenChange = (open: boolean) => {
    const bar = floor?.current;
    const trigger = triggerRef.current;
    if (!open || !bar || !trigger) return;
    const barBox = bar.getBoundingClientRect();
    const box = trigger.getBoundingClientRect();
    const lowerRow = bar.contains(trigger) && box.top - barBox.top >= box.height;
    setOffset(lowerRow ? barBox.bottom - box.bottom + GAP : null);
  };

  return {
    root: { onOpenChange },
    trigger: { ref: triggerRef },
    content: offset === null ? {} : { side: 'bottom' as const, sideOffset: offset },
  };
}

/* Radix opens a tooltip on any focus, including focus a menu or popover hands back after a
   click or tap; Chrome even marks that `:focus-visible`. Only focus after a key press opens it. */
let lastInputWasKey = false;
if (typeof document !== 'undefined') {
  document.addEventListener(
    'keydown',
    () => {
      lastInputWasKey = true;
    },
    true
  );
  document.addEventListener(
    'pointerdown',
    () => {
      lastInputWasKey = false;
    },
    true
  );
}

/** A name on hover for an icon-only control. Visual only: the child keeps its own `aria-label`.
 *  Its own provider, like `NoteColorPicker`'s, so it works wherever it mounts; Radix permits nesting.
 *  Other props reach the child, so it can sit inside another `asChild` trigger. */
function IconTooltip({
  label,
  side,
  children,
  ...trigger
}: React.ComponentProps<typeof TooltipTrigger> & {
  label: string;
  side?: React.ComponentProps<typeof TooltipContent>['side'];
  children: React.ReactElement;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          asChild
          {...trigger}
          onFocus={(event) => {
            trigger.onFocus?.(event);
            if (!lastInputWasKey) event.preventDefault();
          }}
        >
          {children}
        </TooltipTrigger>
        <TooltipContent side={side}>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export {
  IconTooltip,
  Tooltip,
  TooltipContent,
  TooltipFloorProvider,
  TooltipProvider,
  TooltipTrigger,
  useTooltipFloor,
};
