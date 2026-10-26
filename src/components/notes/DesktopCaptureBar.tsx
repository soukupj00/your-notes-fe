import { animate, m, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { resolveDesktopQuickCapture } from '@/components/notes/quickCaptureLayout.ts';
import { useStartPicker } from '@/components/notes/useStartPicker.tsx';
import { Button } from '@/components/ui/button.tsx';
import { IconTooltip } from '@/components/ui/tooltip.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useFinePointer } from '@/hooks/useFinePointer.ts';
import { useKeyboardAffordances } from '@/hooks/useKeyboardAffordances.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { useShortcuts } from '@/hooks/useShortcuts.ts';
import type { Intent } from '@/lib/intent.ts';
import { ariaKeyShortcuts, comboLabel } from '@/lib/key-combo.ts';
import { resolveTransition } from '@/lib/motion.ts';

/** The first is the resting copy. */
const PLACEHOLDER_KEYS = [
  'notes.placeholders.default',
  'notes.placeholders.thought',
  'notes.placeholders.todo',
  'notes.placeholders.idea',
  'notes.placeholders.remember',
] as const;

const ROTATE_MS = 5000;
// Per character: the longest prompt (22 chars in cs) types in under a second.
const CHAR_MS = 45;

/**
 * The desktop twin of the mobile speed-dial, minus plain text, which the bar itself is.
 * The rotating prompt is decoration, so reduced motion pins it to the resting copy.
 */
export function DesktopCaptureBar({ onStart }: { onStart: (intent?: Intent) => void }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const { preferences } = usePreferences();
  const finePointer = useFinePointer();
  const actions = resolveDesktopQuickCapture(preferences.quickCapture, finePointer);
  const newNoteKey = useShortcuts().bindings['new-note'];
  const showShortcut = useKeyboardAffordances();
  // A picker Start opens the OS picker here, inside the click (`useStartPicker`).
  const picker = useStartPicker(onStart);

  // Until a rotation fires, a prompt appears rather than types: on a cold load the copy swaps
  // from its raw key to words as translations arrive, which nobody should watch being typed.
  const hasRotated = useRef(false);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => {
      hasRotated.current = true;
      setIndex((i) => (i + 1) % PLACEHOLDER_KEYS.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const key = PLACEHOLDER_KEYS[reducedMotion ? 0 : index];
  const placeholder = t(key);

  // A MotionValue writes each character to the DOM directly, rather than re-rendering the
  // feed's parent 20 times a second.
  const revealed = useMotionValue(placeholder.length);
  const typed = useTransform(revealed, (count) => placeholder.slice(0, Math.round(count)));

  // Keyed on the string, so a language switch retypes instead of truncating. A layout effect,
  // or every new prompt paints in full for a frame before typing. `hasRotated` needs no
  // dependency: only the rotation flips it, and that changes `placeholder` in the same tick.
  useLayoutEffect(() => {
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
    // As wide as the navbar's search container, so `--feed-column` agrees with the search box.
    <div className="@container mb-6 hidden sm:block">
      {/* The Welcome marks this or its `QuickCaptureBar` twin. */}
      <div
        data-tour="capture"
        className="@container mx-auto flex feed-row:max-w-(--feed-column) max-w-lg items-center gap-1 rounded-card border bg-card pr-2 shadow-rest transition-shadow hover:shadow-lift"
      >
        <button
          type="button"
          onClick={() => onStart()}
          aria-keyshortcuts={newNoteKey ? ariaKeyShortcuts(newNoteKey) : undefined}
          className="flex min-h-11 min-w-0 flex-1 cursor-text items-center gap-3 px-4 py-3 text-left text-body text-muted-foreground transition-colors hover:text-foreground"
        >
          {/* Assistive tech gets one stable label, not a prompt renaming itself every five seconds.
            Tests read `data-prompt`: the MotionValue writes the visible text outside React. */}
          <m.span aria-hidden data-testid="capture-prompt" data-prompt={key} className="truncate">
            {typed}
          </m.span>
          <span className="sr-only">{t('notes.createPlaceholder')}</span>
          {/* Only once there is a keyboard (ADR 0028), and only where the longest prompt still fits
            beside it; `aria-keyshortcuts` tells assistive tech either way. */}
          {newNoteKey && showShortcut && (
            <kbd
              aria-hidden
              className="ml-auto @md:block hidden select-none rounded border bg-muted px-1.5 py-0.5 font-medium font-sans text-label text-muted-foreground tracking-normal"
            >
              {comboLabel(newNoteKey)}
            </kbd>
          )}
        </button>

        {actions.map((action) => (
          <IconTooltip key={action.key} label={t(action.labelKey)}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t(action.labelKey)}
              onClick={() => picker.start(action)}
            >
              <action.Icon className="size-4" />
            </Button>
          </IconTooltip>
        ))}
        {picker.input}
      </div>
    </div>
  );
}

export default DesktopCaptureBar;
