# Design

The visual contract is [`DESIGN.md`](https://github.com/soukupj00/your-notes-fe/blob/main/DESIGN.md), written from measurement rather than impression.
This page is its short version: the idea, where the tokens live, and the rules any UI change keeps.

## Day desk, night shop

One desk, photographed twice: mid-morning with the window open, and at midnight with the lamp on.
The app does not invert into a dark theme, it changes its light.

- By day the canvas is warm parchment, and a Note is soft tinted paper with a hairline edge and a faint shadow.
- By night the canvas is a near-black room, and a Note's colour stops being pigment and becomes a neon edge and glow.
- The skeleton never moves: the same 16px corners, type, spacing and motion in both themes.

The wall of Notes is the product.
Notes are scanned, not read one at a time, so a Note's colour is an index: people find a Note again by remembering it was the green one.

## Tokens

Every colour is an OKLCH custom property in `src/styles/globals.css`, the single source for both themes.
There is no `tailwind.config.js`; Tailwind 4 reads its configuration from that CSS.

- **One accent**, Lamplight Amber by default, deep by day and bright by night.
- **Nine Note colours** plus none, stored on a Note or a Tag as a token such as `green`, never as a value.
  The theme and the colour-blind palette resolve the token, so the same Note is the right colour everywhere.
- **Two typefaces**, both bundled: Bricolage Grotesque for titles and Work Sans for text.
  The app makes no request at runtime, so a font CDN is not an option.

`src/styles/globals.test.ts` fails on any `oklch()` value outside sRGB, because a browser silently pulls such a colour back in, and then the shipped colour is not the one written down.

## Rules a change keeps

- **Neon is chrome, never text.** A Note's colour may touch its border, chips and glow, never its title or body.
- **One accent, on chrome only:** the brand mark, the active nav item, the capture button and the focus ring.
- **44px touch targets** for every control on a touch screen; compact density shrinks text and spacing, never hit areas.
- **DOM order is reading order.** The masonry wall is placed in JavaScript so that cards stay in reading and tab order.
- **Two feed layouts, Masonry and Stack,** with one card anatomy; the switch between them animates.
- **Reduced motion turns every animation off**, and every hover that scales also changes its fill or shadow, so state still shows without motion.
- **Glow only at night, shadow only by day.**
- **Labels are never smaller than 11px.**
- **Hierarchy survives the fallback font.** Greek, Cyrillic and other non-Latin titles fall back to the system font, so size, weight and colour each carry the hierarchy, not the typeface alone.

## Colour-blind palette

The colour-blind palette is a modifier, not a third theme: it composes with light or dark.
It re-values the nine Note colours to differ by lightness first and hue second, because under colour blindness hue alone collapses blue and purple into one colour.
Its numbers, and the audit to rerun before changing any palette value, are in `DESIGN.md`.
