import React, { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type { GoalCardWidget } from '@actual-app/core/types/models';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { DateRange } from '#components/reports/DateRange';
import {
  GoalProgress,
  isValidGoalTarget,
} from '#components/reports/GoalProgress';
import { GoalSettingsEditor } from '#components/reports/GoalSettingsEditor';
import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { calculateTimeRange } from '#components/reports/reportRanges';
import { useGoalTotal } from '#components/reports/useGoalTotal';
import { useContextMenu } from '#hooks/useContextMenu';
import { useFormat } from '#hooks/useFormat';
import { useTagCSS } from '#hooks/useTagCSS';
import { addNotification } from '#notifications/notificationsSlice';
import { useDispatch } from '#redux';

type GoalCardProps = {
  widgetId: string;
  isEditing?: boolean;
  meta?: GoalCardWidget['meta'];
  onMetaChange: (newMeta: GoalCardWidget['meta']) => void;
};

export function GoalCard({
  widgetId,
  isEditing,
  meta = {},
  onMetaChange,
}: GoalCardProps) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const format = useFormat();
  const getTagCSS = useTagCSS();
  const [latestTransaction, setLatestTransaction] = useState<string>('');

  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isSettingGoal, setIsSettingGoal] = useState(false);

  const contextMenuTriggerRef = useRef(null);
  useContextMenu({
    triggerRef: contextMenuTriggerRef,
    enabled: !isSettingGoal,
    items: [
      {
        name: 'set-goal',
        text: t('Set goal'),
        onClick: () => setIsSettingGoal(true),
      },
    ],
  });

  useEffect(() => {
    async function fetchLatestTransaction() {
      const latestTrans = await send('get-latest-transaction');
      setLatestTransaction(
        latestTrans ? latestTrans.date : monthUtils.currentDay(),
      );
    }
    void fetchLatestTransaction();
  }, []);

  const [start, end] = calculateTimeRange(
    meta?.timeFrame,
    {
      start: monthUtils.dayFromDate(monthUtils.currentMonth()),
      end: monthUtils.currentDay(),
      mode: 'full',
    },
    latestTransaction,
  );

  const targetAmount = meta?.targetAmount ?? 0;
  const linkedTag = meta?.linkedTag;

  const currentAmount = useGoalTotal({
    start,
    end,
    conditions: meta?.conditions,
    conditionsOp: meta?.conditionsOp,
    linkedTag,
  });

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen || isSettingGoal}
      to={`/reports/goal/${widgetId}`}
      onRename={() => setNameMenuOpen(true)}
      contextMenuTriggerRef={contextMenuTriggerRef}
    >
      <View
        style={{ flex: 1 }}
        onPointerEnter={() => setIsCardHovered(true)}
        onPointerLeave={() => setIsCardHovered(false)}
      >
        <View style={{ flexDirection: 'row', padding: 20 }}>
          <View style={{ flex: 1 }}>
            <ReportCardName
              name={meta?.name || t('Personal goal')}
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
            {linkedTag ? (
              <View style={{ flexDirection: 'row' }}>
                <span className={getTagCSS(linkedTag)}>#{linkedTag}</span>
              </View>
            ) : (
              <Block
                style={{ color: theme.pageTextSubdued, fontStyle: 'italic' }}
              >
                <Trans>Link a tag to track progress.</Trans>
              </Block>
            )}
          </View>
          <View style={{ textAlign: 'right' }}>
            <Block
              style={{
                ...styles.mediumText,
                fontWeight: 500,
                marginBottom: 5,
              }}
            >
              <PrivacyFilter activationFilters={[!isCardHovered]}>
                <FinancialText>
                  {format(currentAmount, 'financial')}
                </FinancialText>
              </PrivacyFilter>
            </Block>
            <Block style={{ color: theme.pageTextSubdued }}>
              <PrivacyFilter activationFilters={[!isCardHovered]}>
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
        </View>

        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            paddingLeft: 20,
            paddingRight: 20,
            paddingBottom: 20,
          }}
        >
          {isSettingGoal ? (
            <GoalSettingsEditor
              idPrefix={`goal-${widgetId}`}
              initialSettings={{ targetAmount, linkedTag }}
              onSave={settings => {
                if (!isValidGoalTarget(settings.targetAmount)) {
                  dispatch(
                    addNotification({
                      notification: {
                        type: 'error',
                        message: t('Goal amount must be greater than zero.'),
                      },
                    }),
                  );
                  return;
                }

                const { linkedTag: _previousTag, ...rest } = meta ?? {};
                onMetaChange({
                  ...rest,
                  targetAmount: settings.targetAmount,
                  ...(settings.linkedTag
                    ? { linkedTag: settings.linkedTag }
                    : {}),
                });
                setIsSettingGoal(false);
              }}
              onCancel={() => setIsSettingGoal(false)}
            />
          ) : (
            <GoalProgress
              currentAmount={currentAmount}
              targetAmount={targetAmount}
            />
          )}
        </View>
      </View>
    </ReportCard>
  );
}
