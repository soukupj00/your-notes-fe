import {
  QUICK_CAPTURE_ACTIONS,
  type QuickCaptureAction,
} from '@/components/notes/quickCaptureActions.ts';
import { reconcileOrder } from '@/lib/reconcile-order.ts';

/** Stored visibility of one start. Array position is its order in the dial. */
export interface QuickCapturePref {
  id: string;
  on: boolean;
}

const ACTION_IDS = QUICK_CAPTURE_ACTIONS.map((action) => action.key);

/**
 * Deliberately not the toolbar's model (no families, no Width Classes): a handful of buttons on
 * one dial have nothing to group and nothing to overflow.
 */
export function reconcileQuickCapture(stored: QuickCapturePref[] | undefined): QuickCapturePref[] {
  const defaults = QUICK_CAPTURE_ACTIONS.map((action) => ({ id: action.key, on: true }));
  // Empty means never customised, which is every start on, in shipped order -
  // not a dial reconstructed one entry at a time.
  return reconcileOrder(stored?.length ? stored : defaults, ACTION_IDS, (id) => ({ id, on: true }));
}

/**
 * An id the build no longer ships stays in storage but is dropped here, so an arrangement
 * survives an action being renamed away.
 */
export function resolveQuickCapture(stored: QuickCapturePref[] | undefined): QuickCaptureAction[] {
  return reconcileQuickCapture(stored)
    .filter((entry) => entry.on)
    .map((entry) => QUICK_CAPTURE_ACTIONS.find((action) => action.key === entry.id))
    .filter((action): action is QuickCaptureAction => action !== undefined);
}

/**
 * Minus plain text, which the desktop bar's own field is. Derived rather than stored twice:
 * nobody asked for a desktop dial that differs from their phone's.
 */
export function resolveDesktopQuickCapture(
  stored: QuickCapturePref[] | undefined
): QuickCaptureAction[] {
  return resolveQuickCapture(stored).filter((action) => action.key !== 'text');
}
