import React from 'react';
import type { CSSProperties } from 'react';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';

export function Change({
  amount,
  percent,
  style,
}: {
  amount: number;
  // Omit to hide the percentage; null renders a placeholder
  percent?: number | null;
  style?: CSSProperties;
}) {
  const format = useFormat();

  let percentText = '';
  if (percent === null) {
    percentText = ' (--)';
  } else if (percent !== undefined) {
    percentText = ` (${percent > 0 ? '+' : ''}${percent.toFixed(1)}%)`;
  }

  return (
    <FinancialText
      as={Block}
      style={{
        ...styles.smallText,
        color:
          amount === 0
            ? theme.reportsNumberNeutral
            : amount < 0
              ? theme.reportsNumberNegative
              : theme.reportsNumberPositive,
        ...style,
      }}
    >
      {format(amount, 'financial-with-sign')}
      {percentText}
    </FinancialText>
  );
}
