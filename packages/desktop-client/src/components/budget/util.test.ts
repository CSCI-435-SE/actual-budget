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

  it('colors a negative balance red regardless of spending', () => {
    expect(makeBalanceAmountStyle(-1000)).toEqual({
      color: theme.budgetNumberNegative,
    });
  });

  it('colors a zero balance as the neutral zero color', () => {
    expect(makeBalanceAmountStyle(0, null, 10000, -20000)).toEqual({
      color: theme.budgetNumberZero,
    });
  });

  it('colors a non-negative balance neutrally when spending is within budget', () => {
    // Budgeted $100, spent $50 this month, balance still $50.
    expect(makeBalanceAmountStyle(5000, null, 10000, -5000)).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('colors a non-negative balance yellow when this month overspent but rollover covers it', () => {
    // Budgeted $100, spent $180 this month (over by $80), but a prior
    // rollover surplus keeps the balance at $10.
    expect(makeBalanceAmountStyle(1000, null, 10000, -18000)).toEqual({
      color: theme.budgetNumberOverspent,
    });
  });

  it('does not apply the overspend color when no spent value is provided', () => {
    expect(makeBalanceAmountStyle(1000, null, 10000)).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('keeps sub-unit balances coloured when the fraction is shown', () => {
    expect(
      makeBalanceAmountStyle(4, null, null, null, { decimalPlaces: 2 }),
    ).toEqual({
      color: theme.budgetNumberPositive,
    });
  });

  it('greys out a balance that displays as zero when the fraction is hidden', () => {
    expect(
      makeBalanceAmountStyle(4, null, null, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberZero });
    expect(
      makeBalanceAmountStyle(-4, null, null, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.budgetNumberZero });
  });

  it('does not round away whole units of a zero-decimal currency', () => {
    // 4 is ¥4, not 4 cents, so hiding the fraction must not zero it out.
    expect(
      makeBalanceAmountStyle(4, null, null, null, {
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
      makeBalanceAmountStyle(100, 5000, 4999, null, {
        decimalPlaces: 2,
        hideFraction: true,
      }),
    ).toEqual({ color: theme.templateNumberFunded });
  });

  it('leaves goal-template funded/underfunded coloring unaffected by overspending', () => {
    // Goal templates use budgetedValue vs goalValue, ignoring spent entirely.
    expect(makeBalanceAmountStyle(1000, 10000, 5000, -18000)).toEqual({
      color: theme.templateNumberUnderFunded,
    });
    expect(makeBalanceAmountStyle(1000, 5000, 10000, -18000)).toEqual({
      color: theme.templateNumberFunded,
    });
  });
});
