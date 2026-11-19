import { describe, expect, it } from 'vitest';

import { getPayeeUsageDisplay } from './payeeUsageDisplay';

const baseArgs = {
  dateFormat: 'MM/dd/yyyy',
  neverLabel: 'Never',
};

describe('getPayeeUsageDisplay', () => {
  it('shows a placeholder in both cells while loading', () => {
    // A literal, not the exported constant: comparing against the constant
    // would still pass if it were emptied, leaving the cells blank
    expect(
      getPayeeUsageDisplay({ ...baseArgs, stats: undefined, isLoading: true }),
    ).toEqual({
      count: '…',
      lastUsed: '…',
      isLoading: true,
      isUnused: false,
    });
  });

  it('shows 0 and the never label, muted, for a payee with no transactions', () => {
    expect(
      getPayeeUsageDisplay({ ...baseArgs, stats: undefined, isLoading: false }),
    ).toEqual({
      count: '0',
      lastUsed: 'Never',
      isLoading: false,
      isUnused: true,
    });
  });

  it('uses the never label it is given, so it can be translated', () => {
    const display = getPayeeUsageDisplay({
      ...baseArgs,
      neverLabel: 'Nunca',
      stats: undefined,
      isLoading: false,
    });

    expect(display.lastUsed).toBe('Nunca');
  });

  it('shows the count and last-used date for a used payee', () => {
    expect(
      getPayeeUsageDisplay({
        ...baseArgs,
        stats: { count: 312, lastUsed: '2026-10-30' },
        isLoading: false,
      }),
    ).toEqual({
      count: '312',
      lastUsed: '10/30/2026',
      isLoading: false,
      isUnused: false,
    });
  });

  it("formats the date with the user's date format", () => {
    const stats = { count: 1, lastUsed: '2024-01-14' };

    expect(
      getPayeeUsageDisplay({
        ...baseArgs,
        dateFormat: 'dd.MM.yyyy',
        stats,
        isLoading: false,
      }).lastUsed,
    ).toBe('14.01.2024');
    expect(
      getPayeeUsageDisplay({
        ...baseArgs,
        dateFormat: 'yyyy-MM-dd',
        stats,
        isLoading: false,
      }).lastUsed,
    ).toBe('2024-01-14');
  });
});
