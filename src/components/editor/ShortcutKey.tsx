import type React from 'react';
import { cn } from '@/lib/utils.ts';
import { getShortcutKey } from '@/utils/platform.ts';

export interface ShortcutKeyProps extends React.ComponentProps<'span'> {
  keys: string[];
}

export const ShortcutKey = ({ ref, className, keys, ...props }: ShortcutKeyProps) => {
  const modifiedKeys = keys.map((key) => getShortcutKey(key));
  const ariaLabel = modifiedKeys.map((shortcut) => shortcut.readable).join(' + ');

  return (
    <span
      role="group"
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5', className)}
      {...props}
      ref={ref}
    >
      {modifiedKeys.map((shortcut) => (
        <kbd
          key={shortcut.symbol}
          className={cn(
            'inline-block min-w-2.5 text-center align-baseline font-medium text-foreground text-xs capitalize',
            className
          )}
          {...props}
        >
          {shortcut.symbol}
        </kbd>
      ))}
    </span>
  );
};
