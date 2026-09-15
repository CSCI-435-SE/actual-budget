import { theme } from '@actual-app/components/theme';
import { describe, expect, it } from 'vitest';

import { makeBalanceAmountStyle } from './util';

describe('makeBalanceAmountStyle', () => {
  it('colours by the sign of the balance', () => {
    expect(makeBalanceAmountStyle(-1)).toEqual({
      color: theme.budgetNumberNegative,
    });
    expect(makeBalanceAmountStyle(0)).toEqual({
      color: theme.budgetNumberZero,
    });
    expect(makeBalanceAmountStyle(1)).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('keeps sub-unit balances coloured when the fraction is shown', () => {
    expect(makeBalanceAmountStyle(4, null, null, { decimalPlaces: 2 })).toEqual(
      {
        color: theme.budgetNumberPositive,
      },
    );
  });

  it('greys out a balance that displays as zero when the fraction is hidden', () => {
    expect(
      makeBalanceAmountStyle(4, null, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberZero });
    expect(
      makeBalanceAmountStyle(-4, null, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberZero });
  });

  it('does not round away whole units of a zero-decimal currency', () => {
    // 4 is ¥4, not 4 cents, so hiding the fraction must not zero it out.
    expect(
      makeBalanceAmountStyle(4, null, null, {
        decimalPlaces: 0,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberPositive });
  });

  it('compares the budgeted amount against the goal', () => {
    expect(makeBalanceAmountStyle(100, 5000, 4999)).toEqual({
      color: theme.templateNumberUnderFunded,
    });
    expect(makeBalanceAmountStyle(100, 5000, 5000)).toEqual({
      color: theme.templateNumberFunded,
    });
  });

  it('treats amounts that display identically as funded when the fraction is hidden', () => {
    expect(
      makeBalanceAmountStyle(100, 5000, 4999, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.templateNumberFunded });
  });
});
