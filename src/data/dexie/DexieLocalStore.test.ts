import { describeLocalStoreContract } from '../localStore.contract.ts';
import { createDexieLocalStore } from './DexieLocalStore.ts';
import { NotesDB } from './db.ts';

// A fresh, uniquely named database per test: `fake-indexeddb/auto` is loaded
// by src/test/setup.ts, and a shared name would leak rows between tests.
describeLocalStoreContract(async () =>
  createDexieLocalStore(new NotesDB(`contract-${crypto.randomUUID()}`))
);
