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
 * The Tour's lifecycle: when it runs, what it does to the app between steps, and
 * what it takes back afterwards (ADR 0015).
 *
 * Everything the Tour *decides* lives in `src/lib/tour/` with no React and no
 * spotlight library in sight. This file is the part that cannot: it owns the
 * `driver.js` instance, the router, the Props' persistence, and the `inert`
 * marking that makes a demonstration safe to leave running.
 *
 * ## Steps are scenes, not layers
 *
 * The app's state between steps is not additive - step 2's editor covers the
 * wall step 3 points at - so moving between steps is "leave this scene, enter
 * that one": `exit` the step being left, `enter` the one arriving. That is what
 * makes `exit` a strict inverse rather than a second forward move, which is the
 * contract `steps.test.ts` pins. The last three steps are one scene (Settings)
 * looked at three times and say so with `continues`; stepping between them does
 * neither.
 *
 * ## Everything else is inert
 *
 * For the Tour's whole lifetime every direct child of `document.body` except
 * driver's own elements carries `inert`. Not just the app root: Radix portals to
 * `body`, so the editor dialog would otherwise escape it. One attribute does
 * three jobs - Tab cycles inside the popover with no focus-trap library, the
 * dimmed app is unreachable by keyboard as well as by pointer, and step 2 cannot
 * raise the software keyboard on a phone (the editor autofocuses, and
 * `index.html` carries `interactive-widget=resizes-content`, so without this the
 * viewport would halve at step 2 and the popover would have nowhere to sit).
 *
 * Verified in Chromium before this was built on: Radix's own open-focus attempt
 * fails silently under `inert` - no warning, no retry loop - and a programmatic
 * `.click()` still runs its React handler inside an inert subtree, which is how
 * step 1 opens the speed dial. `inert` disables hit testing, not dispatch.
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
 * Driver's own elements, which are the only ones left interactive.
 *
 * The exemption has to name driver specifically rather than mean "anything that
 * arrived after we started": the speed dial's Radix popover portals to `body`
 * too and is marked as it opens, which is correct - the Tour is a
 * demonstration, and nothing in it is meant to be pressed.
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

  // The popover's React lives in a node of our own, appended into driver's
  // popover as it renders. Rendering ahead of driver rather than into it is what
  // lets driver measure the real content: it positions the box immediately after
  // `onPopoverRender` returns, and a React tree committed at that moment would
  // still be empty.
  const [popoverHost] = useState(() => {
    const host = document.createElement('div');
    // The one thing a modal Radix dialog will not hide.
    //
    // Opening step 2's editor runs `hideOthers`, which marks every other child
    // of `body` `aria-hidden` - and that library keeps `[aria-live]` elements
    // and their ancestors deliberately, so this attribute is its supported way
    // of saying "not this one". Without it the popover's buttons left the
    // accessibility tree the moment the editor opened: still visible, still
    // clickable, and unreachable by name to anything reading the page.
    //
    // `off` rather than `polite`: the announcement is `TourPopover`'s step
    // region, and a second live region wrapping the buttons as well would read
    // "Next" out again every time the label changed.
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
   * The Tour's own presses stop at the popover and never reach the document.
   *
   * Radix's dismissable layers listen there for a pointer "outside" themselves,
   * and the popover is outside every one of them: pressing Next while step 2's
   * editor is open made Radix close that dialog *as well as* the Tour, so the
   * step's own `history.back()` and Radix's landed as two pops and the second
   * one left the app. Nothing on this surface is an interaction with the app
   * underneath - the app is inert - so saying so at the boundary is both the fix
   * and the true statement. `focusin` for the same reason: a focus ring landing
   * on Next is not focus leaving the note.
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
   * Purges a list of Props and forgets it.
   *
   * The same call is the end of a run and the start of the next one: an
   * abandoned run and a finished one leave the same list behind, and the only
   * difference is which run left it.
   */
  const sweep = useCallback(
    async (props: TourProp[]) => {
      if (props.length === 0) return;
      const purged = await purgeProps(store, purgeNote, props);
      await setProps([]);
      // Gone from Dexie is not gone from the wall: the Feed repaints through a
      // live query, so the cards outlive the rows by a frame or two. Since the
      // whole point of sweeping before the app is handed back is that nobody
      // watches the Props leave, the scrim has to outlive the repaint as well.
      // On the steps that end in Settings there is no Feed mounted and this is
      // true on its first look, costing nothing.
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
   * Every navigation the Tour makes opts out of the router's scroll reset, and
   * it is load-bearing rather than tidy.
   *
   * TanStack Router scrolls to the top on navigate (`resetScroll ?? true`), and
   * that lands *after* the spotlight has asked for its target. Traced on a
   * Pixel 7: driver called `scrollIntoView({behavior:'smooth', block:'start'})`
   * at 2637ms and the router called `scrollTo({top:0})` at 2648ms, so the step
   * that navigates to Settings spotlit a block 930px below the fold while its
   * popover sat at the bottom of the screen pointing at nothing. Instant scroll
   * would have lost the same race; the router's call simply comes second.
   *
   * `openNote` needs it for the same reason even though its scroll is behind a
   * dialog: it returns to the Feed, and the step after it points at a card there
   * that a reset to the top can put off-screen.
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
      // The scrim, as a token rather than a colour. Driver writes this straight
      // into the overlay path's inline `style.fill`, where a `var()` resolves
      // against `:root` like anywhere else - so the day and night scrims switch
      // with the theme and no stylesheet has to out-specify an inline style.
      // The alpha is in the token too, hence opacity 1: driver's own would
      // multiply it by a third number.
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
   * Cuts the spotlight over whatever the step is pointing at, if anything.
   *
   * The wait on `data-tour-step` is not a formality. Driver measures the popover
   * exactly once, to choose which side of the target it goes on, and never looks
   * again - so it has to be handed a box that already holds *this* step's copy.
   * Measured a beat early it measured an empty one, decided the popover was 0px
   * tall, and put the first step half off the top of the window and over the
   * very control it was pointing at.
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
        // A Tour is not over until its Props are gone (CONTEXT.md): clearing
        // the stage is the Tour's last act, not the app's first one. Swept
        // *before* the app is handed back, so the three notes the user did not
        // write are never seen leaving - from the Settings steps the Feed is not
        // even mounted, and from the rest the app is still dimmed and inert.
        //
        // Purging with step 2's editor still open is safe rather than merely
        // survivable: `updateNote` reads the row first and returns null when it
        // has gone, so the dialog's closing flush cannot write the Prop back.
        await writesRef.current;
        await sweep(propsRef.current);

        // Not when the *user* navigated away: they have moved on, and the Tour
        // does not get to move them back. The sweep above has already undone
        // step 3's pin, and left `props` empty, so `leaveScene` finds nothing
        // to unpin and simply retraces the navigations.
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

    // Replay is reached from Settings, and the first three steps are about the
    // Feed. Guarded rather than unconditional: navigating to where we already
    // are produces no location change, which would leave the marker below
    // counting a navigation that never arrives.
    //
    // Only a *replay* ever gets this far off the Feed. The automatic run below
    // does not move anybody: someone who opened the app straight into Settings
    // asked to be there, and the Tour is offered the next time they are on the
    // wall it is about.
    if (router.state.location.pathname !== '/') {
      markNavigation();
      await navigate({ to: '/' });
    }

    // The Feed has to be on screen before anything is seeded. This doubles as
    // the gate that keeps the Tour out of anywhere that never paints one - the
    // one wait here whose timeout is a normal answer rather than a bug, hence
    // the label saying so.
    if (!(await waitFor(() => resolveTourTarget('capture'), { label: 'a Feed to start on' })))
      return;

    // Step 2 opens a note, and the editor is a lazy chunk: warmed here, its
    // module cost is paid while step 1 is being read rather than in the middle
    // of the step that needs it. Un-awaited on purpose - a failure to preload is
    // not a reason not to run the Tour, and `NotesView`'s own `lazy()` will ask
    // for the same module and get this one.
    void import('@/components/notes/NoteEditorDialog.tsx');

    // Driver measures the popover once, to decide which side of the target it
    // goes on, and never re-measures. The app's two typefaces are self-hosted
    // and load async, so a popover measured mid-swap is measured in the fallback
    // face - and the first step's box, laid out for a height it then exceeded,
    // hung off the top of the window and over the very thing it was pointing at.
    await document.fonts?.ready;

    // Stamped before a single Prop exists, not on completion: the fact worth
    // recording is that the Tour was *offered*, or it re-arms after every reload
    // (ADR 0015). Before rather than after the seeding, because the window
    // between the two is exactly when a Tour is most likely to be abandoned -
    // three notes appearing is the first thing that happens - and a reload
    // landing in it would seed three more on top of the three left behind.
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

  // Startup: sweep whatever the last run abandoned, then offer the Tour if it
  // has never been offered. Both belong here rather than beside the other
  // startup sweeps in `__root.tsx`, because they are the same list and running
  // them apart would race a fresh seed against the old list's purge.
  useEffect(() => {
    if (startedRef.current) return;
    let cancelled = false;
    // `startedRef` is set once the read actually lands, not before: preferences
    // are now read synchronously, so this effect's first run happens on the
    // initial mount - which StrictMode double-invokes in dev. Marking the ref
    // up front would have the *first* invocation's async continuation swallowed
    // by its own cleanup (`cancelled`) while the guard stops the second, real
    // invocation from ever running it.
    void readProps(store).then(async (props) => {
      if (cancelled) return;
      startedRef.current = true;
      propsRef.current = props;
      await sweep(props);
      if (!preferences.onboardingSeenAt && router.state.location.pathname === '/') await start();
    });
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
 * Whether the Tour is running, for the handful of app-wide behaviours that have
 * to stand down while it is.
 *
 * Tolerates the provider's absence, unlike `useTour`: its callers are ordinary
 * components that are rendered on their own in tests, and "no provider" and "no
 * Tour" mean the same thing to them.
 */
export function useTourActive(): boolean {
  return useContext(TourContext)?.active ?? false;
}
