import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Block } from '@actual-app/components/block';
import { Button } from '@actual-app/components/button';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { GoalCardWidget, TimeFrame } from '@actual-app/core/types/models';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { EditablePageHeaderTitle } from '#components/EditablePageHeaderTitle';
import { FinancialText } from '#components/FinancialText';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page, PageHeader } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { DateRange } from '#components/reports/DateRange';
import { GoalProgress } from '#components/reports/GoalProgress';
import { GoalTagSelect } from '#components/reports/GoalTagSelect';
import { GoalTransactions } from '#components/reports/GoalTransactions';
import { Header } from '#components/reports/Header';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { calculateTimeRange } from '#components/reports/reportRanges';
import { useGoalTotal } from '#components/reports/useGoalTotal';
import { AmountInput } from '#components/util/AmountInput';
import { useDashboardWidget } from '#hooks/useDashboardWidget';
import { useFormat } from '#hooks/useFormat';
import { useLocale } from '#hooks/useLocale';
import { useNavigate } from '#hooks/useNavigate';
import { useRuleConditionFilters } from '#hooks/useRuleConditionFilters';
import { useSyncedPref } from '#hooks/useSyncedPref';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';
import { useUpdateDashboardWidgetMutation } from '#reports/mutations';

export function GoalReport() {
  const params = useParams();
  const { data: widget, isLoading } = useDashboardWidget<GoalCardWidget>({
    id: params.id,
    type: 'goal-card',
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return <GoalReportInner widget={widget} />;
}

type GoalReportInnerProps = {
  widget?: GoalCardWidget;
};

function GoalReportInner({ widget }: GoalReportInnerProps) {
  const { t } = useTranslation();
  const locale = useLocale();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const format = useFormat();
  const { isNarrowWidth } = useResponsive();

  const [start, setStart] = useState(
    monthUtils.dayFromDate(monthUtils.currentMonth()),
  );
  const [end, setEnd] = useState(monthUtils.currentDay());
  const [mode, setMode] = useState<TimeFrame['mode']>('full');
  const [targetAmount, setTargetAmount] = useState(
    widget?.meta?.targetAmount ?? 0,
  );
  const [linkedTag, setLinkedTag] = useState(widget?.meta?.linkedTag);
  const [earliestTransaction, setEarliestTransaction] = useState('');
  const [latestTransaction, setLatestTransaction] = useState('');
  const [allMonths, setAllMonths] = useState<
    Array<{ name: string; pretty: string }>
  >([]);

  const [_firstDayOfWeekIdx] = useSyncedPref('firstDayOfWeekIdx');
  const firstDayOfWeekIdx = _firstDayOfWeekIdx || '0';

  const {
    conditions,
    conditionsOp,
    onApply: onApplyFilter,
    onDelete: onDeleteFilter,
    onUpdate: onUpdateFilter,
    onConditionsOpChange,
  } = useRuleConditionFilters(
    widget?.meta?.conditions,
    widget?.meta?.conditionsOp,
  );

  // The date picker needs the range of months that have transactions.
  useEffect(() => {
    async function run() {
      const earliest = await send('get-earliest-transaction');
      const latest = await send('get-latest-transaction');
      const earliestDay = earliest ? earliest.date : monthUtils.currentDay();
      const latestDay = latest ? latest.date : monthUtils.currentDay();
      setEarliestTransaction(earliestDay);
      setLatestTransaction(latestDay);

      const currentMonth = monthUtils.currentMonth();
      const latestTransactionMonth = monthUtils.monthFromDate(latestDay);
      const latestMonth =
        latestTransactionMonth > currentMonth
          ? latestTransactionMonth
          : currentMonth;
      // Show at least a year's worth of months in the selects.
      const yearAgo = monthUtils.subMonths(latestMonth, 12);
      const earliestMonth = monthUtils.monthFromDate(earliestDay);

      setAllMonths(
        monthUtils
          .rangeInclusive(
            earliestMonth < yearAgo ? earliestMonth : yearAgo,
            latestMonth,
          )
          .map(month => ({
            name: month,
            pretty: monthUtils.format(month, 'MMMM yyyy', locale),
          }))
          .reverse(),
      );
    }
    void run();
  }, [locale]);

  useEffect(() => {
    if (latestTransaction) {
      const [initialStart, initialEnd, initialMode] = calculateTimeRange(
        widget?.meta?.timeFrame,
        {
          start: monthUtils.dayFromDate(monthUtils.currentMonth()),
          end: monthUtils.currentDay(),
          mode: 'full',
        },
        latestTransaction,
      );
      setStart(initialStart);
      setEnd(initialEnd);
      setMode(initialMode);
    }
  }, [latestTransaction, widget?.meta?.timeFrame]);

  const updateDashboardWidgetMutation = useUpdateDashboardWidgetMutation();

  const title = widget?.meta?.name || t('Personal goal');
  // Uses the unsaved editor state so the report previews changes before the
  // widget is saved.
  const currentAmount = useGoalTotal({
    start,
    end,
    conditions,
    conditionsOp,
    linkedTag,
  });

  function notifyMissingWidget() {
    dispatch(
      addNotification({
        notification: {
          type: 'error',
          message: t('Cannot save: No widget available.'),
        },
      }),
    );
  }

  const onSaveWidgetName = async (newName: string) => {
    if (!widget) {
      notifyMissingWidget();
      return;
    }

    const name = newName || t('Personal goal');
    updateDashboardWidgetMutation.mutate({
      widget: {
        id: widget.id,
        meta: {
          ...(widget.meta ?? {}),
          name,
        },
      },
    });
  };

  function onSaveWidget() {
    if (!widget) {
      notifyMissingWidget();
      return;
    }

    const { linkedTag: _previousTag, ...previousMeta } = widget.meta ?? {};
    updateDashboardWidgetMutation.mutate(
      {
        widget: {
          id: widget.id,
          meta: {
            ...previousMeta,
            ...(linkedTag ? { linkedTag } : {}),
            conditions,
            targetAmount,
            conditionsOp,
            timeFrame: { start, end, mode },
          },
        },
      },
      {
        onSuccess: () => {
          dispatch(
            addNotification({
              notification: {
                type: 'message',
                message: t('Dashboard widget successfully saved.'),
              },
            }),
          );
        },
      },
    );
  }

  function onChangeDates(
    newStart: string,
    newEnd: string,
    newMode: TimeFrame['mode'],
  ) {
    setStart(newStart);
    setEnd(newEnd);
    setMode(newMode);
  }

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
        mode={mode}
        onChangeDates={onChangeDates}
        filters={conditions}
        onApply={onApplyFilter}
        onUpdateFilter={onUpdateFilter}
        onDeleteFilter={onDeleteFilter}
        conditionsOp={conditionsOp}
        onConditionsOpChange={onConditionsOpChange}
        show1Month
      >
        {widget && (
          <Button variant="primary" onPress={onSaveWidget}>
            <Trans>Save widget</Trans>
          </Button>
        )}
      </Header>

      <View
        style={{
          flex: 1,
          padding: 20,
          paddingTop: 0,
          gap: 20,
          backgroundColor: theme.pageBackground,
        }}
      >
        <View
          style={{
            flexDirection: isNarrowWidth ? 'column' : 'row',
            alignItems: isNarrowWidth ? 'stretch' : 'flex-end',
            gap: 20,
          }}
        >
          <View style={{ flex: 1 }}>
            <Block
              style={{ ...styles.largeText, fontWeight: 500, marginBottom: 5 }}
            >
              <PrivacyFilter>
                <FinancialText>
                  {format(currentAmount, 'financial')}
                </FinancialText>
              </PrivacyFilter>
            </Block>
            <Block style={{ color: theme.pageTextSubdued }}>
              <PrivacyFilter>
                <Trans>
                  of{' '}
                  <FinancialText>
                    {
                      {
                        targetAmount: format(targetAmount, 'financial'),
                      } as TransObjectLiteral
                    }
                  </FinancialText>
                </Trans>
              </PrivacyFilter>
            </Block>
          </View>
          <View>
            <label
              htmlFor="goal-target-amount"
              style={{
                fontSize: 13,
                color: theme.pageTextSubdued,
                marginBottom: 5,
              }}
            >
              <Trans>Goal amount</Trans>
            </label>
            <AmountInput
              id="goal-target-amount"
              value={targetAmount}
              sign="+"
              onUpdate={setTargetAmount}
              style={{ width: 180 }}
            />
          </View>
          <View>
            <label
              htmlFor="goal-linked-tag"
              style={{
                fontSize: 13,
                color: theme.pageTextSubdued,
                marginBottom: 5,
              }}
            >
              <Trans>Linked tag</Trans>
            </label>
            <GoalTagSelect
              id="goal-linked-tag"
              value={linkedTag}
              onChange={setLinkedTag}
              style={{ minWidth: 180 }}
            />
          </View>
        </View>

        <GoalProgress
          currentAmount={currentAmount}
          targetAmount={targetAmount}
          size="large"
        />

        <View
          style={{
            flex: 1,
            minHeight: 300,
            padding: 20,
            borderRadius: 4,
            backgroundColor: theme.tableBackground,
            gap: 10,
          }}
        >
          <Block style={{ ...styles.mediumText, fontWeight: 500 }}>
            <Trans>Matching transactions</Trans>
          </Block>
          <DateRange start={start} end={end} />
          {linkedTag ? (
            <>
              <Block style={{ color: theme.pageTextSubdued }}>
                <Trans>
                  Transactions tagged{' '}
                  {{ tag: `#${linkedTag}` } as TransObjectLiteral} that count
                  toward this goal.
                </Trans>
              </Block>
              <GoalTransactions
                start={start}
                end={end}
                conditions={conditions}
                conditionsOp={conditionsOp}
                linkedTag={linkedTag}
              />
            </>
          ) : (
            <Block
              style={{ color: theme.pageTextSubdued, fontStyle: 'italic' }}
            >
              <Trans>
                Link a tag to this goal to choose which transactions count
                toward it.
              </Trans>
            </Block>
          )}
        </View>
      </View>
    </Page>
  );
}
