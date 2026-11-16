import type { LocalStore } from '@/data/LocalStore.ts';

// Reads for assertions, built on what the app itself asks the store for,
// so `LocalStore` carries no method only tests would call.

export const allNotes = async (store: LocalStore) => (await store.exportAll()).notes;

export const allAttachments = async (store: LocalStore) => (await store.exportAll()).attachments;

export const tagById = async (store: LocalStore, id: string) =>
  (await store.tags.list()).find((tag) => tag.id === id);
