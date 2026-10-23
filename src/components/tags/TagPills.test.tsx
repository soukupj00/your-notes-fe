import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { newTag } from '@/lib/rows.ts';
import { TagPills } from './TagPills.tsx';

it('TagPills shows labels in label order', () => {
  const tags = [newTag('Beta'), { ...newTag('Zulu'), position: 'a0' }, newTag('Alpha')];

  render(<TagPills tags={tags} />);

  expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
    'Zulu',
    'Alpha',
    'Beta',
  ]);
});
