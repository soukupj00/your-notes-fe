import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  requestPersistentStorage,
  resetPersistentStorageRequest,
} from '@/lib/persistentStorage.ts';

function stubStorage(storage: unknown) {
  Object.defineProperty(navigator, 'storage', {
    value: storage,
    configurable: true,
  });
}

describe('requestPersistentStorage', () => {
  beforeEach(() => resetPersistentStorageRequest());
  afterEach(() => stubStorage(undefined));

  it('asks the browser once, however many times it is called', async () => {
    const persist = vi.fn().mockResolvedValue(true);
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(false) });

    await requestPersistentStorage();
    await requestPersistentStorage();

    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('does not spend a prompt when the grant is already held', async () => {
    const persist = vi.fn();
    stubStorage({ persist, persisted: vi.fn().mockResolvedValue(true) });

    await requestPersistentStorage();

    expect(persist).not.toHaveBeenCalled();
  });

  it('is a no-op where the API does not exist', async () => {
    stubStorage(undefined);

    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });

  it('swallows a rejection - a refusal is not something the caller can act on', async () => {
    stubStorage({
      persist: vi.fn().mockRejectedValue(new Error('denied')),
      persisted: vi.fn().mockResolvedValue(false),
    });

    await expect(requestPersistentStorage()).resolves.toBeUndefined();
  });
});
