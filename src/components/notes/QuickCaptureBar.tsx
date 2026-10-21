import { Plus } from 'lucide-react';
import { m } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FLOATING_BOTTOM_BAR } from '@/components/notes/floatingBottomBar.ts';
import { resolveQuickCapture } from '@/components/notes/quickCaptureLayout.ts';
import { useStartPicker } from '@/components/notes/useStartPicker.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import type { Intent } from '@/lib/intent.ts';
import { NIGHTSHIFT_SPRING, resolveTransition } from '@/lib/motion.ts';
import { cn } from '@/lib/utils.ts';

// A Popover rather than hand-rolled state, so tap-outside, Esc and focus come for free.
export function QuickCaptureBar({ onStart }: { onStart: (intent?: Intent) => void }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const transition = resolveTransition(reducedMotion);
  const { preferences } = usePreferences();
  const actions = resolveQuickCapture(preferences.quickCapture);
  // A picker Start opens the OS picker here, inside the tap (`useStartPicker`).
  const picker = useStartPicker(onStart);
  // The dial, its labels and the popover all follow this edge, so a left-handed layout is a
  // true mirror.
  const left = preferences.noteButtonAlignment === 'left';

  return (
    <div className={cn(FLOATING_BOTTOM_BAR, 'sm:hidden', left ? 'justify-start' : 'justify-end')}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          {/* The Tour reads this or its desktop twin as the Feed being on screen. */}
          <Button
            type="button"
            size="icon"
            data-tour="capture"
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
          {/* `flex-col-reverse`, not a reversed array: the first start sits nearest the thumb and
              stays first in tab and screen-reader order. */}
          <ul className={cn('flex flex-col-reverse gap-2', left ? 'items-start' : 'items-end')}>
            {actions.map((action, index) => (
              <m.li
                key={action.key}
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
                    picker.start(action);
                  }}
                  className="min-h-11 rounded-full border border-input bg-card shadow-rest hover:bg-accent hover:shadow-lift"
                >
                  <action.Icon className="size-5" aria-hidden />
                  {t(action.labelKey)}
                </Button>
              </m.li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      {picker.input}
    </div>
  );
}
