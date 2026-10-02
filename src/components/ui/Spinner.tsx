import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Decorative: every caller pairs it with text saying what is happening, because a bare
 * spinner tells a screen reader nothing.
 */
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin', className)} aria-hidden />;
}
