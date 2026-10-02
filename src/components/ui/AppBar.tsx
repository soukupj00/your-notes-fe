import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

/**
 * The slots hold no opinion beyond "the middle grows, the sides do not": its consumers
 * want opposite things from the middle, so the rest belongs to the children.
 */
export function AppBar({
  left,
  center,
  right,
  className,
}: {
  left?: ReactNode;
  center?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="app-bar" className={cn('flex items-center gap-2 px-4 py-2', className)}>
      {/* A long title must never squeeze a 44px control (the 44px Touch Rule). */}
      {left && <div className="flex shrink-0 items-center">{left}</div>}
      <div className="flex min-w-0 flex-1 items-center">{center}</div>
      {right && <div className="flex shrink-0 items-center">{right}</div>}
    </div>
  );
}
