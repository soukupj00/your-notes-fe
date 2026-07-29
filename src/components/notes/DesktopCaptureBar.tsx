import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditingState } from '@/components/notes/NotesView.tsx';
import { DESKTOP_QUICK_CAPTURE_ACTIONS } from '@/components/notes/quickCaptureActions.ts';
import { Button } from '@/components/ui/button.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';

/** Prompts the bar cycles through, in order. The first is the resting copy. */
const PLACEHOLDER_KEYS = [
  'notes.placeholders.default',
  'notes.placeholders.thought',
  'notes.placeholders.todo',
  'notes.placeholders.idea',
  'notes.placeholders.remember',
] as const;

const ROTATE_MS = 5000;

/**
 * The desktop "Take a note" bar: a text-cursor affordance that opens a blank
 * draft, plus the same five quick-capture starts the mobile speed-dial offers
 * (minus plain text - the bar itself is that one), so the two cannot drift.
 *
 * The prompt cycles slowly to hint at what a note can be. It is decoration, so
 * reduced motion pins it to the resting copy rather than merely speeding it up.
 */
export function DesktopCaptureBar({ onStart }: { onStart: (state: EditingState) => void }) {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % PLACEHOLDER_KEYS.length), ROTATE_MS);
    return () => clearInterval(id);
  }, [reducedMotion]);

  const placeholder = t(PLACEHOLDER_KEYS[reducedMotion ? 0 : index]);

  return (
    <div className="mx-auto mb-6 hidden max-w-lg items-center gap-1 rounded-lg border bg-background pr-2 shadow-sm transition-shadow hover:shadow sm:flex">
      <button
        type="button"
        onClick={() => onStart({ id: null })}
        // `cursor-text`: the bar looks like a text field and opens straight into
        // one, so the pointer should promise typing, not a navigation.
        className="flex-1 cursor-text px-4 py-3 text-left text-muted-foreground transition-colors hover:text-foreground"
      >
        {/* The rotation is cosmetic: assistive tech gets the one stable label
            rather than a prompt that renames itself every five seconds. */}
        <span aria-hidden className="transition-opacity duration-300">
          {placeholder}
        </span>
        <span className="sr-only">{t('notes.createPlaceholder')}</span>
      </button>

      {DESKTOP_QUICK_CAPTURE_ACTIONS.map(({ key, Icon, labelKey, editing }) => (
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
