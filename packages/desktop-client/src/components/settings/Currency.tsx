import React, { useMemo } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Select } from '@actual-app/components/select';
import { theme } from '@actual-app/components/theme';
import { tokens } from '@actual-app/components/tokens';
import { View } from '@actual-app/components/view';
import { currencies, getCurrency } from '@actual-app/core/shared/currencies';
import { css } from '@emotion/css';

import { Checkbox } from '#components/forms';
import { useSidebar } from '#components/sidebar/SidebarProvider';
import { useSyncedPref } from '#hooks/useSyncedPref';

import { Column } from './UI';

/**
 * The currency half of the formatting settings. Rendered as a section of
 * `FormatSettings` rather than on its own, because picking a currency also
 * changes the number format and whether fractions are shown.
 */
export function CurrencyFormatSettings() {
  const { t } = useTranslation();

  const currencyTranslations = useMemo(
    () =>
      new Map<string, string>([
        ['', t('None')],
        ['AED', t('UAE Dirham')],
        ['ARS', t('Argentinian Peso')],
        ['AUD', t('Australian Dollar')],
        ['BRL', t('Brazilian Real')],
        ['BYN', t('Belarusian Ruble')],
        ['CAD', t('Canadian Dollar')],
        ['CHF', t('Swiss Franc')],
        ['CLP', t('Chilean Peso')],
        ['CNY', t('Yuan Renminbi')],
        ['COP', t('Colombian Peso')],
        ['CRC', t('Costa Rican Colón')],
        ['CZK', t('Czech Koruna')],
        ['DKK', t('Danish Krone')],
        ['DOP', t('Dominican Peso')],
        ['EGP', t('Egyptian Pound')],
        ['EUR', t('Euro')],
        ['GBP', t('Pound Sterling')],
        ['GTQ', t('Guatemalan Quetzal')],
        ['HKD', t('Hong Kong Dollar')],
        ['HUF', t('Hungarian Forint')],
        ['IDR', t('Indonesian Rupiah')],
        ['INR', t('Indian Rupee')],
        ['IRR', t('Iranian Rial')],
        ['JMD', t('Jamaican Dollar')],
        ['JPY', t('Japanese Yen')],
        ['KRW', t('South Korean Won')],
        ['LKR', t('Sri Lankan Rupee')],
        ['MDL', t('Moldovan Leu')],
        ['MXN', t('Mexican Peso')],
        ['MYR', t('Malaysian Ringgit')],
        ['PHP', t('Philippine Peso')],
        ['PKR', t('Pakistani Rupee')],
        ['PLN', t('Polish Złoty')],
        ['QAR', t('Qatari Riyal')],
        ['RON', t('Romanian Leu')],
        ['RSD', t('Serbian Dinar')],
        ['RUB', t('Russian Ruble')],
        ['SAR', t('Saudi Riyal')],
        ['SEK', t('Swedish Krona')],
        ['SGD', t('Singapore Dollar')],
        ['THB', t('Thai Baht')],
        ['TRY', t('Turkish Lira')],
        ['TWD', t('New Taiwan Dollar')],
        ['UAH', t('Ukrainian Hryvnia')],
        ['USD', t('US Dollar')],
        ['UZS', t('Uzbek Soum')],
      ]),
    [t],
  );

  const [defaultCurrencyCode, setDefaultCurrencyCodePref] = useSyncedPref(
    'defaultCurrencyCode',
  );
  const selectedCurrencyCode = defaultCurrencyCode || '';

  const [symbolPosition, setSymbolPositionPref] = useSyncedPref(
    'currencySymbolPosition',
  );
  const [spaceEnabled, setSpaceEnabledPref] = useSyncedPref(
    'currencySpaceBetweenAmountAndSymbol',
  );
  const [, setNumberFormatPref] = useSyncedPref('numberFormat');
  const [, setHideFractionPref] = useSyncedPref('hideFraction');

  const sidebar = useSidebar();

  const selectButtonClassName = css({
    '&[data-hovered]': {
      backgroundColor: theme.buttonNormalBackgroundHover,
    },
  });

  const currencyOptions: [string, string][] = currencies.map(currency => {
    const translatedName =
      currencyTranslations.get(currency.code) ?? currency.name;
    if (currency.code === '') {
      return [currency.code, translatedName];
    }
    return [
      currency.code,
      `${currency.code} - ${translatedName} (${currency.symbol})`,
    ];
  });

  const handleCurrencyChange = (code: string) => {
    setDefaultCurrencyCodePref(code);
    if (code !== '') {
      const cur = getCurrency(code);
      setNumberFormatPref(cur.numberFormat);
      setHideFractionPref(cur.decimalPlaces === 0 ? 'true' : 'false');
      setSpaceEnabledPref(cur.symbolFirst ? 'false' : 'true');
      setSymbolPositionPref(cur.symbolFirst ? 'before' : 'after');
    }
  };

  const symbolPositionOptions = useMemo(() => {
    const selectedCurrency = getCurrency(selectedCurrencyCode);
    const symbol = selectedCurrency.symbol || '$';
    const space = spaceEnabled === 'true' ? ' ' : '';

    return [
      {
        value: 'before',
        label: `${t('Before amount')} (${t('e.g.')} ${symbol}${space}100)`,
      },
      {
        value: 'after',
        label: `${t('After amount')} (${t('e.g.')} 100${space}${symbol})`,
      },
    ];
  }, [selectedCurrencyCode, spaceEnabled, t]);

  return (
    <View style={{ flexDirection: 'column', gap: '1em', width: '100%' }}>
      <View
        style={{
          flexDirection: 'column',
          gap: '1em',
          width: '100%',
          [`@media (min-width: ${
            sidebar.floating
              ? tokens.breakpoint_small
              : tokens.breakpoint_medium
          })`]: {
            flexDirection: 'row',
          },
        }}
      >
        <Column title={t('Currency')}>
          <Select
            value={selectedCurrencyCode}
            onChange={handleCurrencyChange}
            options={currencyOptions}
            className={selectButtonClassName}
            style={{ width: '100%' }}
          />
        </Column>

        <Column
          title={t('Symbol position')}
          style={{
            visibility: selectedCurrencyCode === '' ? 'hidden' : 'visible',
          }}
        >
          <Select
            value={symbolPosition || 'before'}
            onChange={value => setSymbolPositionPref(value)}
            options={symbolPositionOptions.map(f => [f.value, f.label])}
            className={selectButtonClassName}
            style={{ width: '100%' }}
            disabled={selectedCurrencyCode === ''}
          />
        </Column>
      </View>

      {selectedCurrencyCode !== '' && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Checkbox
            id="settings-spaceEnabled"
            checked={spaceEnabled === 'true'}
            onChange={e =>
              setSpaceEnabledPref(e.target.checked ? 'true' : 'false')
            }
          />
          <label
            htmlFor="settings-spaceEnabled"
            style={{ marginLeft: '0.5em' }}
          >
            <Trans>Add space between amount and symbol</Trans>
          </label>
        </View>
      )}
    </View>
  );
}
