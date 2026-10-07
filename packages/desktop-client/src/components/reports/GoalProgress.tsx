import React from 'react';
import { Trans } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { css } from '@emotion/css';

type GoalProgressProps = {
  currentAmount: number;
  targetAmount: number;
  size?: 'small' | 'large';
};

/**
 * Progress bar for a goal. Yellow while the goal is in progress, green with a
 * congratulations message once the target is reached.
 */
export function GoalProgress({
  currentAmount,
  targetAmount,
  size = 'small',
}: GoalProgressProps) {
  const { percent, barPercent, isComplete } = getGoalProgress(
    currentAmount,
    targetAmount,
  );
  const barHeight = size === 'large' ? 16 : 12;

  return (
    <View>
      <View
        aria-hidden
        style={{
          height: barHeight,
          borderRadius: barHeight / 2,
          backgroundColor: theme.pillBackground,
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${barPercent}%`,
            height: '100%',
            backgroundColor: isComplete
              ? theme.reportsGreen
              : theme.warningBorder,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 10,
          marginTop: 5,
        }}
      >
        {/* Always rendered so screen readers announce the message when the
            goal becomes complete. */}
        <output
          className={css({
            ...(size === 'large' ? styles.mediumText : styles.smallText),
            fontWeight: 500,
            color: theme.reportsGreen,
          })}
        >
          {isComplete && <Trans>Congratulations! You reached your goal.</Trans>}
        </output>
        <Block
          style={{
            ...styles.tnum,
            marginLeft: 'auto',
            color: theme.pageTextSubdued,
          }}
        >
          {percent}%
        </Block>
      </View>
    </View>
  );
}

/**
 * Whole-number percent toward the goal. `percent` keeps counting past 100 once
 * the goal is exceeded, while `barPercent` is the bar width, capped at 100.
 * The goal only counts as complete once the target is actually reached, so an
 * in-progress goal never rounds up to 100%.
 */
export function getGoalProgress(currentAmount: number, targetAmount: number) {
  const isComplete = targetAmount > 0 && currentAmount >= targetAmount;
  const progress =
    targetAmount > 0 ? Math.max(currentAmount / targetAmount, 0) : 0;
  const rounded = Math.round(progress * 100);
  const percent = isComplete ? Math.max(rounded, 100) : Math.min(rounded, 99);
  return { percent, barPercent: Math.min(percent, 100), isComplete };
}
