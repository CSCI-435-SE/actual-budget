import { createElement } from 'react';
import type { ReactNode } from 'react';

import { integerToCurrency } from '@actual-app/core/shared/util';
import type { SyncedPrefs } from '@actual-app/core/types/prefs';
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createTestAppStore, TestProviders } from '#mocks';
import { mergeSyncedPrefs } from '#prefs/prefsSlice';

import { useFormat } from './useFormat';
import type { UseFormatResult } from './useFormat';

// The directional formatting characters wrapped around the symbol when it is
// rendered before the amount, and the narrow no-break space used as the
// optional separator between amount and symbol.
const LRE = '‪';
const PDF = '‬';
const NNBSP = ' ';

function renderFormat(prefs: SyncedPrefs = {}): UseFormatResult {
  const store = createTestAppStore();
  store.dispatch(mergeSyncedPrefs({ numberFormat: 'comma-dot', ...prefs }));

  const { result } = renderHook(() => useFormat(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(TestProviders, { store, children }),
  });

  return result.current;
}

describe('useFormat symbol placement', () => {
  it('renders the symbol before the amount by default', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format(123456, 'financial')).toBe(`${LRE}$${PDF}1,234.56`);
  });

  it('renders the symbol after the amount when configured', () => {
    const format = renderFormat({
      defaultCurrencyCode: 'EUR',
      numberFormat: 'dot-comma',
      currencySymbolPosition: 'after',
    });
    expect(format(123456, 'financial')).toBe('1.234,56€');
  });

  it('inserts a narrow no-break space when the separator is enabled', () => {
    const before = renderFormat({
      defaultCurrencyCode: 'USD',
      currencySpaceBetweenAmountAndSymbol: 'true',
    });
    expect(before(123456, 'financial')).toBe(`${LRE}$${PDF}${NNBSP}1,234.56`);

    const after = renderFormat({
      defaultCurrencyCode: 'EUR',
      numberFormat: 'dot-comma',
      currencySymbolPosition: 'after',
      currencySpaceBetweenAmountAndSymbol: 'true',
    });
    expect(after(123456, 'financial')).toBe(`1.234,56${NNBSP}€`);
  });

  it('hoists the negative sign outside the symbol', () => {
    const before = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(before(-500, 'financial')).toBe(`-${LRE}$${PDF}5.00`);

    const after = renderFormat({
      defaultCurrencyCode: 'EUR',
      numberFormat: 'dot-comma',
      currencySymbolPosition: 'after',
      currencySpaceBetweenAmountAndSymbol: 'true',
    });
    expect(after(-123456, 'financial')).toBe(`-1.234,56${NNBSP}€`);
  });

  it('uses the configured number format for grouping', () => {
    const format = renderFormat({
      defaultCurrencyCode: 'INR',
      numberFormat: 'comma-dot-in',
    });
    expect(format(100000000, 'financial')).toBe(`${LRE}₹${PDF}10,00,000.00`);
  });

  it('applies no styling when no currency is selected', () => {
    const format = renderFormat({
      defaultCurrencyCode: '',
      currencySymbolPosition: 'after',
      currencySpaceBetweenAmountAndSymbol: 'true',
    });
    expect(format(123456, 'financial')).toBe('1,234.56');
  });
});

describe('useFormat format types', () => {
  it('prefixes non-negative amounts with + for financial-with-sign', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format(500, 'financial-with-sign')).toBe(`+${LRE}$${PDF}5.00`);
    expect(format(0, 'financial-with-sign')).toBe(`+${LRE}$${PDF}0.00`);
    expect(format(-500, 'financial-with-sign')).toBe(`-${LRE}$${PDF}5.00`);
  });

  it('drops the fraction for financial-no-decimals', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format(123456, 'financial-no-decimals')).toBe(`${LRE}$${PDF}1,235`);
  });

  it('drops the fraction for every financial type when hideFraction is set', () => {
    const format = renderFormat({
      defaultCurrencyCode: 'USD',
      hideFraction: 'true',
    });
    expect(format(123456, 'financial')).toBe(`${LRE}$${PDF}1,235`);
    expect(format(123456, 'financial-with-sign')).toBe(`+${LRE}$${PDF}1,235`);
    expect(format(123456, 'financial-no-decimals')).toBe(`${LRE}$${PDF}1,235`);
  });

  it('does not apply currency styling to non-financial types', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format(1234.56, 'number')).toBe('1,234.56');
    expect(format(25, 'percentage')).toBe('25%');
  });
});

describe('useFormat amount scaling', () => {
  it('scales by the currency decimal places', () => {
    const usd = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(usd.currency.decimalPlaces).toBe(2);
    expect(usd.toAmount(1234)).toBe(12.34);
    expect(usd.fromAmount(12.34)).toBe(1234);

    const jpy = renderFormat({ defaultCurrencyCode: 'JPY' });
    expect(jpy.currency.decimalPlaces).toBe(0);
    expect(jpy.toAmount(1234)).toBe(1234);
    expect(jpy.fromAmount(1234)).toBe(1234);
  });

  it('rounds to the nearest integer amount', () => {
    const jpy = renderFormat({ defaultCurrencyCode: 'JPY' });
    expect(jpy.fromAmount(1234.6)).toBe(1235);
  });
});

describe('useFormat with a zero-decimal currency (JPY)', () => {
  it('displays no fraction', () => {
    const format = renderFormat({ defaultCurrencyCode: 'JPY' });
    expect(format(1234, 'financial')).toBe(`${LRE}¥${PDF}1,234`);
    expect(format(-1234, 'financial')).toBe(`-${LRE}¥${PDF}1,234`);
  });

  it('round-trips through forEdit and fromEdit', () => {
    const format = renderFormat({ defaultCurrencyCode: 'JPY' });
    expect(format.forEdit(1234)).toBe('1,234');
    expect(format.fromEdit('1,234')).toBe(1234);
    expect(format.fromEdit(format.forEdit(1234))).toBe(1234);
  });

  it('round-trips the displayed string back through fromEdit', () => {
    const format = renderFormat({ defaultCurrencyCode: 'JPY' });
    expect(format.fromEdit(format(1234, 'financial'))).toBe(1234);
  });

  it('round-trips at two decimal places for comparison (USD)', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format.forEdit(1234)).toBe('12.34');
    expect(format.fromEdit('12.34')).toBe(1234);
    expect(format.fromEdit(format(1234, 'financial'))).toBe(1234);
  });
});

describe('useFormat fromEdit', () => {
  it('strips directional formatting characters', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format.fromEdit(`${LRE}$${PDF}12.34`)).toBe(1234);
  });

  it('strips letters', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format.fromEdit('12.34 USD')).toBe(1234);
  });

  it('evaluates arithmetic expressions', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format.fromEdit('10+5')).toBe(1500);
    expect(format.fromEdit('10.50 * 2')).toBe(2100);
  });

  it('falls back to currencyToAmount when arithmetic parsing fails', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    // A leading `+` — as emitted by `financial-with-sign` — is not a valid
    // arithmetic expression, so the parse falls through to `currencyToAmount`.
    expect(format.fromEdit('+5.00')).toBe(500);
    expect(format.fromEdit(format(500, 'financial-with-sign'))).toBe(500);
  });

  it('returns the default value for empty and unparseable input', () => {
    const format = renderFormat({ defaultCurrencyCode: 'USD' });
    expect(format.fromEdit('')).toBe(null);
    expect(format.fromEdit('   ')).toBe(null);
    expect(format.fromEdit('', 0)).toBe(0);
    expect(format.fromEdit('abc', 42)).toBe(42);
  });
});

describe('useFormat parity with integerToCurrency when no currency is set', () => {
  const numberFormats = [
    'comma-dot',
    'dot-comma',
    'space-comma',
    'apostrophe-dot',
    'comma-dot-in',
  ];

  const values = [0, 1, -1, 500, -500, 123456, -123456, 100000000];

  it.each(numberFormats)('matches integerToCurrency (%s)', numberFormat => {
    const format = renderFormat({ numberFormat, defaultCurrencyCode: '' });
    for (const value of values) {
      expect(format(value, 'financial')).toBe(integerToCurrency(value));
    }
  });

  it('matches integerToCurrency when fractions are hidden', () => {
    const format = renderFormat({
      defaultCurrencyCode: '',
      hideFraction: 'true',
    });
    for (const value of values) {
      expect(format(value, 'financial')).toBe(integerToCurrency(value));
    }
  });

  it('matches integerToCurrency even with the symbol prefs set', () => {
    const format = renderFormat({
      defaultCurrencyCode: '',
      currencySymbolPosition: 'after',
      currencySpaceBetweenAmountAndSymbol: 'true',
    });
    for (const value of values) {
      expect(format(value, 'financial')).toBe(integerToCurrency(value));
    }
  });
});
