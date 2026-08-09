/**
 * Props - the three Notes the Tour creates so it has something to demonstrate
 * on, and Purges when it ends (CONTEXT.md "Prop"/"Purge", ADR 0015).
 *
 * Nothing here imports `driver.js` or React. The Tour's safety rules are all in
 * this file and they are the part worth testing on their own: a bug here does
 * not make the spotlight land badly, it deletes something the user wrote.
 *
 * The rules, in the order they matter:
 *
 * 1. It **purges**, it does not trash. A Prop that went to Trash would leave
 *    the user three mystery notes to discover and clear.
 * 2. **An edited Prop is not a Prop.** The sweep purges only Props whose
 *    `updatedAt` still matches the baseline the Tour itself last recorded. The
 *    baseline is *not* the seed value: the Tour's own acts write, so every act
 *    that touches a Prop calls `rebaseProp` and nothing else is exempt.
 * 3. **Orphans are swept on the next start.** A reload at step 2 ends the Tour
 *    with no teardown, so the baselines live in the preferences blob and the
 *    next start runs the same purge over whatever the last run left behind.
 *
 * The functions take their writers (`createNote`, `purgeNote`) as arguments
 * rather than reaching for `useNoteActions` themselves, and they return the new
 * baselines rather than persisting them. That keeps the whole module callable
 * from a plain test with no React and no preferences plumbing; `TourProvider`
 * owns both halves.
 */

import type { TourProp } from '@/context/PreferencesProvider.tsx';
import { db } from '@/db/db.ts';
import type { NoteColor } from '@/lib/note-colors.ts';
import type { Note } from '@/models.ts';

/** The slice of i18next's `t` the Prop copy needs. */
type Translate = (key: string) => string;

type CreateNote = (data: Partial<Note>) => Promise<Note>;
type PurgeNote = (id: string) => Promise<unknown>;

// --- Body markup ------------------------------------------------------------
//
// Bodies are TipTap HTML, written out rather than produced by an editor
// instance: a Prop is fixed content, and mounting ProseMirror to serialise three
// constant strings would be absurd. What that costs is the guarantee that the
// markup is what TipTap would have emitted, so `props.test.ts` round-trips every
// body through a headless editor and asserts it comes back unchanged.
//
// A checklist item carries the state twice - `data-checked` and the input's
// `checked` - for the same reason `lib/checklist.ts` writes both: TipTap parses
// the first and the card paints the second, and writing only one makes the two
// surfaces disagree.

function taskItem(label: string, checked: boolean): string {
  const box = checked ? '<input type="checkbox" checked="checked">' : '<input type="checkbox">';
  return (
    // `data-checked` leads because that is the order TipTap's own serialiser
    // emits, and the round-trip test compares strings.
    `<li data-checked="${checked}" data-type="taskItem">` +
    `<label>${box}<span></span></label><div><p>${label}</p></div></li>`
  );
}

function checklist(items: [label: string, checked: boolean][]): string {
  return `<ul data-type="taskList">${items.map(([l, c]) => taskItem(l, c)).join('')}</ul>`;
}

function bulletList(labels: string[]): string {
  return `<ul>${labels.map((l) => `<li><p>${l}</p></li>`).join('')}</ul>`;
}

function paragraph(text: string): string {
  return `<p>${text}</p>`;
}

// --- The three Props --------------------------------------------------------

/**
 * Deliberately mundane content: Props are stage dressing, and they are gone in
 * five clicks. What is not arbitrary is the *shape* of each one.
 *
 * The colours are three distinct palette identities (Cool, Base, Deep in
 * DESIGN.md's terms), so the colour system reads at a glance without a step
 * spending words on it. `weekend` is the tallest card on purpose - a wall of
 * equal cards reads as a grid, and the masonry pack is one of the things step 3
 * is showing. `ideas` is the one step 2 opens and step 3 pins.
 */
const PROP_SPECS: { key: string; color?: NoteColor; body: (t: Translate) => string }[] = [
  {
    key: 'groceries',
    color: 'green',
    body: (t) =>
      checklist([
        [t('onboarding.props.groceries.item1'), true],
        [t('onboarding.props.groceries.item2'), false],
        [t('onboarding.props.groceries.item3'), false],
      ]),
  },
  {
    key: 'weekend',
    body: (t) =>
      paragraph(t('onboarding.props.weekend.intro')) +
      bulletList([
        t('onboarding.props.weekend.item1'),
        t('onboarding.props.weekend.item2'),
        t('onboarding.props.weekend.item3'),
      ]),
  },
  {
    key: 'ideas',
    color: 'purple',
    body: (t) => paragraph(t('onboarding.props.ideas.body')),
  },
];

// --- Lifecycle --------------------------------------------------------------

/**
 * Seeds the three Props and returns the baselines to store in `tourProps`.
 *
 * Created one at a time rather than in parallel so the wall's default
 * `updated desc` order is the reverse of the table above and is the same on
 * every run - a Tour that deals its own cards differently each time is a Tour
 * whose steps cannot describe what the user is looking at.
 */
export async function createProps(createNote: CreateNote, t: Translate): Promise<TourProp[]> {
  const props: TourProp[] = [];
  for (const spec of PROP_SPECS) {
    const note = await createNote({
      header: t(`onboarding.props.${spec.key}.header`),
      body: spec.body(t),
      color: spec.color,
    });
    props.push({ id: note.id, updatedAt: note.updatedAt });
  }
  return props;
}

/**
 * Re-reads one Prop's `updatedAt` into the baseline. **Every act that writes to
 * a Prop calls this** - pinning it, colouring it, or leaving its editor - or the
 * sweep will read the Tour's own writing as the user's and refuse to clean up.
 *
 * A Prop that is no longer there keeps its entry: `purgeProps` already tolerates
 * a missing row, and dropping it here would mean two places that decide what
 * "gone" means.
 */
export async function rebaseProp(props: TourProp[], id: string): Promise<TourProp[]> {
  const note = await db.notes.get(id);
  if (!note) return props;
  return props.map((prop) => (prop.id === id ? { id, updatedAt: note.updatedAt } : prop));
}

/**
 * Purges every Prop still matching its baseline and returns the ids it removed.
 *
 * This is both halves of the sweep: the teardown at the end of a Tour, and the
 * abandoned-run sweep at the start of the next one. They are the same question
 * asked of the same list, so they are the same call - the only difference is
 * which run left the list behind.
 *
 * Two Props are skipped, and both are correct. One the user **edited** is theirs
 * now, so it stays on their wall. One the user **deleted** is already gone (or
 * sitting in Trash with a bumped `updatedAt`, which is the edited case), so
 * there is nothing to do.
 *
 * The caller clears `tourProps` afterwards **regardless** of what came back: a
 * kept Prop is an ordinary Note, and a baseline for a note the Tour will never
 * touch again is just a stale row waiting to purge something on a later run.
 */
export async function purgeProps(purgeNote: PurgeNote, props: TourProp[]): Promise<string[]> {
  const purged: string[] = [];
  for (const prop of props) {
    const note = await db.notes.get(prop.id);
    if (!note || note.updatedAt !== prop.updatedAt) continue;
    await purgeNote(prop.id);
    purged.push(prop.id);
  }
  return purged;
}
