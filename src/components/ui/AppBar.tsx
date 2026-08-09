import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.ts';

/**
 * One row of the mobile app bar: a control on the left, a middle that fills the
 * space, and a control on the right.
 *
 * The slots carry no behaviour on purpose. Its two consumers want opposite
 * things from the middle - the Navbar puts a search field there that must flex,
 * the editor puts nothing there at all - so any layout opinion beyond "the
 * middle grows, the sides do not" belongs to the children. A slot component
 * that starts deciding for its children is how this becomes props soup.
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
      {/* `shrink-0` on the sides: a long title must never squeeze a 44px
          control below 44px, which is what flex would otherwise do first. */}
      {left && <div className="flex shrink-0 items-center">{left}</div>}
      <div className="flex min-w-0 flex-1 items-center">{center}</div>
      {right && <div className="flex shrink-0 items-center">{right}</div>}
    </div>
  );
}
