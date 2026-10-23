import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocalStore } from '@/data/LocalStoreProvider.tsx';
import { useLive } from '@/data/useLive.ts';
import { labelCollator, sortLabels } from '@/lib/label-order.ts';
import type { Tag } from '@/models.ts';

/** Every Tag in label order (ADR 0027), so every list of labels agrees. */
export function useTags(): Tag[] {
  const store = useLocalStore();
  const { i18n } = useTranslation();
  const tags = useLive(() => store.tags.all(), [store]);
  return useMemo(() => sortLabels(tags ?? [], labelCollator(i18n.language)), [tags, i18n.language]);
}
