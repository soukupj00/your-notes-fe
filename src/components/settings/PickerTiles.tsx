import { type ReactNode, useId } from 'react';

/**
 * A choice between a few options a picture tells apart better than a word (DESIGN.md, Picker
 * Tiles). Native radios, so the arrow keys, the tab stop and the checked state come from the browser.
 */
export function PickerTiles<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; picture: ReactNode }[];
  onChange: (next: T) => void;
}) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-11 cursor-pointer flex-col items-center gap-1.5 rounded-control border bg-background p-1.5 pb-2 text-center font-medium text-sm has-checked:border-foreground has-checked:bg-selected has-focus-visible:outline-2 has-focus-visible:outline-ring has-focus-visible:outline-offset-2 has-checked:ring-1 has-checked:ring-foreground"
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={option.value === value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span aria-hidden className="w-full">
            {option.picture}
          </span>
          {option.label}
        </label>
      ))}
    </div>
  );
}
