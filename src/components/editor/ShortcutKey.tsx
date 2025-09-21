import { cn } from '@/lib/utils.ts';
import { getShortcutKey } from '@/utils/platform.ts';
import React from 'react';

export interface ShortcutKeyProps extends React.ComponentProps<'span'> {
  keys: string[];
}

export const ShortcutKey = ({ ref, className, keys, ...props }: ShortcutKeyProps) => {
  const modifiedKeys = keys.map((key) => getShortcutKey(key));
  const ariaLabel = modifiedKeys.map((shortcut) => shortcut.readable).join(' + ');

  return (
    <span
      aria-label={ariaLabel}
      className={cn('inline-flex items-center gap-0.5', className)}
      {...props}
      ref={ref}
    >
      {modifiedKeys.map((shortcut) => (
        <kbd
          key={shortcut.symbol}
          className={cn(
            'text-foreground inline-block min-w-2.5 text-center align-baseline text-xs font-medium capitalize',
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
