import { useEffect } from 'react';
import { usePreferences } from '@/context/PreferencesProvider.tsx';

/** The class `globals.css` hangs the colour-blind palette off. */
export const COLOR_BLIND_CLASS = 'cvd';

/**
 * Stamps the colour-blind palette class onto `<html>`.
 *
 * It is deliberately separate from `ThemeProvider` rather than folded into it.
 * The two classes compose in CSS (`.dark.cvd`), not in JavaScript, so neither
 * needs to know the other exists - and keeping them apart means `ThemeProvider`
 * never has to reach into preferences, which would have forced the provider
 * order in `App.tsx` to change.
 *
 * Renders nothing: it is a side effect on the document, and the document root
 * lives above React's tree.
 */
export function PaletteVariant() {
  const { preferences } = usePreferences();
  const enabled = preferences.colorBlind;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(COLOR_BLIND_CLASS, enabled);
  }, [enabled]);

  return null;
}
