import { useEffect, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { Paragraph } from '@actual-app/components/paragraph';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { InflationComparison } from '@actual-app/core/shared/personal-inflation';
import type {
  PersonalInflationWidget,
  TimeFrame,
} from '@actual-app/core/types/models';

import { EditablePageHeaderTitle } from '#components/EditablePageHeaderTitle';
import { FinancialText } from '#components/FinancialText';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page, PageHeader } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { PersonalInflationGraph } from '#components/reports/graphs/PersonalInflationGraph';
import { Header } from '#components/reports/Header';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { calculateTimeRange } from '#components/reports/reportRanges';
import {
  createPersonalInflationSpreadsheet,
  DEFAULT_COMPARISON,
  defaultTimeFrame,
  formatPeriod,
  formatRate,
  getRateColor,
  TREND_MONTHS,
} from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import type { PersonalInflationData } from '#components/reports/spreadsheets/personal-inflation-spreadsheet';
import { useReport } from '#components/reports/useReport';
import { useFormat } from '#hooks/useFormat';
import { useLanguage, useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { useUpdateDashboardWidgetMutation } from '#reports/mutations';

import { PersonalInflationCategoryTable } from './PersonalInflationCategoryTable';
import { PersonalInflationComparisonSelector } from './PersonalInflationComparisonSelector';

type PersonalInflationReportProps = {
  widget?: PersonalInflationWidget;
};

export function PersonalInflationReport({
  widget,
}: PersonalInflationReportProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const language = useLanguage();
  const format = useFormat();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isNarrowWidth } = useResponsive();

  const [initialStart, initialEnd, initialMode] = calculateTimeRange(
    widget?.meta?.timeFrame,
    defaultTimeFrame,
  );
  const [start, setStart] = useState<string>(initialStart);
  const [end, setEnd] = useState<string>(initialEnd);
  const [mode, setMode] = useState<TimeFrame['mode']>(initialMode);
  const [comparison, setComparison] = useState<InflationComparison>(
    widget?.meta?.comparison ?? DEFAULT_COMPARISON,
  );

  const [allMonths, setAllMonths] = useState<Array<{
    name: string;
    pretty: string;
  }> | null>(null);
  const [earliestTransaction, setEarliestTransaction] = useState('');
  const [latestTransaction, setLatestTransaction] = useState('');

  const [_firstDayOfWeekIdx] = useSyncedPref('firstDayOfWeekIdx');
  const firstDayOfWeekIdx = _firstDayOfWeekIdx || '0';

  // useReport refetches whenever it gets a new function
  const reportParams = useMemo(
    () =>
      createPersonalInflationSpreadsheet({ start, end, comparison, locale }),
    [start, end, comparison, locale],
  );
  const data = useReport<PersonalInflationData>(
    'personal_inflation',
    reportParams,
  );

  useEffect(() => {
    async function run() {
      const [earliestTrans, latestTrans] = await Promise.all([
        send('get-earliest-transaction'),
        send('get-latest-transaction'),
      ]);
      const today = monthUtils.currentDay();
      setEarliestTransaction(earliestTrans ? earliestTrans.date : today);
      setLatestTransaction(latestTrans ? latestTrans.date : today);

      const currentMonth = monthUtils.currentMonth();
      const earliestMonth = earliestTrans
        ? monthUtils.monthFromDate(earliestTrans.date)
        : currentMonth;

      setAllMonths(
        monthUtils
          .rangeInclusive(earliestMonth, currentMonth)
          .map(month => ({
            name: month,
            pretty: monthUtils.format(month, 'MMMM, yyyy', locale),
          }))
          .reverse(),
      );
    }
    void run();
  }, [locale]);

  function onChangeDates(
    newStart: string,
    newEnd: string,
    newMode: TimeFrame['mode'],
  ) {
    setStart(newStart);
    setEnd(newEnd);
    setMode(newMode);
  }

  const updateDashboardWidgetMutation = useUpdateDashboardWidgetMutation();

  async function onSaveWidget() {
    if (!widget) {
      throw new Error('No widget that could be saved.');
    }

    await updateDashboardWidgetMutation.mutateAsync({
      widget: {
        id: widget.id,
        meta: {
          ...(widget.meta ?? {}),
          timeFrame: { start, end, mode },
          comparison,
        },
      },
    });
    dispatch(
      addNotification({
        notification: {
          type: 'message',
          message: t('Dashboard widget successfully saved.'),
        },
      }),
    );
  }

  const title = widget?.meta?.name || t('Personal Inflation');

  async function onSaveWidgetName(newName: string) {
    if (!widget) {
      throw new Error('No widget that could be saved.');
    }

    await updateDashboardWidgetMutation.mutateAsync({
      widget: {
        id: widget.id,
        meta: {
          ...(widget.meta ?? {}),
          name: newName || t('Personal Inflation'),
        },
      },
    });
  }

  if (!allMonths || !data) {
    return <LoadingIndicator />;
  }

  const { summary } = data;

  return (
    <Page
      header={
        isNarrowWidth ? (
          <MobilePageHeader
            title={title}
            leftContent={
              <MobileBackButton onPress={() => navigate('/reports')} />
            }
          />
        ) : (
          <PageHeader
            title={
              widget ? (
                <EditablePageHeaderTitle
                  title={title}
                  onSave={onSaveWidgetName}
                />
              ) : (
                title
              )
            }
          />
        )
      }
      padding={0}
    >
      <Header
        allMonths={allMonths}
        start={start}
        end={end}
        earliestTransaction={earliestTransaction}
        latestTransaction={latestTransaction}
        firstDayOfWeekIdx={firstDayOfWeekIdx}
        show1Month
        mode={mode}
        onChangeDates={onChangeDates}
        inlineContent={
          <PersonalInflationComparisonSelector
            comparison={comparison}
            onChange={setComparison}
          />
        }
      >
        {widget && (
          <Button variant="primary" onPress={onSaveWidget}>
            <Trans>Save widget</Trans>
          </Button>
        )}
      </Header>

      <View
        style={{
          backgroundColor: theme.tableBackground,
          padding: 20,
          paddingTop: 0,
          flex: '1 0 auto',
          overflowY: 'auto',
        }}
      >
        <View style={{ textAlign: 'right', paddingTop: 20 }}>
          <View
            style={{
              ...styles.largeText,
              ...styles.tnum,
              fontWeight: 400,
              marginBottom: 5,
              color: getRateColor(summary.rate),
            }}
          >
            <PrivacyFilter>
              {summary.hasInsufficientHistory
                ? t('Insufficient history')
                : summary.rate === null
                  ? t('N/A')
                  : formatRate(summary.rate, language)}
            </PrivacyFilter>
          </View>
          <View style={{ color: theme.pageTextSubdued }}>
            {t('{{current}} compared with {{prior}}', {
              current: formatPeriod(summary.current, locale),
              prior: formatPeriod(summary.prior, locale),
            })}
          </View>
          {summary.hasInsufficientHistory ? (
            <View
              style={{
                color: theme.warningText,
                fontSize: 'var(--font-size-12)',
                marginTop: 5,
              }}
            >
              <Trans>
                Your budget history doesn't go back to the start of the
                comparison period, so there isn't enough data to compare. Try a
                more recent date range or a different comparison.
              </Trans>
            </View>
          ) : (
            <FinancialText
              as={View}
              style={{ color: theme.pageTextSubdued, marginTop: 5 }}
            >
              <PrivacyFilter>
                {t('Spent {{prior}} before, {{current}} now', {
                  prior: format(summary.priorTotal, 'financial'),
                  current: format(summary.currentTotal, 'financial'),
                })}
              </PrivacyFilter>
            </FinancialText>
          )}
          {summary.isPartial && (
            <View
              style={{
                color: theme.warningText,
                fontSize: 'var(--font-size-12)',
                marginTop: 5,
              }}
            >
              <Trans>
                Note: this period includes the current month, which isn't over
                yet, so spending may look lower than it will end up.
              </Trans>
            </View>
          )}
        </View>

        <PersonalInflationGraph data={data.trend} />
        <View
          style={{
            color: theme.pageTextSubdued,
            fontSize: 'var(--font-size-12)',
            textAlign: 'center',
          }}
        >
          {t(
            'Rate for the same length of period, ending in each of the last {{count}} months',
            { count: TREND_MONTHS },
          )}
        </View>

        <View style={{ marginTop: 30 }}>
          <PersonalInflationCategoryTable
            byComparison={data.byComparison}
            comparison={comparison}
          />
        </View>

        <View style={{ marginTop: 30, userSelect: 'none' }}>
          <Paragraph>
            <strong>
              <Trans>What is personal inflation?</Trans>
            </strong>
          </Paragraph>
          <Paragraph>
            <Trans>
              Personal inflation shows how much more, or less, you are spending
              compared with an earlier period. Unlike a national inflation
              figure, it is based on your own spending: categories that make up
              a bigger share of what you spend count for more.
            </Trans>
          </Paragraph>
          <Paragraph>
            <strong>
              <Trans>How is it calculated?</Trans>
            </strong>
          </Paragraph>
          <Paragraph>
            <Trans>
              Each expense category's change is weighted by its share of your
              spending in the earlier period, and the weighted changes are added
              up. For example, if groceries were 20% of your spending and rose
              by 12%, they add 2.4% to your personal inflation. Categories you
              didn't spend on before are shown as new and aren't counted. Income
              and hidden categories, and off-budget accounts, are left out.
            </Trans>
          </Paragraph>
        </View>
      </View>
    </Page>
  );
}
