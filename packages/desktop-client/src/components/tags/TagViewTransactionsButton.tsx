import React from 'react';
import { Trans } from 'react-i18next';

import { SvgArrowThinRight } from '@actual-app/components/icons/v1';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';

import { CellButton } from '#components/table';

type TagViewTransactionsButtonProps = {
  dimmed?: boolean;
  // Omitted for the header's invisible spacer copy
  onSelect?: () => void;
};

// Rendered in each tag row, and invisibly in the header so the header's
// columns stay aligned with the rows whatever the button's translated width
export function TagViewTransactionsButton({
  dimmed,
  onSelect,
}: TagViewTransactionsButtonProps) {
  return (
    <CellButton
      style={{
        borderRadius: 4,
        padding: '3px 6px',
        backgroundColor: theme.noticeBackground,
        border: '1px solid ' + theme.noticeBackground,
        color: theme.noticeTextDark,
        fontSize: 'var(--font-size-12)',
        cursor: 'pointer',
        opacity: dimmed ? 0.5 : undefined,
        ':hover': { backgroundColor: theme.noticeBackgroundLight },
      }}
      onSelect={onSelect}
    >
      <Text style={{ paddingRight: 5 }}>
        <Trans>View Transactions</Trans>
      </Text>
      <SvgArrowThinRight style={{ width: 8, height: 8 }} />
    </CellButton>
  );
}
