import { theme } from '@actual-app/components/theme';
import { describe, expect, it } from 'vitest';

import { makeBalanceAmountStyle } from './util';

describe('makeBalanceAmountStyle', () => {
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
