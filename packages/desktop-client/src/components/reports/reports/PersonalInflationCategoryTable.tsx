import type { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type {
  CategoryInflation,
  InflationComparison,
  PersonalInflationResult,
} from '@actual-app/core/shared/personal-inflation';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import {
  formatPeriod,
  formatRate,
  formatShare,
  getCategoryRows,
  getRateColor,
} from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import type { PersonalInflationData } from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import { useCategoriesById } from '#hooks/useCategories';
import { useFormat } from '#hooks/useFormat';
import { useLanguage, useLocale } from '#hooks/useLocale';

const cellStyle: CSSProperties = {
  flex: 1,
  textAlign: 'right',
  padding: '8px 10px',
};

const nameCellStyle: CSSProperties = {
  ...cellStyle,
  flex: 2,
  textAlign: 'left',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const subheadingStyle: CSSProperties = {
  fontWeight: 400,
  fontSize: 'var(--font-size-10)',
  color: theme.pageTextSubdued,
};

type PersonalInflationCategoryTableProps = {
  byComparison: PersonalInflationData['byComparison'];
  comparison: InflationComparison;
};

export function PersonalInflationCategoryTable({
  byComparison,
  comparison,
}: PersonalInflationCategoryTableProps) {
  const { t } = useTranslation();
  const format = useFormat();
  const language = useLanguage();
  const locale = useLocale();
  const { data: categoriesById } = useCategoriesById();

  const rows = getCategoryRows(byComparison, comparison);
  const selected = byComparison[comparison];

  if (rows.length === 0) {
    return (
      <View style={{ color: theme.pageTextSubdued, padding: 10 }}>
        <Trans>No spending in this period.</Trans>
      </View>
    );
  }

  function comparedPeriodHeading(result: PersonalInflationResult) {
    return result.hasInsufficientHistory ? (
      <View style={{ ...subheadingStyle, color: theme.warningText }}>
        <Trans>Insufficient history</Trans>
      </View>
    ) : (
      <View style={subheadingStyle}>{formatPeriod(result.prior, locale)}</View>
    );
  }

  function changeText(
    entry: CategoryInflation | null,
    result: PersonalInflationResult,
  ) {
    if (!entry || result.hasInsufficientHistory) {
      return '—';
    }
    return entry.rate === null ? t('New') : formatRate(entry.rate, language);
  }

  return (
    <View style={{ ...styles.smallText, color: theme.tableText }}>
      <View
        style={{
          flexDirection: 'row',
          fontWeight: 600,
          borderBottom: `1px solid ${theme.tableBorder}`,
        }}
      >
        <View style={nameCellStyle}>
          <Trans>Category</Trans>
        </View>
        <View style={cellStyle}>
          <Trans>Now</Trans>
          <View style={subheadingStyle}>
            {formatPeriod(selected.current, locale)}
          </View>
        </View>
        <View style={cellStyle}>
          <Trans>vs. previous period</Trans>
          {comparedPeriodHeading(byComparison['previous-period'])}
        </View>
        <View style={cellStyle}>
          <Trans>vs. last year</Trans>
          {comparedPeriodHeading(byComparison['previous-year'])}
        </View>
        <View style={cellStyle}>
          <Trans>Share of spending</Trans>
        </View>
        <View style={cellStyle}>
          <Trans>Contribution</Trans>
        </View>
      </View>

      {rows.map(row => (
        <View
          key={row.category}
          style={{
            flexDirection: 'row',
            borderBottom: `1px solid ${theme.tableBorder}`,
          }}
        >
          <View style={nameCellStyle}>
            {categoriesById?.list[row.category]?.name ?? t('Unknown')}
          </View>
          <FinancialText as={View} style={cellStyle}>
            <PrivacyFilter>{format(row.current, 'financial')}</PrivacyFilter>
          </FinancialText>
          <View
            style={{
              ...cellStyle,
              ...styles.tnum,
              color: getRateColor(row.previousPeriod?.rate ?? null),
            }}
          >
            {changeText(row.previousPeriod, byComparison['previous-period'])}
          </View>
          <View
            style={{
              ...cellStyle,
              ...styles.tnum,
              color: getRateColor(row.previousYear?.rate ?? null),
            }}
          >
            {changeText(row.previousYear, byComparison['previous-year'])}
          </View>
          <View style={{ ...cellStyle, ...styles.tnum }}>
            {row.selected && !selected.hasInsufficientHistory
              ? formatShare(row.selected.weight, language)
              : '—'}
          </View>
          <View
            style={{
              ...cellStyle,
              ...styles.tnum,
              color: getRateColor(row.selected?.contribution ?? null),
            }}
          >
            {row.selected?.contribution == null
              ? '—'
              : formatRate(row.selected.contribution, language)}
          </View>
        </View>
      ))}

      <View
        style={{
          ...subheadingStyle,
          fontSize: 'var(--font-size-12)',
          marginTop: 8,
        }}
      >
        <Trans>
          Share of spending and contribution use the comparison selected above.
        </Trans>
      </View>
    </View>
  );
}
