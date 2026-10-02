/**
 * The Notes the Tour seeds and Purges (CONTEXT.md "Prop", ADR 0015). A bug here deletes what the
 * user wrote: the sweep purges only a Prop whose `updatedAt` matches the Tour's last baseline, so
 * every act that writes to a Prop rebases it. A Prop is purged, never trashed.
 */

import type { LocalStore } from '@/data/LocalStore.ts';
import { taskListMarkup } from '@/lib/body.ts';
import type { NoteColor } from '@/lib/note-colors.ts';
import { newNote } from '@/lib/rows.ts';

/** The slice of i18next's `t` the Prop copy needs. */
type Translate = (key: string) => string;

type PurgeNote = (id: string) => Promise<unknown>;

/** One live Prop and the `updatedAt` baseline the sweep compares against. */
export type TourProp = { id: string; updatedAt: string };

/**
 * Store bookkeeping under `meta`, not a Preference (ADR 0020). Duplicated in
 * `src/data/dexie/legacyPreferences.ts`, which may not import from here: rename both together.
 */
export const TOUR_PROPS_META_KEY = 'tourProps';

export const readProps = async (store: LocalStore): Promise<TourProp[]> =>
  (await store.meta.get<TourProp[]>(TOUR_PROPS_META_KEY)) ?? [];

export const writeProps = (store: LocalStore, props: TourProp[]) =>
  store.meta.set(TOUR_PROPS_META_KEY, props);

// Bodies are hand-written TipTap HTML, so `props.test.ts` round-trips each through a headless
// editor to prove TipTap would emit the same.

function bulletList(labels: string[]): string {
  return `<ul>${labels.map((l) => `<li><p>${l}</p></li>`).join('')}</ul>`;
}

function paragraph(text: string): string {
  return `<p>${text}</p>`;
}

/** Steps name the Prop they mean, because `tourProps` is only an array of ids. */
export type PropKey = 'groceries' | 'weekend' | 'ideas';

/**
 * Mundane content, deliberate shapes: three distinct palette identities (Cool, Base, Deep in
 * DESIGN.md), `weekend` the tallest so the wall reads as masonry, not a grid.
 */
const PROP_SPECS: { key: PropKey; color?: NoteColor; body: (t: Translate) => string }[] = [
  {
    key: 'groceries',
    color: 'green',
    body: (t) =>
      taskListMarkup([
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

/**
 * Matched by position, which `createProps` writes in spec order and `props.test.ts` pins, rather
 * than storing each Prop's name for two call sites. `undefined` is normal after a restored run or
 * a mid-Tour delete, and the asking step then does not act.
 */
export function propByKey(props: TourProp[], key: PropKey): TourProp | undefined {
  return props[PROP_SPECS.findIndex((spec) => spec.key === key)];
}

/**
 * Written one at a time so the wall deals the same cards in the same order on every run. Baselines
 * go first, as there is no cross-store transaction (ADR 0020): a crash in between leaves baselines
 * for missing notes, which the sweep tolerates, rather than notes that would never be swept.
 */
export async function createProps(store: LocalStore, t: Translate): Promise<TourProp[]> {
  const notes = PROP_SPECS.map((spec) =>
    newNote({
      header: t(`onboarding.props.${spec.key}.header`),
      body: spec.body(t),
      color: spec.color,
    })
  );
  const props = notes.map(({ id, updatedAt }) => ({ id, updatedAt }));
  await writeProps(store, props);
  for (const note of notes) await store.notes.add(note);
  return props;
}

/**
 * Every act that writes to a Prop (pin, colour, leaving its editor) must call this, or the sweep
 * reads the Tour's own write as the user's edit and keeps the Prop. A missing Prop keeps its
 * entry, so `purgeProps` stays the one place that decides what "gone" means.
 */
export async function rebaseProp(
  store: LocalStore,
  props: TourProp[],
  id: string
): Promise<TourProp[]> {
  const note = await store.notes.get(id);
  if (!note) return props;
  return props.map((prop) => (prop.id === id ? { id, updatedAt: note.updatedAt } : prop));
}

/**
 * Both the end-of-Tour teardown and the next start's sweep of an abandoned run. Edited and deleted
 * Props are skipped. The caller clears `tourProps` afterwards regardless of the result, so a kept
 * Prop's stale baseline cannot purge it on a later run.
 */
export async function purgeProps(
  store: LocalStore,
  purgeNote: PurgeNote,
  props: TourProp[]
): Promise<string[]> {
  const purged: string[] = [];
  for (const prop of props) {
    const note = await store.notes.get(prop.id);
    if (!note || note.updatedAt !== prop.updatedAt) continue;
    await purgeNote(prop.id);
    purged.push(prop.id);
  }
  return purged;
}
