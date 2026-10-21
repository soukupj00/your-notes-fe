import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { type Driver, driver, type PopoverDOM } from 'driver.js';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { TourPopover } from '@/components/tour/TourPopover.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useAsyncEffect } from '@/hooks/useAsyncEffect.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { holdBodyInert } from '@/lib/tour/inert.ts';
import {
  changesScene,
  leaveScene,
  stageRadiusOf,
  TOUR_STEPS,
  type TourStage,
} from '@/lib/tour/steps.ts';
import { waitFor, waitForTarget } from '@/lib/tour/waitFor.ts';
import 'driver.js/dist/driver.css';

/**
 * The Tour's lifecycle (ADR 0023): the `driver.js` instance, the router and the `inert` marking.
 * What the Tour decides lives in `src/lib/tour/`; how this file works, and why, is in
 * src/context/CLAUDE.md and the root CLAUDE.md, The Tour.
 */

type TourContextValue = {
  active: boolean;
  /** Runs the Tour from step 1. Safe to call twice. */
  start: () => void;
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

/** How far the cutout is held off the target it is cut over. */
const STAGE_PADDING = 8;

/**
 * Driver's own elements, the only ones left interactive. Named, not "anything added after the
 * start": whatever else portals to `body` mid-Tour must be marked inert too.
 */
function isDriverElement(node: Element): boolean {
  for (const name of node.classList) if (name.startsWith('driver-')) return true;
  return false;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { preferences, setPreference } = usePreferences();
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const router = useRouter();
  const href = useRouterState({ select: (state) => state.location.href });

  /** Which step is showing, or `null` when the Tour is not running. */
  const [index, setIndex] = useState<number | null>(null);
  /** True while a step's act is still running, so no control can be pressed twice. */
  const [busy, setBusy] = useState(false);

  // A node of our own, rendered ahead of driver and appended on `onPopoverRender`: driver positions
  // the box as that callback returns, and a React tree committed only then would still be empty.
  const [popoverHost] = useState(() => document.createElement('div'));

  const driverRef = useRef<Driver | null>(null);
  const releaseInertRef = useRef<(() => void) | null>(null);
  const indexRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const startedRef = useRef(false);
  /** Navigations the Tour itself asked for; anything else destroys it. */
  const ownNavigationsRef = useRef(0);

  const markNavigation = useCallback(() => {
    ownNavigationsRef.current += 1;
  }, []);

  /**
   * Every Tour navigation passes `resetScroll: false`, and it is load-bearing: the router's
   * scroll-to-top lands after driver's `scrollIntoView` and leaves the spotlight off-screen
   * (the measured race is in src/context/CLAUDE.md).
   */
  const makeStage = useCallback(
    (): TourStage => ({
      navigate: async (to) => {
        markNavigation();
        // `steps.ts` names routes as plain strings so it can stay clear of the
        // router's types; this is the one place that has to reconcile the two.
        await navigate({ to: to as '/settings', resetScroll: false });
      },
      back: () => {
        markNavigation();
        router.history.back();
      },
    }),
    [navigate, router, markNavigation]
  );

  const driverConfig = useCallback(
    (element: Element | null) => ({
      // Reduced motion is a hard killswitch, not a softening (DESIGN.md).
      animate: !reducedMotion,
      smoothScroll: !reducedMotion,
      // The Tour owns its own controls: driver renders no buttons, closes on
      // nothing, and its keyboard handling is replaced by the provider's.
      allowClose: false,
      allowKeyboardControl: false,
      disableActiveInteraction: true,
      overlayClickBehavior: () => {},
      // A token, not a colour: driver writes it into an inline `style.fill`, where `var()` still
      // follows the theme. The alpha is in the token, so opacity 1 stops driver multiplying it.
      overlayColor: 'var(--tour-scrim)',
      overlayOpacity: 1,
      stagePadding: STAGE_PADDING,
      stageRadius: stageRadiusOf(element),
      popoverClass: 'tour-popover',
      onPopoverRender: (popover: PopoverDOM) => {
        popover.wrapper.append(popoverHost);
      },
    }),
    [reducedMotion, popoverHost]
  );

  /**
   * Cuts the spotlight over the step's target, if any. Waits for `data-tour-step` first: driver
   * measures the popover once, and an empty box put step 1 half off the top of the window.
   */
  const showStep = useCallback(
    async (at: number) => {
      await waitFor(
        () => popoverHost.firstElementChild?.getAttribute('data-tour-step') === String(at),
        { label: `the popover to render step ${at + 1}` }
      );
      const target = TOUR_STEPS[at].target();
      // The act that produces the target has already run, but the app may still
      // be painting it. A step that never gets one is shown centred with no
      // spotlight rather than dropped - the copy is still worth reading.
      const element = target ? await waitForTarget(target) : null;
      driverRef.current?.setConfig(driverConfig(element));
      driverRef.current?.highlight({
        element: element ?? undefined,
        // Driver's own popover content is empty and hidden; ours is the child
        // appended by `onPopoverRender`.
        popover: { description: '', showButtons: [] },
      });
    },
    [driverConfig, popoverHost]
  );

  const setRunning = useCallback((running: boolean) => {
    busyRef.current = running;
    setBusy(running);
  }, []);

  const goTo = useCallback(
    async (to: number) => {
      const from = indexRef.current;
      if (from === null || busyRef.current) return;
      setRunning(true);

      try {
        if (changesScene(from, to)) {
          await leaveScene(from, makeStage());
          await TOUR_STEPS[to].enter?.(makeStage());
        }

        indexRef.current = to;
        setIndex(to);
        await showStep(to);
      } finally {
        // A step whose act threw still has to hand the controls back: a Tour
        // frozen on a disabled Next is worse than one that landed badly.
        setRunning(false);
      }
    },
    [makeStage, showStep, setRunning]
  );

  const end = useCallback(
    async ({ unwind }: { unwind: boolean }) => {
      const from = indexRef.current;
      if (from === null) return;

      // The popover goes the moment the user asks, so the press is answered at
      // once; the scrim outlives it by the length of the wind-down below.
      indexRef.current = null;
      setIndex(null);
      setRunning(false);

      try {
        // Not when the *user* navigated away: the Tour does not move them back.
        if (unwind) await leaveScene(from, makeStage());
      } finally {
        // An act that threw must not leave the user under an inert overlay with no way out.
        driverRef.current?.destroy();
        driverRef.current = null;
        releaseInertRef.current?.();
        releaseInertRef.current = null;
      }
    },
    [makeStage, setRunning]
  );

  const start = useCallback(async () => {
    if (indexRef.current !== null) return;

    // Only a replay starts off the Feed; the automatic run never moves someone who chose Settings.
    // Guarded: navigating to the current route changes no location, so the marker would miscount.
    if (router.state.location.pathname !== '/') {
      markNavigation();
      await navigate({ to: '/' });
    }

    // The Feed must be on screen: step 1 leaves from it and unwinding returns to it. This also
    // keeps the Tour out of anywhere that never paints one, so this wait's timeout is a normal
    // answer, not a bug.
    if (!(await waitForTarget('capture', { label: 'a Feed to start on' }))) return;

    // Driver measures the popover once, and the self-hosted fonts load async: measured in the
    // fallback face, step 1's box hung off the top of the window.
    await document.fonts?.ready;

    // Stamped when offered, not on completion, or it re-arms after every reload (ADR 0015).
    if (!preferences.onboardingSeenAt) {
      await setPreference('onboardingSeenAt', new Date().toISOString());
    }

    releaseInertRef.current = holdBodyInert(isDriverElement);
    driverRef.current = driver(driverConfig(null));

    indexRef.current = 0;
    setIndex(0);
    await TOUR_STEPS[0].enter?.(makeStage());
    await showStep(0);
  }, [
    router,
    navigate,
    markNavigation,
    preferences.onboardingSeenAt,
    setPreference,
    driverConfig,
    makeStage,
    showStep,
  ]);

  const goNext = useCallback(() => {
    const at = indexRef.current;
    if (at === null) return;
    if (at === TOUR_STEPS.length - 1) void end({ unwind: true });
    else void goTo(at + 1);
  }, [end, goTo]);

  const goBack = useCallback(() => {
    const at = indexRef.current;
    if (at === null || at === 0) return;
    void goTo(at - 1);
  }, [goTo]);

  const skip = useCallback(() => void end({ unwind: true }), [end]);

  // Startup: offer the Tour if it never was. A failed start is logged, and the app goes on
  // without a Tour.
  useAsyncEffect(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (preferences.onboardingSeenAt || router.state.location.pathname !== '/') return;
    await start().catch(console.error);
  }, [preferences.onboardingSeenAt, start, router]);

  // A navigation the Tour did not ask for destroys it: the app is inert, so the
  // only way one happens is the platform back button or gesture, and that is
  // the user leaving rather than something to be corrected.
  const lastHrefRef = useRef(href);
  useEffect(() => {
    if (href === lastHrefRef.current) return;
    lastHrefRef.current = href;
    if (indexRef.current === null) return;
    if (ownNavigationsRef.current > 0) {
      ownNavigationsRef.current -= 1;
      return;
    }
    void end({ unwind: false });
  }, [href, end]);

  // Esc skips and the arrows step, which is driver's own keyboard contract minus
  // the parts we turned off. Enter needs nothing: the popover's buttons are real
  // buttons, and `inert` means the focus ring cannot leave them.
  useEffect(() => {
    if (index === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') skip();
      else if (event.key === 'ArrowRight') goNext();
      else if (event.key === 'ArrowLeft') goBack();
      else return;
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [index, skip, goNext, goBack]);

  // Unmount is not a path the app takes, but a spotlight and an inert body are
  // both things that outlive React if nobody puts them back.
  useEffect(
    () => () => {
      driverRef.current?.destroy();
      releaseInertRef.current?.();
    },
    []
  );

  const value = useMemo(
    () => ({ active: index !== null, start: () => void start() }),
    [index, start]
  );

  return (
    <TourContext.Provider value={value}>
      {children}
      {index !== null &&
        createPortal(
          <TourPopover
            stepKey={TOUR_STEPS[index].key}
            index={index}
            total={TOUR_STEPS.length}
            busy={busy}
            onBack={goBack}
            onNext={goNext}
            onSkip={skip}
          />,
          popoverHost
        )}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const context = useContext(TourContext);
  if (!context) throw new Error('useTour must be used within a TourProvider');
  return context;
}

/**
 * Whether the Tour is running, for app-wide behaviours that stand down meanwhile. Unlike `useTour`
 * it tolerates no provider: its callers are rendered alone in tests, where that means "no Tour".
 */
export function useTourActive(): boolean {
  return useContext(TourContext)?.active ?? false;
}
