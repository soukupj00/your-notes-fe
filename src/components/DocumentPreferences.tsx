import { useEffect } from 'react';
import { usePreferences } from '@/context/PreferencesProvider.tsx';

/** The class `globals.css` hangs the colour-blind palette off. */
export const COLOR_BLIND_CLASS = 'cvd';

/**
 * Stamps the preferences that CSS - not React - has to act on onto `<html>`.
 *
 * Four of them qualify, and the test for belonging here is whether the
 * stylesheet needs the value: the colour-blind palette re-values three colour
 * primitives, density re-values the type and rhythm tokens, reduced motion has
 * to be able to overrule the `prefers-reduced-motion` query in a media block
 * that JS cannot reach into, and checklist sinking is entirely a CSS rule
 * (ADR 0013) that has nothing to switch it off but this attribute. Every other
 * preference is read by the component that spends it and must stay there.
 *
 * Deliberately separate from `ThemeProvider` rather than folded into it. The
 * classes and attributes compose in CSS (`.dark.cvd`, `:root[data-density]`),
 * not in JavaScript, so neither side needs to know the other exists - and
 * keeping them apart means `ThemeProvider` never has to reach into
 * preferences, which would have forced the provider order in `App.tsx` to
 * change.
 *
 * Density and reduced motion are stamped for *every* value rather than only
 * for the non-default one. The attribute is then a readable statement of what
 * the app thinks is on, and `system` in particular has to be assertable: CSS
 * distinguishes "follow the OS query" from "never reduce", so an absent
 * attribute could not stand in for both.
 *
 * Renders nothing: it is a side effect on the document, and the document root
 * lives above React's tree.
 */
export function DocumentPreferences() {
  const { preferences } = usePreferences();
  const { colorBlind, density, reducedMotion, sinkCheckedItems } = preferences;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(COLOR_BLIND_CLASS, colorBlind);
    root.dataset.density = density;
    root.dataset.reducedMotion = reducedMotion;
    // Present or absent rather than "true"/"false": unlike density and reduced
    // motion this is a plain two-state switch, so there is no third value for
    // an absent attribute to be ambiguous between.
    root.toggleAttribute('data-sink-checked', sinkCheckedItems);
  }, [colorBlind, density, reducedMotion, sinkCheckedItems]);

  return null;
}
