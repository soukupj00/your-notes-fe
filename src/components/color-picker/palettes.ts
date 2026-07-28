export type ColorItem = {
  /** Human-readable name shown in the swatch tooltip. */
  label: string;
  /** CSS color applied when the swatch is chosen. Empty string means "none/default". */
  cssValue: string;
};

export type ColorPalette = {
  label: string;
  colors: ColorItem[];
};

/** Vivid Tailwind-500 swatches for editor text color (moved verbatim from the old picker). */
export const TEXT_COLORS: ColorPalette = {
  label: 'Text colors',
  colors: [
    { label: 'Red', cssValue: '#ef4444' },
    { label: 'Orange', cssValue: '#f97316' },
    { label: 'Yellow', cssValue: '#eab308' },
    { label: 'Green', cssValue: '#22c55e' },
    { label: 'Blue', cssValue: '#3b82f6' },
    { label: 'Indigo', cssValue: '#6366f1' },
    { label: 'Purple', cssValue: '#a855f7' },
    { label: 'Pink', cssValue: '#ec4899' },
  ],
};

const PASTEL_COLORS: ColorItem[] = [
  { label: 'Default', cssValue: '' },
  { label: 'Red', cssValue: '#fecaca' },
  { label: 'Orange', cssValue: '#fed7aa' },
  { label: 'Yellow', cssValue: '#fef08a' },
  { label: 'Green', cssValue: '#bbf7d0' },
  { label: 'Blue', cssValue: '#bfdbfe' },
  { label: 'Purple', cssValue: '#e9d5ff' },
  { label: 'Pink', cssValue: '#fbcfe8' },
];

/** Muted pastel (Tailwind-200) swatches for editor text highlight, plus a leading Default. */
export const HIGHLIGHT_COLORS: ColorPalette = {
  label: 'Highlight colors',
  colors: PASTEL_COLORS,
};

/** Muted pastel (Tailwind-200) swatches for note card backgrounds, plus a leading Default. */
export const CARD_COLORS: ColorPalette = {
  label: 'Background colors',
  colors: PASTEL_COLORS,
};
