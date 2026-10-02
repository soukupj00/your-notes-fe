export type ColorItem = {
  label: string;
  /** Empty string means none (the default). */
  cssValue: string;
};

export type ColorPalette = {
  label: string;
  colors: ColorItem[];
};

/** Tailwind-500 values. */
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

/** Tailwind-200 values. */
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

export const HIGHLIGHT_COLORS: ColorPalette = {
  label: 'Highlight colors',
  colors: PASTEL_COLORS,
};

export const CARD_COLORS: ColorPalette = {
  label: 'Background colors',
  colors: PASTEL_COLORS,
};
