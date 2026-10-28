import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { PersonalInflationWidget } from '@actual-app/core/types/models';

import { PrivacyFilter } from '#components/PrivacyFilter';
import { DateRange } from '#components/reports/DateRange';
import { PersonalInflationGraph } from '#components/reports/graphs/PersonalInflationGraph';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { calculateTimeRange } from '#components/reports/reportRanges';
import {
  createPersonalInflationSpreadsheet,
  DEFAULT_COMPARISON,
  defaultTimeFrame,
  formatPeriod,
  formatRate,
  getRateColor,
} from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import type { PersonalInflationData } from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useLanguage, useLocale } from '#hooks/useLocale';

type PersonalInflationCardProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: PersonalInflationWidget['meta'];
  onMetaChange: (newMeta: PersonalInflationWidget['meta']) => void;
};

export function PersonalInflationCard({
  widgetId,
  isEditing,
  meta = {},
  onMetaChange,
}: PersonalInflationCardProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const language = useLanguage();
  const { isNarrowWidth } = useResponsive();

  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);

  const [start, end] = calculateTimeRange(meta?.timeFrame, defaultTimeFrame);
  const comparison = meta?.comparison ?? DEFAULT_COMPARISON;

  // useReport refetches whenever it gets a new function
  const params = useMemo(
    () =>
      createPersonalInflationSpreadsheet({ start, end, comparison, locale }),
    [start, end, comparison, locale],
  );
  const data = useReport<PersonalInflationData>('personal_inflation', params);
  const rate = data?.summary.rate ?? null;

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to={`/reports/personal-inflation/${widgetId}`}
      onRename={() => setNameMenuOpen(true)}
    >
      <View
        style={{ flex: 1 }}
        onPointerEnter={() => setIsCardHovered(true)}
        onPointerLeave={() => setIsCardHovered(false)}
      >
        <View style={{ flexDirection: 'row', padding: 20 }}>
          <View style={{ flex: 1 }}>
            <ReportCardName
              name={meta?.name || t('Personal Inflation')}
              isEditing={nameMenuOpen}
              onChange={newName => {
                onMetaChange({
                  ...meta,
                  name: newName,
                });
                setNameMenuOpen(false);
              }}
              onClose={() => setNameMenuOpen(false)}
            />
            <DateRange start={start} end={end} />
          </View>
          {data && (
            <View style={{ textAlign: 'right' }}>
              <Block
                style={{
                  ...styles.largeText,
                  ...styles.tnum,
                  fontWeight: 500,
                  marginBottom: 5,
                  color: getRateColor(rate),
                }}
              >
                <PrivacyFilter activationFilters={[!isCardHovered]}>
                  {data.summary.hasInsufficientHistory
                    ? t('Insufficient history')
                    : rate === null
                      ? t('N/A')
                      : formatRate(rate, language)}
                </PrivacyFilter>
              </Block>
              <Block
                style={{
                  fontSize: 'var(--font-size-12)',
                  color: theme.pageTextSubdued,
                }}
              >
                {t('Compared with {{period}}', {
                  period: formatPeriod(data.summary.prior, locale),
                })}
              </Block>
              {data.summary.isPartial && (
                <Block
                  style={{
                    fontSize: 'var(--font-size-10)',
                    color: theme.warningText,
                    marginTop: 2,
                  }}
                >
                  <Trans>Includes current month</Trans>
                </Block>
              )}
            </View>
          )}
        </View>

        {data ? (
          <PersonalInflationGraph
            data={data.trend}
            compact
            showTooltip={!isEditing && !isNarrowWidth}
            style={{ height: 'auto', flex: 1 }}
          />
        ) : (
          <LoadingIndicator />
        )}
      </View>
    </ReportCard>
  );
}
