import { useRouter, useRouterState } from '@tanstack/react-router';
import { type CSSProperties, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { holdBodyInert } from '@/lib/tour/inert.ts';
import { stageRadiusOf } from '@/lib/tour/steps.ts';
import { waitForTarget } from '@/lib/tour/waitFor.ts';
import { type Box, placeCallout, WELCOME_MARKS } from '@/lib/tour/welcome.ts';
import { cn, rootFontPx } from '@/lib/utils.ts';

/** Matches the Tour's stage padding, so a hole sits off its target the same way. */
const HOLE_PADDING = 8;
const ARROW_GAP = 10;
const VIEWPORT_INSET = 3;
const MASK_ID = 'welcome-scrim-mask';

interface Mark {
  key: string;
  hole: Box;
  radius: number;
}

// The gear sits in a corner, so its padded hole is kept on screen or the ring loses two sides.
function holeAround(element: Element, viewport: { width: number; height: number }): Box {
  const rect = element.getBoundingClientRect();
  const left = Math.max(VIEWPORT_INSET, rect.left - HOLE_PADDING);
  const top = Math.max(VIEWPORT_INSET, rect.top - HOLE_PADDING);
  const right = Math.min(viewport.width - VIEWPORT_INSET, rect.right + HOLE_PADDING);
  const bottom = Math.min(viewport.height - VIEWPORT_INSET, rect.bottom + HOLE_PADDING);
  return { left, top, width: right - left, height: bottom - top };
}

function measure(
  elements: readonly Element[],
  viewport: { width: number; height: number }
): Mark[] {
  return WELCOME_MARKS.map(({ key }, index) => {
    const element = elements[index];
    return {
      key,
      hole: holeAround(element, viewport),
      radius: stageRadiusOf(element) + HOLE_PADDING,
    };
  });
}

/**
 * The launch Welcome (ADR 0024): one overlay, offered once on the Feed, whose marks point at where
 * to begin. Not a Tour: nothing steps, and one press dismisses it.
 */
export function Welcome() {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const router = useRouter();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [elements, setElements] = useState<Element[] | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [host] = useState(() => document.createElement('div'));
  const offeredRef = useRef(false);
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Stamped when offered, like the Tour (ADR 0015). Waits for the marks, never a timer, and also
  // for the fonts, since a callout measured in the fallback face would land elsewhere.
  useAsyncEffect(
    async (alive) => {
      if (preferences.welcomeSeenAt || pathname !== '/') return;
      const found = await Promise.all(WELCOME_MARKS.map(({ target }) => waitForTarget(target)));
      await document.fonts?.ready;
      if (!alive() || offeredRef.current || found.some((element) => !element)) return;
      offeredRef.current = true;
      setElements(found as Element[]);
      await setPreference('welcomeSeenAt', new Date().toISOString());
    },
    [pathname, preferences.welcomeSeenAt, setPreference]
  );

  const open = elements !== null;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement;
    document.body.append(host);
    const release = holdBodyInert((node) => node === host);
    // Not `autoFocus`: React focuses while the host is still detached, and that focus is lost.
    dismissRef.current?.focus();
    // The app is inert, so a navigation is Back or Forward: the user has left the Feed it marks.
    const stopListening = router.subscribe('onBeforeNavigate', (event) => {
      if (event.pathChanged) setElements(null);
    });
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setElements(null);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      stopListening();
      release();
      host.remove();
      if (previous instanceof HTMLElement) previous.focus();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, host, router]);

  if (!elements) return null;

  const marks = measure(elements, viewport);
  const width = Math.min(16 * rootFontPx(), viewport.width - 32);

  return createPortal(
    <div
      data-testid="welcome"
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      aria-describedby="welcome-body"
      className="fixed inset-0 z-50"
    >
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <mask id={MASK_ID}>
            <rect width="100%" height="100%" fill="white" />
            {marks.map(({ key, hole, radius }) => (
              <rect
                key={key}
                x={hole.left}
                y={hole.top}
                width={hole.width}
                height={hole.height}
                rx={radius}
                fill="black"
              />
            ))}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          style={{ fill: 'var(--scrim)' }}
          mask={`url(#${MASK_ID})`}
        />
      </svg>

      {marks.map(({ key, hole, radius }) => {
        const placement = placeCallout(hole, viewport, { width, gap: ARROW_GAP });
        const below = placement.side === 'below';
        const edge: CSSProperties = below
          ? { top: placement.offset }
          : { bottom: placement.offset };
        return (
          <div key={key}>
            {/* The Tour's cutout ring, which also carries its night glow. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute"
              style={{
                left: hole.left,
                top: hole.top,
                width: hole.width,
                height: hole.height,
                borderRadius: radius,
                boxShadow: 'var(--tour-cutout-ring)',
              }}
            />
            <p
              data-testid={`welcome-mark-${key}`}
              className="absolute rounded-card border bg-popover p-3 text-body text-popover-foreground shadow-lift"
              style={{ left: placement.left, width, ...edge }}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute size-3 rotate-45 bg-popover',
                  below ? 'border-t border-l' : 'border-r border-b'
                )}
                style={{ left: placement.arrow - 6, [below ? 'top' : 'bottom']: -7 }}
              />
              {t(`welcome.marks.${key}`)}
            </p>
          </div>
        );
      })}

      <div className="absolute inset-x-4 top-1/2 mx-auto flex max-w-sm -translate-y-1/2 flex-col gap-3 rounded-card border bg-popover p-5 text-popover-foreground shadow-lift">
        <h2 id="welcome-title" className="font-display text-foreground text-title">
          {t('welcome.title')}
        </h2>
        <p id="welcome-body" className="text-body text-muted-foreground">
          {t('welcome.body')}
        </p>
        <Button
          ref={dismissRef}
          type="button"
          className="min-h-11 self-end"
          onClick={() => setElements(null)}
        >
          {t('welcome.dismiss')}
        </Button>
      </div>
    </div>,
    host
  );
}
