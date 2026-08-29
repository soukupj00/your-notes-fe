import { useRouterState } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { resolveTopbar, type TopbarConfig } from '@/components/nav/topbar.ts';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { emptyLive } from '@/data/live.ts';
import { useLive } from '@/data/useLive.ts';

export type ResolvedTopbar = Omit<TopbarConfig, 'title'> & {
  /** Already a display string; `null` means the bar shows no title. */
  title: string | null;
};

/**
 * `resolveTopbar` plus the one title it cannot resolve on its own.
 *
 * The tag lookup is a second subscription to a row the tag route is already
 * watching. That duplication is deliberate: the alternative is threading the
 * name up from the view into the bar above it, which is the parent-write this
 * whole approach exists to avoid, and the cost is one indexed `get`.
 */
export function useTopbar(): ResolvedTopbar {
  const { t } = useTranslation();
  const store = useLocalStore();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const config = resolveTopbar(pathname);

  const tagId = config.title?.kind === 'tag' ? config.title.id : undefined;
  const tag = useLive(
    () => (tagId ? store.tags.watch(tagId) : emptyLive(undefined)),
    [store, tagId]
  );

  let title: string | null = null;
  if (config.title?.kind === 'key') {
    title = t(config.title.key);
  } else if (config.title?.kind === 'tag') {
    // The lookup resolves a frame late, and can fail outright if the tag was
    // deleted in another tab. Same fallback the route's own heading uses, so the
    // bar and the heading never disagree.
    title = tag?.name ?? t('nav.labels');
  }

  return { kind: config.kind, title };
}
