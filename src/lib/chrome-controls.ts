/**
 * The one icon-button recipe for the app's chrome - the topbar's language,
 * theme and settings buttons.
 *
 * It lives here, beside `note-controls.ts`, for the same reason that one does:
 * the buttons sit on the `bg-chrome` band rather than on the page background, so
 * their focus ring has to offset against *that* surface or it disappears into
 * the band. Written out at each button, one of them would eventually be added
 * without it.
 */
export const CHROME_ICON_BUTTON =
  'touch-target rounded-control focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-chrome';
