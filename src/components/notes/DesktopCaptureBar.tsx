import { animate, m, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NoteOpenRequest } from '@/components/notes/NotesView.tsx';
import { resolveDesktopQuickCapture } from '@/components/notes/quickCaptureLayout.ts';
import { Button } from '@/components/ui/button.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useTourActive } from '@/context/TourProvider.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { resolveTransition } from '@/lib/motion.ts';

/** Prompts the bar cycles through, in order. The first is the resting copy. */
const PLACEHOLDER_KEYS = [
  'notes.placeholders.default',
  'notes.placeholders.thought',
  'notes.placeholders.todo',
  'notes.placeholders.idea',
  'notes.placeholders.remember',
] as const;

const ROTATE_MS = 5000;
/** Per character, so the longest string (22 chars in cs) types for under a
 *  second and leaves the rest of the beat still. */
const CHAR_MS = 45;

/**
 * The desktop "Take a note" bar: a text-cursor affordance that opens a blank
 * draft, plus the same five quick-capture starts the mobile speed-dial offers
 * (minus plain text - the bar itself is that one), so the two cannot drift.
 *
 * The prompt cycles slowly to hint at what a note can be, each one typing
 * itself in. It is decoration, so reduced motion pins it to the resting copy
 * rather than merely speeding it up.
 */
export function DesktopCaptureBar({ onStart }: { onStart: (state: NoteOpenRequest) => void }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const tourActive = useTourActive();
  const [index, setIndex] = useState(0);
  const { preferences } = usePreferences();
  const actions = resolveDesktopQuickCapture(preferences.quickCapture);

  // Whether a rotation has ever fired. Until one has, a prompt is *presented*
  // rather than typed: translations arrive over HTTP, so on a cold load the
  // resting copy changes from its raw key to real words with no rotation
  // involved, and that is not a thing the user asked to watch being written.
  const hasRotated = useRef(false);

  // The rotation stands down during the Tour: step 1 spotlights this bar, and
  // its content must hold still while the popover explaining it is read.
  useEffect(() => {
    if (reducedMotion || tourActive) return;
    const id = setInterval(() => {
      hasRotated.current = true;
      setIndex((i) => (i + 1) % PLACEHOLDER_KEYS.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [reducedMotion, tourActive]);

  const key = PLACEHOLDER_KEYS[reducedMotion ? 0 : index];
  const placeholder = t(key);

  // The reveal is a character count animated over the string, rendered through
  // a MotionValue so the per-character update writes to the DOM directly
  // instead of re-rendering the feed's parent 20 times a second.
  const revealed = useMotionValue(placeholder.length);
  const typed = useTransform(revealed, (count) => placeholder.slice(0, Math.round(count)));

  // Keyed on the *string*, not the index: a language switch mid-beat changes the
  // text under a count parked at the old length, which would render the new
  // prompt truncated until the next rotation. Retyping it is both the fix and
  // the honest thing to show.
  //
  // `hasRotated` is read here rather than during render because a ref is not
  // render data - and it does not need to be a dependency: the only thing that
  // flips it is the rotation, which changes `placeholder` in the same tick.
  //
  // Layout, not passive: React commits the new string while the count is still
  // parked at the *previous* one's length, so the transform yields the whole of
  // the new prompt. Left to a passive effect that lands one frame after paint,
  // and every swap flashes its finished text before typing it.
  useLayoutEffect(() => {
    // Both reasons to arrive at once - the preference, and a prompt that was
    // never rotated to - are the same answer, so they take the same route as
    // every other animated surface in the app.
    const instant = reducedMotion || !hasRotated.current;
    // From 1, not 0 - the swap should never flash an empty line.
    if (!instant) revealed.jump(1);
    const animation = animate(
      revealed,
      placeholder.length,
      resolveTransition(instant, {
        duration: (placeholder.length * CHAR_MS) / 1000,
        ease: 'linear',
      })
    );
    return () => animation.stop();
  }, [placeholder, reducedMotion, revealed]);

  return (
    // `data-tour` goes on the whole bar here, not on one control: unlike the
    // mobile dial, the bar *is* the affordance, and its five icons are the thing
    // step 1 is describing. Its twin is `QuickCaptureBar`; both are always
    // mounted, so `lib/tour/targets.ts` picks by which one has a client rect.
    <div
      data-tour="capture"
      className="mx-auto mb-6 hidden max-w-lg items-center gap-1 rounded-card border bg-card pr-2 shadow-rest transition-shadow hover:shadow-lift sm:flex"
    >
      <button
        type="button"
        onClick={() => onStart({ id: null })}
        // `cursor-text`: the bar looks like a text field and opens straight into
        // one, so the pointer should promise typing, not a navigation.
        className="min-h-11 flex-1 cursor-text px-4 py-3 text-left text-body text-muted-foreground transition-colors hover:text-foreground"
      >
        {/* The rotation is cosmetic: assistive tech gets the one stable label
            rather than a prompt that renames itself every five seconds.
            `data-prompt` is what the tests read - the visible text is written
            outside React by the MotionValue, so fake timers cannot see it. */}
        <m.span aria-hidden data-testid="capture-prompt" data-prompt={key}>
          {typed}
        </m.span>
        <span className="sr-only">{t('notes.createPlaceholder')}</span>
      </button>

      {actions.map(({ key, Icon, labelKey, editing }) => (
        <Button
          key={key}
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t(labelKey)}
          onClick={() => onStart(editing)}
        >
          <Icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}

export default DesktopCaptureBar;
