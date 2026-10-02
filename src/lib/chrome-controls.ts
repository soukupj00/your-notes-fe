/**
 * One recipe for the topbar's icon buttons: they sit on the `bg-chrome` band, so the focus ring
 * must offset against that surface or vanish into it, and a hand-written copy would forget it.
 */
export const CHROME_ICON_BUTTON =
  'touch-target rounded-control focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-chrome';
