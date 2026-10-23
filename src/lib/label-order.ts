import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import type { Tag } from '@/models';
import { moveById } from './move-by-id.ts';

// The one order of labels (ADR 0027): A to Z until the user drags or arranges them.

export type ArrangeKind = 'az' | 'za' | 'newest' | 'oldest';

export function labelCollator(language: string): Intl.Collator {
  return new Intl.Collator(language, { sensitivity: 'base', numeric: true });
}

// Keys are fractional indexes, built to compare by code unit; a locale would reorder them.
const byCodeUnit = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const keyOf = (tag: Tag) => (typeof tag.position === 'string' ? tag.position : undefined);

export function isCustomOrder(tags: readonly Tag[]): boolean {
  return tags.some((tag) => keyOf(tag) !== undefined);
}

const byName = (collator: Intl.Collator) => (a: Tag, b: Tag) =>
  collator.compare(a.name, b.name) || byCodeUnit(a.id, b.id);

export function compareLabels(collator: Intl.Collator): (a: Tag, b: Tag) => number {
  const names = byName(collator);
  return (a, b) => {
    const keyA = keyOf(a);
    const keyB = keyOf(b);
    if (keyA !== undefined && keyB !== undefined) {
      return byCodeUnit(keyA, keyB) || byCodeUnit(a.id, b.id);
    }
    if (keyA !== undefined) return -1;
    if (keyB !== undefined) return 1;
    return names(a, b);
  };
}

export function sortLabels(tags: readonly Tag[], collator: Intl.Collator): Tag[] {
  return [...tags].sort(compareLabels(collator));
}

export function positionsInOrder(ordered: readonly Tag[]): Map<string, string> {
  const keys = generateNKeysBetween(null, null, ordered.length);
  return new Map(ordered.map((tag, index) => [tag.id, keys[index]]));
}

/**
 * The positions a drop writes: the moved label alone in a custom order, every label on the first
 * drag. A gap with no key inside it (two devices minted the same key) re-keys the whole list.
 */
export function positionForMove(
  ordered: readonly Tag[],
  activeId: string,
  overId: string
): Map<string, string> {
  const before = [...ordered];
  const next = moveById(before, activeId, overId);
  if (next === before) return new Map();
  if (!isCustomOrder(ordered)) return positionsInOrder(next);

  const index = next.findIndex((tag) => tag.id === activeId);
  const lower = index > 0 ? keyOf(next[index - 1]) : null;
  // Unpositioned labels sort after every key, so one below the moved label bounds nothing.
  const upper = index < next.length - 1 ? (keyOf(next[index + 1]) ?? null) : null;
  if (lower === undefined) return positionsInOrder(next);
  try {
    return new Map([[activeId, generateKeyBetween(lower, upper)]]);
  } catch {
    return positionsInOrder(next);
  }
}

/** Where a new label goes in a custom order: before the first name after it, so A to Z stays A to Z. */
export function positionForNew(
  name: string,
  ordered: readonly Tag[],
  collator: Intl.Collator
): string | undefined {
  if (!isCustomOrder(ordered)) return undefined;

  const positioned = ordered.filter((tag) => keyOf(tag) !== undefined);
  const index = positioned.findIndex((tag) => collator.compare(tag.name, name) > 0);
  const lower =
    index === 0 ? null : keyOf(positioned[index === -1 ? positioned.length - 1 : index - 1]);
  const upper = index === -1 ? null : keyOf(positioned[index]);
  try {
    return generateKeyBetween(lower ?? null, upper ?? null);
  } catch {
    // A shared key leaves no gap; the label then shows A to Z after the positioned ones.
    return undefined;
  }
}

export function arrangedOrder(
  tags: readonly Tag[],
  kind: ArrangeKind,
  collator: Intl.Collator
): Tag[] {
  const names = byName(collator);
  const compare = {
    az: names,
    za: (a: Tag, b: Tag) => names(b, a),
    oldest: (a: Tag, b: Tag) => byCodeUnit(a.createdAt, b.createdAt) || names(a, b),
    newest: (a: Tag, b: Tag) => byCodeUnit(b.createdAt, a.createdAt) || names(a, b),
  }[kind];
  return [...tags].sort(compare);
}
