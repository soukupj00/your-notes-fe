export type ColorItem = {
  /** Names the swatch through the `colors.*` locale keys. */
  token: string;
  /** Empty string means none (the default). */
  cssValue: string;
};

export type ColorPalette = {
  colors: ColorItem[];
};

/** Tailwind-500 values. */
export const TEXT_COLORS: ColorPalette = {
  colors: [
    { token: 'red', cssValue: '#ef4444' },
    { token: 'orange', cssValue: '#f97316' },
    { token: 'yellow', cssValue: '#eab308' },
    { token: 'green', cssValue: '#22c55e' },
    { token: 'blue', cssValue: '#3b82f6' },
    { token: 'indigo', cssValue: '#6366f1' },
    { token: 'purple', cssValue: '#a855f7' },
    { token: 'pink', cssValue: '#ec4899' },
  ],
};

/** Tailwind-200 values. */
const PASTEL_COLORS: ColorItem[] = [
  { token: 'default', cssValue: '' },
  { token: 'red', cssValue: '#fecaca' },
  { token: 'orange', cssValue: '#fed7aa' },
  { token: 'yellow', cssValue: '#fef08a' },
  { token: 'green', cssValue: '#bbf7d0' },
  { token: 'blue', cssValue: '#bfdbfe' },
  { token: 'purple', cssValue: '#e9d5ff' },
  { token: 'pink', cssValue: '#fbcfe8' },
];

export const HIGHLIGHT_COLORS: ColorPalette = {
  colors: PASTEL_COLORS,
};

export const CARD_COLORS: ColorPalette = {
  colors: PASTEL_COLORS,
};
