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
import { useTranslation } from 'react-i18next';
import { TourPopover } from '@/components/tour/TourPopover.tsx';
import { usePreferences } from '@/context/PreferencesProvider.tsx';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useNoteActions } from '@/hooks/data/useNoteActions.ts';
import { useReducedMotion } from '@/hooks/useReducedMotion.ts';
import { holdBodyInert } from '@/lib/tour/inert.ts';
import {
  createProps,
  purgeProps,
  readProps,
  rebaseProp,
  type TourProp,
  writeProps,
} from '@/lib/tour/props.ts';
import {
  changesScene,
  leaveScene,
  stageRadiusOf,
  TOUR_STEPS,
  type TourStage,
} from '@/lib/tour/steps.ts';
import { noteCardTarget, resolveTourTarget, tourTargetSelector } from '@/lib/tour/targets.ts';
import { waitFor } from '@/lib/tour/waitFor.ts';
import 'driver.js/dist/driver.css';

/**
 * The Tour's lifecycle (ADR 0015): the `driver.js` instance, the router, the Props' persistence and
 * the `inert` marking. What the Tour decides lives in `src/lib/tour/`; how this file works, and
 * why, is in src/context/CLAUDE.md and the root CLAUDE.md, The Tour.
 */

type TourContextValue = {
  active: boolean;
  /** Runs the Tour from step 1 on a fresh set of Props. Safe to call twice. */
  start: () => void;
};

const TourContext = createContext<TourContextValue | undefined>(undefined);

/** How far the cutout is held off the target it is cut over. */
const STAGE_PADDING = 8;

/**
 * Driver's own elements, the only ones left interactive. Named, not "anything added after the
 * start": the speed dial's Radix popover portals to `body` too and must be marked inert.
 */
function isDriverElement(node: Element): boolean {
  for (const name of node.classList) if (name.startsWith('driver-')) return true;
  return false;
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { preferences, setPreference } = usePreferences();
  const store = useLocalStore();
  const { purgeNote, pinNote, unpinNote } = useNoteActions();
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
  const [popoverHost] = useState(() => {
    const host = document.createElement('div');
    // `aria-live` is what a modal Radix dialog's `hideOthers` spares, so the buttons stay in the
    // accessibility tree when step 2's editor opens. `off`, not `polite`: `TourPopover`'s step
    // region already announces, and a second live region would re-read "Next".
    host.setAttribute('aria-live', 'off');
    return host;
  });

  const driverRef = useRef<Driver | null>(null);
  const releaseInertRef = useRef<(() => void) | null>(null);
  const propsRef = useRef<TourProp[]>([]);
  const indexRef = useRef<number | null>(null);
  const busyRef = useRef(false);
  const startedRef = useRef(false);
  /** Which Prop the Tour has open in the editor, so its baseline is re-taken. */
  const openedPropRef = useRef<string | null>(null);
  /** Navigations the Tour itself asked for; anything else destroys it. */
  const ownNavigationsRef = useRef(0);
  /** Prop writes still in flight, which the sweep must not overtake. */
  const writesRef = useRef<Promise<unknown>>(Promise.resolve());

  /**
   * The Tour's presses stop at the popover: Radix's dismissable layers read Next as a press outside
   * step 2's open editor and closed it too, and the second `history.back()` left the app.
   * `focusin` for the same reason: focus landing on Next is not focus leaving the note.
   */
  useEffect(() => {
    const swallow = (event: Event) => event.stopPropagation();
    const types = ['pointerdown', 'mousedown', 'touchstart', 'focusin'];
    for (const type of types) popoverHost.addEventListener(type, swallow);
    return () => {
      for (const type of types) popoverHost.removeEventListener(type, swallow);
    };
  }, [popoverHost]);

  const queueWrite = useCallback((work: () => Promise<unknown>) => {
    writesRef.current = writesRef.current.then(work).catch(console.error);
  }, []);

  const setProps = useCallback(
    async (next: TourProp[]) => {
      propsRef.current = next;
      await writeProps(store, next);
    },
    [store]
  );

  const rebase = useCallback(
    async (id: string) => {
      await setProps(await rebaseProp(store, propsRef.current, id));
    },
    [store, setProps]
  );

  /**
   * Purges a list of Props and forgets it. It ends one run and starts the next: an abandoned run
   * and a finished one leave the same list behind.
   */
  const sweep = useCallback(
    async (props: TourProp[]) => {
      if (props.length === 0) return;
      const purged = await purgeProps(store, purgeNote, props);
      await setProps([]);
      // The Feed repaints through a live query, so cards outlive their rows by a frame or two, and
      // the scrim has to outlive the repaint or the user watches the Props leave.
      await waitFor(
        () =>
          !purged.some(
            (id) => document.querySelector(tourTargetSelector(noteCardTarget(id))) !== null
          ),
        { label: 'the feed to drop the purged Props' }
      );
    },
    [store, purgeNote, setProps]
  );

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
      props: propsRef.current,
      openNote: (id) => {
        openedPropRef.current = id;
        markNavigation();
        void navigate({
          to: '/',
          search: (prev) => ({ ...prev, note: id }),
          resetScroll: false,
        });
      },
      closeNote: () => {
        const id = openedPropRef.current;
        openedPropRef.current = null;
        markNavigation();
        router.history.back();
        // The editor flushes the note back to Dexie on its way out, so the
        // baseline has to be re-taken after it has gone - otherwise the sweep
        // reads the Tour's own write as the user's and leaves the Prop behind.
        if (id) {
          queueWrite(async () => {
            await waitFor(() => resolveTourTarget('editorToolbar') === null, {
              label: 'the editor to close before rebasing',
            });
            await rebase(id);
          });
        }
      },
      pinProp: async (id) => {
        await pinNote(id);
        await rebase(id);
      },
      unpinProp: async (id) => {
        await unpinNote(id);
        await rebase(id);
      },
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
    [navigate, router, markNavigation, pinNote, unpinNote, rebase, queueWrite]
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
      const target = TOUR_STEPS[at].target(makeStage());
      // The act that produces the target has already run, but the app may still
      // be painting it. A step that never gets one is shown centred with no
      // spotlight rather than dropped - the copy is still worth reading.
      const element = target
        ? await waitFor(() => resolveTourTarget(target), { label: tourTargetSelector(target) })
        : null;
      driverRef.current?.setConfig(driverConfig(element));
      driverRef.current?.highlight({
        element: element ?? undefined,
        // Driver's own popover content is empty and hidden; ours is the child
        // appended by `onPopoverRender`.
        popover: { description: '', showButtons: [] },
      });
    },
    [makeStage, driverConfig, popoverHost]
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
        // A Tour is not over until its Props are gone (CONTEXT.md), so they go before the app is
        // handed back. Safe with step 2's editor open: `updateNote` returns null for a gone row,
        // so the dialog's closing flush cannot write the Prop back.
        await writesRef.current;
        await sweep(propsRef.current);

        // Not when the *user* navigated away: the Tour does not move them back. The sweep already
        // undid step 3's pin, so `leaveScene` only retraces the navigations.
        if (unwind) await leaveScene(from, makeStage());
      } finally {
        // In a `finally` because the sweep now runs first: a purge that threw
        // would otherwise leave the user under an inert overlay with no way
        // out, which is a worse failure than the one it is reporting.
        driverRef.current?.destroy();
        driverRef.current = null;
        releaseInertRef.current?.();
        releaseInertRef.current = null;
      }
    },
    [makeStage, sweep, setRunning]
  );

  const start = useCallback(async () => {
    if (indexRef.current !== null) return;

    // Only a replay starts off the Feed; the automatic run never moves someone who chose Settings.
    // Guarded: navigating to the current route changes no location, so the marker would miscount.
    if (router.state.location.pathname !== '/') {
      markNavigation();
      await navigate({ to: '/' });
    }

    // The Feed must be on screen before seeding. This also keeps the Tour out of anywhere that
    // never paints one, so this wait's timeout is a normal answer, not a bug.
    if (!(await waitFor(() => resolveTourTarget('capture'), { label: 'a Feed to start on' })))
      return;

    // Warms the lazy editor chunk while step 1 is read, so step 2 does not wait for it.
    // Un-awaited: a failed preload is no reason to skip the Tour, and `lazy()` reuses this import.
    void import('@/components/notes/NoteEditorDialog.tsx');

    // Driver measures the popover once, and the self-hosted fonts load async: measured in the
    // fallback face, step 1's box hung off the top of the window.
    await document.fonts?.ready;

    // Stamped when offered, not on completion, or it re-arms after every reload (ADR 0015). Before
    // seeding, because that window is when a Tour is most often abandoned, and a reload in it
    // would seed three more Props on top of the three left behind.
    if (!preferences.onboardingSeenAt) {
      await setPreference('onboardingSeenAt', new Date().toISOString());
    }

    await sweep(propsRef.current);
    propsRef.current = await createProps(store, (key) => t(key));

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
    sweep,
    store,
    t,
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

  // Startup: sweep what the last run abandoned, then offer the Tour if it never was. Both live
  // here, not in `__root.tsx`: they share one list, and apart they race a seed against a purge.
  useEffect(() => {
    if (startedRef.current) return;
    let cancelled = false;
    // `startedRef` is set once the read lands, not before, or StrictMode's double mount cancels
    // the first run while the guard blocks the second (src/context/CLAUDE.md).
    void readProps(store)
      .then(async (props) => {
        if (cancelled) return;
        startedRef.current = true;
        propsRef.current = props;
        await sweep(props);
        if (!preferences.onboardingSeenAt && router.state.location.pathname === '/') await start();
        // Like `queueWrite`: a failed read or seed is logged, not left unhandled, and the app
        // goes on without a Tour.
      })
      .catch(console.error);
    return () => {
      cancelled = true;
    };
  }, [store, preferences.onboardingSeenAt, sweep, start, router]);

  // A navigation the Tour did not ask for destroys it, Props and all: the app is
  // inert, so the only way one happens is the platform back button or gesture,
  // and that is the user leaving rather than something to be corrected.
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
