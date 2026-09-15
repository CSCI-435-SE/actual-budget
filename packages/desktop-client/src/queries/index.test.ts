import { q } from '@actual-app/core/shared/query';
import { describe, expect, it } from 'vitest';

import { transactionsSearch } from './index';

function amountFilters(search: string, decimalPlaces?: number) {
  const query = transactionsSearch(
    q('transactions'),
    search,
    'MM/dd/yyyy',
    decimalPlaces,
  );

  const [filter] = query.serialize().filterExpressions as Array<{
    $or: { $or: Array<Record<string, unknown>> };
  }>;

  return filter.$or.$or.filter(clause => 'amount' in clause);
}

describe('transactionsSearch', () => {
  it('scales the searched amount at two decimal places by default', () => {
    expect(amountFilters('12.34')).toEqual([
      { amount: { $transform: '$abs', $eq: 1234 } },
    ]);

    expect(amountFilters('12')).toEqual([
      { amount: { $transform: '$abs', $eq: 1200 } },
      { amount: { $transform: { $abs: { $idiv: ['$', 100] } }, $eq: 12 } },
    ]);
  });

  it('scales the searched amount for a zero-decimal currency', () => {
    expect(amountFilters('1200', 0)).toEqual([
      { amount: { $transform: '$abs', $eq: 1200 } },
      { amount: { $transform: { $abs: { $idiv: ['$', 1] } }, $eq: 1200 } },
    ]);
  });

  it('omits the amount filters when the search is not numeric', () => {
    expect(amountFilters('groceries')).toEqual([]);
  });
});
