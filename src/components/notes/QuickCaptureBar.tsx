import { Plus } from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FLOATING_BOTTOM_BAR } from '@/components/notes/floatingBottomBar.ts';
import type { EditingState } from '@/components/notes/NotesView.tsx';
import { resolveQuickCapture } from '@/components/notes/quickCaptureLayout.ts';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { INSTANT_TRANSITION, NIGHTSHIFT_SPRING } from '@/lib/motion.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Mobile quick capture: one `＋` that expands into the five ways to start a
 * note. A Popover rather than hand-rolled state, so tap-outside and Esc close
 * it and focus is managed for free.
 */
export function QuickCaptureBar({ onStart }: { onStart: (editing: EditingState) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const transition = reducedMotion ? INSTANT_TRANSITION : NIGHTSHIFT_SPRING;
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
          <Button
            type="button"
            size="icon"
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
          <ul className={cn('flex flex-col gap-2', left ? 'items-start' : 'items-end')}>
            {actions.map(({ key, Icon, labelKey, editing }, index) => (
              <m.li
                key={key}
                initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={
                  reducedMotion
                    ? INSTANT_TRANSITION
                    : { ...NIGHTSHIFT_SPRING, delay: index * 0.035 }
                }
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
