import { seedDummyData } from './seed.ts';

/** Seed the real browser IndexedDB from inside the running app. */
export async function seedBrowserData() {
  const { notes, tags, noteTags } = await seedDummyData();
  console.log(`✅ Browser: Inserted ${notes} notes, ${tags} tags, ${noteTags} relationships`);
}
