# 0021 - Reminders are handed off to the calendar; the app never notifies

- Status: Accepted (reverses the "note reminders/notifications" non-requirement in [07-requirements.md](https://github.com/soukupj00/your-notes-fe/blob/main/docs/architecture/07-requirements.md))
- Date: 2026-09-20

## Context

Reminders were an explicit non-requirement, and the most-missed Keep feature ([10-related-work.md](https://github.com/soukupj00/your-notes-fe/blob/main/docs/architecture/10-related-work.md)).
The obstacle was never the UI but delivery: a web app has exactly three ways to raise a notification at a chosen time, and none of them is available.
Web Push fires with the app closed, but needs a server (M5) and a third-party relay, which [ADR 0017](./0017-note-level-last-writer-wins-with-conflicted-copies.md) already rejected.
Notification Triggers (`showTrigger`) would have fired locally, but Chrome abandoned it and it never shipped.
A timer in the page or the service worker only runs while the app is open - the browser stops a worker seconds after the last tab closes - so a Reminder would fire only for a user who did not need reminding.

The requirement that decided it: a Reminder must fire on a phone or tablet **whether or not the app is running**.
Only something the operating system itself schedules can promise that, and the one such thing a web app can reach without a server is the user's calendar.

## Decision

**A Reminder is a passive record on the Note; the alarm belongs to the user's calendar, reached by a Hand-off.**

1. **The app never notifies.**
   No Notification permission, no service-worker changes, no timers, no overdue sweep, no acknowledged state.
   If both the calendar and the app fired, every Reminder would buzz twice whenever the app happened to be open, and in-app firing is what drags in all of the above.
2. **Two optional fields on the Note**, `remindAt` and `repeat` (`daily | weekly | monthly | yearly`), not a separate store.
   One Reminder per Note.
   On the Note it rides Backup, Trash, Purge and M5's note-level sync for free; neither field is indexed, so there is no Dexie version bump.
   Setting or clearing one bumps `updatedAt`, as pinning does.
3. **Setting is handing off.**
   The popover's one primary action saves the fields *and* hands the calendar an `.ics` in the same tap; there is no way to save a Reminder the calendar was never offered.
   The alternative - save and export as separate steps - leaves a chip on the Card that looks armed and fires nothing.
   Tracking "was it exported" was rejected: it costs a field and several states, and still cannot know whether the user completed the calendar app's own confirm screen.
4. **The Hand-off is one-way, and says so.**
   The event's `UID` is the Note's id and its `SEQUENCE` is the hand-off time in seconds, so handing off again *replaces* the event in clients that honour that (Apple does; Google's import is inconsistent).
   Clearing a Reminder cannot remove the calendar event; the popover tells the user to remove it there.
   No `METHOD:CANCEL` file is offered, because manual import of one is close to useless.
5. **The event carries the title and a link back, never the Body.**
   `SUMMARY` is the header (falling back to the first ~60 characters of plain text, then a fixed string); `URL` and `DESCRIPTION` are `<origin>/?note=<id>`, which opens the Note because the open Note lives in the URL ([ADR 0014](./0014-the-open-note-lives-in-the-url.md)).
   The calendar is usually a third party's cloud, and this app is a private silo.
6. **`remindAt` is a local wall-clock string (`YYYY-MM-DDTHH:mm`), not an ISO instant** - a deliberate exception to the "all timestamps are ISO strings" convention.
   A Reminder is a time on the clock, not a moment: stored as UTC, a daily 09:00 Reminder reads 08:00 after a daylight-saving change while the calendar still fires at 09:00.
   The value is exactly what `<input type="datetime-local">` emits and accepts, and it is written to the `.ics` as a floating time (no `Z`, no `VTIMEZONE`).
   Recurrence is one `RRULE:FREQ=` line; because the calendar does the firing, the app has no roll-forward arithmetic at all.
7. **Placement follows the editor bar's existing test** - "can this apply to a Note that has no Card yet?".
   A draft can carry a Reminder, so the bell sits in `NoteEditorBar` beside colour and pin and resolves a draft's id through `ensureNoteId` (since M6 slice 5, 2026-10-03, through the Draft's `ensureSaved()`).
   The Card shows a read-only chip and gains no control; there is no Reminders destination and no feed filter.
   The inputs are the native `datetime-local` and `select`, so a phone gets its own picker and no picker library is added.

## Consequences

- **How the file reaches the calendar is unverified on a device**, and is isolated for that reason behind one function, `handOff(file)`: share the file when `navigator.canShare({ files })` allows it, otherwise download it.
  Whether an installed standalone PWA on Android opens the calendar's add-event screen from either path can only be measured in the installed app; if neither does, the fix lives inside that function (a Google Calendar template link is the known third option).
- Google Calendar reportedly ignores `VALARM` on import and applies the user's default notification, so the app controls *when the event is*, not necessarily when the phone buzzes.
- A one-shot Reminder whose time has passed stays on the Card, struck through, **for a day**, and after that the Note reads as having no Reminder: no chip, the bell unlit, the popover empty (amended 2026-09-20; it first stayed until cleared, and a wall of struck chips is litter).
  This is a way of *showing* the Note and never a write, as Sinking is for a Checklist.
  The app clearing the fields itself was rejected: it would bump `updatedAt`, reorder a feed sorted by last edit, sync as an edit in M5, and need a sweep - the timer this design exists to avoid.
  The cost is two stale fields on the row until the next Reminder overwrites them; they travel in Backup and Sync and mean nothing.
  A repeating Reminder never lapses, because the calendar is still firing it.
- If M5 ever revisits push, the fields do not change; firing would be an added channel, not a new model.
