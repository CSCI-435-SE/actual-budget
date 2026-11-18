import type { PayeeUsageStats } from '@actual-app/core/server/payees/app';
import * as monthUtils from '@actual-app/core/shared/months';
import type { Locale } from 'date-fns';

// Shown in both cells until the usage stats have loaded
export const USAGE_LOADING_PLACEHOLDER = '…';

export type PayeeUsageDisplay = {
  count: string;
  lastUsed: string;
  isLoading: boolean;
  // No transactions: shown as "0" / "Never" in a muted style
  isUnused: boolean;
};

type GetPayeeUsageDisplayArgs = {
  // Undefined when the payee has no transactions
  stats: PayeeUsageStats | undefined;
  isLoading: boolean;
  dateFormat: string;
  locale?: Locale;
  // Translated by the caller, so this stays free of React and i18n
  neverLabel: string;
};

export function getPayeeUsageDisplay({
  stats,
  isLoading,
  dateFormat,
  locale,
  neverLabel,
}: GetPayeeUsageDisplayArgs): PayeeUsageDisplay {
  if (isLoading) {
    return {
      count: USAGE_LOADING_PLACEHOLDER,
      lastUsed: USAGE_LOADING_PLACEHOLDER,
      isLoading: true,
      isUnused: false,
    };
  }

  if (!stats) {
    return {
      count: '0',
      lastUsed: neverLabel,
      isLoading: false,
      isUnused: true,
    };
  }

  return {
    count: String(stats.count),
    lastUsed: monthUtils.format(stats.lastUsed, dateFormat, locale),
    isLoading: false,
    isUnused: false,
  };
}
