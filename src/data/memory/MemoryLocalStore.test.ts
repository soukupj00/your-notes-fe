import { describeLocalStoreContract } from '../localStore.contract.ts';
import { createMemoryLocalStore } from './MemoryLocalStore.ts';

describeLocalStoreContract(async () => createMemoryLocalStore());
