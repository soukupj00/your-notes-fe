import { Plus } from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FLOATING_BOTTOM_BAR } from '@/components/notes/floatingBottomBar.ts';
import type { NoteOpenRequest } from '@/components/notes/NotesView.tsx';
import { resolveQuickCapture } from '@/components/notes/quickCaptureLayout.ts';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { NIGHTSHIFT_SPRING, resolveTransition } from '@/lib/motion.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Mobile quick capture: one `＋` that expands into the five ways to start a
 * note. A Popover rather than hand-rolled state, so tap-outside and Esc close
 * it and focus is managed for free.
 */
export function QuickCaptureBar({ onStart }: { onStart: (editing: NoteOpenRequest) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const transition = resolveTransition(reducedMotion);
  const { preferences } = usePreferences();
  const actions = resolveQuickCapture(preferences.quickCapture);
  // Which thumb has to reach it. The dial, its labels and the popover all follow
  // the same edge, so a left-handed layout is the mirror rather than a FAB that
  // moved and a menu that did not.
  const left = preferences.noteButtonAlignment === 'left';

  return (
    <div className={cn(FLOATING_BOTTOM_BAR, 'sm:hidden', left ? 'justify-start' : 'justify-end')}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* `data-tour` sits on the `＋` itself rather than on the wrapper: the
              wrapper is a full-width bar pinned to the bottom edge, and a
              spotlight cut over it would be a letterbox across the screen
              instead of a circle round the button. Its twin is the desktop
              capture bar; `lib/tour/targets.ts` picks whichever of the two is
              visible at this width. */}
          <Button
            type="button"
            size="icon"
            data-tour="capture"
            // The control that *opens* the dial, marked apart from the thing
            // step 1 points at even though they are the same element here. Only
            // this width has one, so its presence is how a step knows there is
            // a dial at all: the desktop bar carries `capture` too and has
            // nothing to open. A second attribute rather than a second
            // `data-tour` value, because one element cannot hold two.
            data-tour-toggle=""
            aria-label={t('notes.capture.open')}
            className="size-14 rounded-full bg-primary text-primary-foreground shadow-lift hover:bg-primary/90 hover:shadow-lift"
          >
            <m.span animate={{ rotate: reducedMotion ? 0 : open ? 45 : 0 }} transition={transition}>
              <Plus className="size-6" />
            </m.span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          side="top"
          align={left ? 'start' : 'end'}
          sideOffset={12}
          className="w-auto border-0 bg-transparent p-0 shadow-none"
        >
          {/* `flex-col-reverse`, not a reversed array: the dial radiates *out of*
              the `＋`, so the first start belongs nearest the thumb and the last
              furthest from it. Reversing the array instead would put the primary
              start last in the DOM, which is also last in the tab order and last
              to a screen reader - the order the user arranged in settings is a
              priority, and it has to survive in every reading of the list, not
              just the visual one. The stagger then falls out for free: index 0 is
              the button next to the `＋`, so the menu unrolls away from it. */}
          {/* The Tour spotlights the open dial rather than the `＋` that opened
              it: the starts unfold above the button, so a cutout over the button
              alone would leave the five things the step is about under the
              scrim (`lib/tour/targets.ts`). */}
          <ul
            data-tour="capture-dial"
            className={cn('flex flex-col-reverse gap-2', left ? 'items-start' : 'items-end')}
          >
            {actions.map(({ key, Icon, labelKey, editing }, index) => (
              <m.li
                key={key}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={resolveTransition(reducedMotion, {
                  ...NIGHTSHIFT_SPRING,
                  delay: index * 0.035,
                })}
              >
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setOpen(false);
                    onStart(editing);
                  }}
                  className="min-h-11 rounded-full border border-input bg-card shadow-rest hover:bg-accent hover:shadow-lift"
                >
                  <Icon className="size-5" aria-hidden />
                  {t(labelKey)}
                </Button>
              </m.li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
    </div>
  );
}
