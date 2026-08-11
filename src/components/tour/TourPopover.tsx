import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';

/**
 * The Tour's popover, as React rather than as strings handed to `driver.js`.
 *
 * `TourProvider` portals this into driver's own popover element, so driver keeps
 * the one job it is good at - measuring a rect and placing a box beside it - and
 * everything the user reads or presses is the app's own: real `Button`s with the
 * app's focus ring and its 44px minimum, real `useTranslation` (so a language
 * change mid-Tour re-renders rather than leaving a stale string), and a counter
 * that counts the steps that will actually be shown.
 *
 * The whole surface is `data-testid="tour-popover"` because there is nothing
 * user-visible to address it by. Everything outside driver's element is `inert`
 * while the Tour runs, which takes it out of the accessibility tree, so a role
 * query would be ambiguous only inside this box - and this box has no landmark
 * of its own worth inventing.
 */
export function TourPopover({
  stepKey,
  index,
  total,
  busy,
  onBack,
  onNext,
  onSkip,
}: {
  /** Names the copy: `onboarding.steps.<stepKey>.title` and `.body`. */
  stepKey: string;
  /** Zero-based, so the counter reads `index + 1`. */
  index: number;
  total: number;
  /** True while a step's act is still running; every control waits for it. */
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const isFirst = index === 0;
  const isLast = index === total - 1;

  return (
    <div
      data-testid="tour-popover"
      // Which step this render is showing. `TourProvider` waits on it before
      // handing the box to driver.js, which measures the popover exactly once
      // to choose a side and never looks again - so it has to be measured with
      // this step's copy in it rather than the last one's, or none at all.
      data-tour-step={index}
      // The surface is painted here rather than on driver's wrapper, which is
      // left transparent so it can carry the safe-area padding that keeps this
      // box off a phone's home indicator (`globals.css`, the tour block).
      className="flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-3 rounded-card border bg-popover p-4 text-popover-foreground shadow-lift"
    >
      {/* One live region around the whole of what changes between steps, rather
          than two. A step is a single announcement - "this is the toolbar, and
          here is what it does" - and splitting the title from the body would
          have it read out as two. */}
      <div aria-live="polite" className="flex flex-col gap-1.5">
        <p className="text-label text-muted-foreground uppercase">
          {t('onboarding.progress', { current: index + 1, total })}
        </p>
        <h2 className="font-display text-foreground text-title">
          {t(`onboarding.steps.${stepKey}.title`)}
        </h2>
        {/* No interpolation. Step 3 used to end "and {{mod}} K finds any of
            them", which the Tour showed to every device including the ones with
            no modifier key to press (ADR 0016) - and unlike a hint chip that can
            be hidden, a clause is part of the sentence. It was also the only
            line in the Tour naming a key rather than a place the step points at,
            so the copy lost nothing by dropping it. */}
        <p className="text-body text-muted-foreground">{t(`onboarding.steps.${stepKey}.body`)}</p>
      </div>

      <div className="flex items-center justify-between gap-2">
        {/* Skip keeps the left edge on every step, so the way out never moves. */}
        <Button type="button" variant="ghost" className="min-h-11" disabled={busy} onClick={onSkip}>
          {t('onboarding.buttons.skip')}
        </Button>

        <div className="flex items-center gap-2">
          {/* Step 1 has nothing behind it, so it renders no Back at all rather
              than a disabled one: a control that is never usable on this step is
              not a control the user has to read. */}
          {!isFirst && (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={busy}
              onClick={onBack}
            >
              {t('onboarding.buttons.back')}
            </Button>
          )}
          <Button type="button" className="min-h-11" disabled={busy} onClick={onNext}>
            {t(isLast ? 'onboarding.buttons.done' : 'onboarding.buttons.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
