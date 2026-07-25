import 'fake-indexeddb/auto';
import { seedDummyData } from './seed.ts';

// `pnpm seed` entry point. Runs against fake-indexeddb (in-memory), not your
// browser - use seedBrowserData() from the running app for that.
seedDummyData()
  .then(({ notes, tags, noteTags }) =>
    console.log(`✅ Inserted ${notes} notes, ${tags} tags, ${noteTags} relationships`)
  )
  .catch(console.error);
