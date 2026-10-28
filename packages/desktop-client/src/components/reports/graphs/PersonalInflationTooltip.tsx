import { useTranslation } from 'react-i18next';

import { theme } from '@actual-app/components/theme';
import { css } from '@emotion/css';

import { formatRate } from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import type { PersonalInflationTrendPoint } from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import { useLanguage } from '#hooks/useLocale';

type PersonalInflationTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload: PersonalInflationTrendPoint }>;
};

export function PersonalInflationTooltip({
  active,
  payload,
}: PersonalInflationTooltipProps) {
  const { t } = useTranslation();
  const language = useLanguage();

  if (!active || !payload || !payload.length) {
    return null;
  }

  const { date, rate, hasInsufficientHistory } = payload[0].payload;
  return (
    <div
      className={css({
        zIndex: 1000,
        pointerEvents: 'none',
        borderRadius: 2,
        boxShadow: '0 1px 6px rgba(0, 0, 0, .20)',
        backgroundColor: theme.menuBackground,
        color: theme.menuItemText,
        padding: 10,
      })}
    >
      <div style={{ marginBottom: 5 }}>
        <strong>{date}</strong>
      </div>
      <div>
        {hasInsufficientHistory
          ? t('Insufficient history to compare')
          : rate === null
            ? t('No earlier spending to compare')
            : t('Personal inflation: {{rate}}', {
                rate: formatRate(rate, language),
              })}
      </div>
    </div>
  );
}
