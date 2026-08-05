/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

/** Every `.ts`/`.tsx` under `src/`, excluding tests, as one blob to grep. */
function sourceFiles(dir = 'src'): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!/\.tsx?$/.test(entry.name) || entry.name.includes('.test.')) return [];
    return [path];
  });
}

/**
 * Density is a stylesheet feature that only works if the components cooperate,
 * and neither half is reachable from jsdom - there is no cascade and no
 * `@theme`, so "the card got smaller" cannot be asserted the way a click can.
 * These are the two things that *are* checkable statically, and they are the
 * two ways this actually breaks.
 */
describe('density', () => {
  const COMPACT_BLOCK = /:root\[data-density="compact"\]\s*\{([^}]*)\}/;

  it('re-values exactly the bundle DESIGN.md specifies for compact', () => {
    const block = CSS.match(COMPACT_BLOCK);
    expect(block, 'no :root[data-density="compact"] block in globals.css').not.toBeNull();

    const declared = [...(block?.[1] ?? '').matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]).sort();

    // Type *and* rhythm, together. A compact mode that tightened the gaps but
    // left 1.04rem titles would be a denser wall of same-sized cards, which is
    // not what "more wall at once" means.
    expect(declared).toEqual(['--card-pad', '--feed-gap', '--text-body', '--text-title']);
  });

  it('leaves no component spending the comfortable values as literals', () => {
    // The failure this catches is silent: a hardcoded `p-[0.9rem_1rem_0.85rem]`
    // looks identical to the token in the comfortable default and simply
    // ignores the preference, so nothing looks wrong until someone switches.
    const offenders = sourceFiles()
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .filter(({ text }) => /(?:p|gap)-\[0\.(?:9rem_1rem_0\.85rem|85rem)\]/.test(text))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

/**
 * The Touch Rule has two mechanisms and the wrong one deforms the control.
 * `.touch-target` grows the element to 44px, `.touch-reach` hangs an invisible
 * 44px box off its centre and leaves it drawn at its own size.
 */
describe('touch targets', () => {
  it('keeps the two mechanisms distinct, so neither can absorb the other', () => {
    const grow = CSS.match(/\.touch-target\s*\{([^}]*)\}/)?.[1] ?? '';
    const reach = CSS.match(/\.touch-reach::before\s*\{([^}]*)\}/)?.[1] ?? '';

    expect(grow).toMatch(/min-width:\s*44px/);
    expect(grow).toMatch(/min-height:\s*44px/);
    // A reach that set a minimum would resize the control it exists not to.
    expect(reach).not.toMatch(/min-width|min-height/);
    expect(reach).toMatch(/width:\s*44px/);
    expect(reach).toMatch(/height:\s*44px/);
  });

  it('never grows a Switch, whose shape is part of what it says', () => {
    // A switch track is a 20x36 `rounded-full` pill. Forced to a 44x44 minimum
    // it renders as a circle with a dot in it - which is what every switch in
    // the app looked like on a phone until this was split in two.
    const offenders = sourceFiles()
      .map((path) => ({ path, text: readFileSync(path, 'utf8') }))
      .filter(({ text }) =>
        [...text.matchAll(/<Switch\b[^>]*>/gs)].some((tag) => tag[0].includes('touch-target'))
      )
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });
});

/**
 * The stored preference has to beat the OS query in both directions, and CSS is
 * the half `useReducedMotion` cannot reach. This does not prove a given rule is
 * correctly scoped - it is a drift alarm: adding a `prefers-reduced-motion`
 * block without its two escape hatches makes the Settings control quietly stop
 * being authoritative over whatever that block governs.
 */
describe('reduced motion', () => {
  it('pairs every prefers-reduced-motion block with both preference overrides', () => {
    const queries = CSS.match(/prefers-reduced-motion/g)?.length ?? 0;
    expect(queries).toBeGreaterThan(0);

    expect(CSS.match(/\[data-reduced-motion="never"\]/g)?.length ?? 0).toBe(queries);
    expect(CSS.match(/\[data-reduced-motion="always"\]/g)?.length ?? 0).toBe(queries);
  });
});
