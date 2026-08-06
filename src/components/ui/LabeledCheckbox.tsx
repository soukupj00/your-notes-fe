import { Check } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

/**
 * A real checkbox wrapped in its label, so the whole row is one hit target with
 * native keyboard and label-click behaviour.
 *
 * Not the shared `ui/checkbox`: Radix renders that as a `<button>`, which a
 * `<label>` cannot activate natively - the label text would be dead to clicks.
 * The input is visually hidden and a styled span stands in, so it still looks
 * like every other checkbox in the app.
 */
export function LabeledCheckbox({
  label,
  checked,
  onToggle,
  className,
  labelClassName,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  /** Extra classes for the `<label>` row, for callers that are a list row. */
  className?: string;
  /**
   * Extra classes for the text itself. A one-line row wants `truncate`; a label
   * that is a whole sentence must be allowed to wrap, so this is not a default.
   */
  labelClassName?: string;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center gap-2 text-sm', className)}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'flex size-4 shrink-0 items-center justify-center rounded-sm border border-input',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
          checked && 'border-primary bg-primary text-primary-foreground'
        )}
      >
        {checked && <Check className="size-3.5" />}
      </span>
      <span className={labelClassName}>{label}</span>
    </label>
  );
}
