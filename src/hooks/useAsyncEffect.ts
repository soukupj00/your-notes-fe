import { type DependencyList, useEffect } from 'react';

type AsyncEffect = (alive: () => boolean) => void | Promise<void>;

function start(effect: AsyncEffect): () => void {
  let live = true;
  void effect(() => live);
  return () => {
    live = false;
  };
}

/**
 * An effect that awaits. `alive()` is true until the deps change or the component unmounts, so a
 * late answer never writes into a newer render. What a failure means stays the caller's.
 * Set state only after an await: the effect lint rules cannot see into this closure.
 */
export function useAsyncEffect(effect: AsyncEffect, deps: DependencyList): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: deps are the caller's, by contract
  useEffect(() => start(effect), deps);
}
