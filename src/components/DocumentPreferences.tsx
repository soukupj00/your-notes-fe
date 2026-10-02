import { useEffect } from 'react';
import { usePreferences } from '@/context/PreferencesProvider.tsx';

/** The class `globals.css` hangs the colour-blind palette off. */
export const COLOR_BLIND_CLASS = 'cvd';

/**
 * Stamps the preferences CSS has to act on onto `<html>` (CLAUDE.md, Theming). Density and
 * reduced motion are stamped for every value, because CSS must tell "follow the OS" (`system`)
 * apart from "never reduce", and an absent attribute cannot stand for both.
 */
export function DocumentPreferences() {
  const { preferences } = usePreferences();
  const { colorBlind, density, reducedMotion, sinkCheckedItems } = preferences;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(COLOR_BLIND_CLASS, colorBlind);
    root.dataset.density = density;
    root.dataset.reducedMotion = reducedMotion;
    // Present or absent: a plain two-state switch, with no third value to confuse absence with.
    root.toggleAttribute('data-sink-checked', sinkCheckedItems);
  }, [colorBlind, density, reducedMotion, sinkCheckedItems]);

  return null;
}
