import React from 'react';

import type { CategoryGroupEntity } from '@actual-app/core/types/models';
import { render, screen } from '@testing-library/react';

import { TestProviders } from '#mocks';

import { CategoryAutocomplete } from './CategoryAutocomplete';

// Balances aren't under test here
vi.mock('#hooks/useSheetValue', () => ({ useSheetValue: () => 0 }));
vi.mock(
  '#components/budget/envelope/EnvelopeBudgetComponents',
  async importOriginal => ({
    ...(await importOriginal()),
    useEnvelopeSheetValue: () => 0,
  }),
);

const categoryGroups = [
  {
    id: 'g-food',
    name: 'Everyday',
    categories: [
      { id: 'food', name: 'Food', group: 'g-food' },
      { id: 'dining', name: 'Dining Out', group: 'g-food', parent_id: 'food' },
      { id: 'rent', name: 'Rent', group: 'g-food' },
    ],
  },
] satisfies CategoryGroupEntity[];

describe('CategoryAutocomplete', () => {
  it('indents subcategories under their parent', () => {
    render(
      <TestProviders>
        <CategoryAutocomplete
          categoryGroups={categoryGroups}
          value={null}
          onSelect={vi.fn()}
          embedded
          showBalances={false}
        />
      </TestProviders>,
    );

    const indent = (name: string) =>
      getComputedStyle(screen.getByTestId(`${name}-category-item`)).paddingLeft;
    expect(indent('Food')).toBe('20px');
    expect(indent('Dining Out')).toBe('36px');
    expect(indent('Rent')).toBe('20px');
  });
});
