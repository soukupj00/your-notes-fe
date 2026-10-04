import { createNoteDraft, type NoteDraft } from '@/lib/draft.ts';

type Deps = Parameters<typeof createNoteDraft>[1];

const refuse = (dep: string) => async () => {
  throw new Error(`${dep}: this test's Draft was not expected to write`);
};

/** A real Draft for a component test; a write the test did not pass in fails loudly. */
export function testDraft(
  open: { id: string; isNew: boolean },
  deps: Partial<Deps> = {}
): NoteDraft {
  return createNoteDraft(open, {
    content: () => ({ header: '', body: '' }),
    createNote: refuse('createNote'),
    updateNote: refuse('updateNote'),
    purgeNote: refuse('purgeNote'),
    collectOrphans: refuse('collectOrphans'),
    ...deps,
  });
}
