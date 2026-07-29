import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The one busy indicator. Decorative by itself: every caller pairs it with text
 * that says what is happening, because a bare spinner tells a screen reader
 * nothing and tells everyone else only that something is stuck.
 */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />;
}

export default Spinner;
