import { waitFor } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { newTag } from '@/lib/rows.ts';
import { clearStore, renderHookWithStore, testStore } from '@/test/store.tsx';
import { useTags } from './useTags.ts';

afterEach(clearStore);

it('useTags lists labels in label order', async () => {
  await testStore.tags.add(newTag('Beta'));
  await testStore.tags.add(newTag('Alpha'));
  await testStore.tags.add({ ...newTag('Zulu'), position: 'a0' });

  const { result } = renderHookWithStore(() => useTags());

  await waitFor(() =>
    expect(result.current.map((tag) => tag.name)).toEqual(['Zulu', 'Alpha', 'Beta'])
  );
});
