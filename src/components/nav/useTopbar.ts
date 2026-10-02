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
 * The tag title is a deliberate second subscription to a row the tag route already watches:
 * threading the name up from the view is the parent-write `resolveTopbar` exists to avoid.
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
    // Late by a frame, or missing if the tag was deleted elsewhere. Same fallback as the
    // route's heading, so the two never disagree.
    title = tag?.name ?? t('nav.labels');
  }

  return { kind: config.kind, title };
}
