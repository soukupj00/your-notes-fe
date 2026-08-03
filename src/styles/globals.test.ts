/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Every colour in the stylesheet has to be reachable in sRGB.
 *
 * OKLCH can express colours no sRGB display can show. CSS does not error on
 * those - it gamut-maps them, reducing chroma until the colour fits. So an
 * out-of-gamut literal renders as something other than what was written, and
 * renders *differently* depending on the display: a P3 laptop gets closer to
 * the authored value than an sRGB monitor does. A design contract written from
 * measurement (DESIGN.md) cannot survive that, because the measured value and
 * the shipped value stop being the same number.
 *
 * This guards the whole file rather than the tokens someone remembered to
 * check. It caught the day accent sitting 34% outside sRGB, which is the exact
 * colour The Two-Constraint Rule was resolved against.
 */

// Read from disk rather than imported: Vitest runs with `css: false`, so a
// `./globals.css?raw` import is stubbed to an empty string and every assertion
// below would pass against nothing. The file-local `node:fs` reference above is
// what keeps Node's types out of the browser app's TS program while still
// typing this one test. The path is relative to the project root, where Vitest
// runs.
const CSS: string = readFileSync('src/styles/globals.css', 'utf8');

/** `oklch(94.6% 0.056 24)` - literals only; `var()` and `color-mix()` resolve at runtime. */
const OKLCH = /oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*(?:\/[^)]*)?\)/g;

/** OKLCH -> linear sRGB (Ottosson's coefficients). */
function toLinearSrgb(L: number, C: number, H: number): [number, number, number] {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** A hair of tolerance, so a value sitting exactly on the boundary is not a failure. */
const EPSILON = 0.001;

const inGamut = (L: number, C: number, H: number) =>
  toLinearSrgb(L, C, H).every((v) => v >= -EPSILON && v <= 1 + EPSILON);

type Literal = { raw: string; L: number; C: number; H: number; line: number };

function literals(): Literal[] {
  const found: Literal[] = [];
  CSS.split('\n').forEach((line: string, index: number) => {
    for (const match of line.matchAll(OKLCH)) {
      found.push({
        raw: match[0],
        L: Number(match[1]) / 100,
        C: Number(match[2]),
        H: Number(match[3]),
        line: index + 1,
      });
    }
  });
  return found;
}

describe('globals.css colour literals', () => {
  it('parses a meaningful number of colours, so a broken regex cannot pass vacuously', () => {
    expect(literals().length).toBeGreaterThan(50);
  });

  it('keeps every colour inside sRGB, so the authored value is the rendered value', () => {
    const escaped = literals()
      .filter((c) => !inGamut(c.L, c.C, c.H))
      .map((c) => `globals.css:${c.line} ${c.raw}`);

    expect(escaped).toEqual([]);
  });
});
