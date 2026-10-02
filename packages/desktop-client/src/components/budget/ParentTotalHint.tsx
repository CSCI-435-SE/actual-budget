import { Trans, useTranslation } from 'react-i18next';

import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { FinancialText } from '#components/FinancialText';
import { useFormat } from '#hooks/useFormat';

type ParentTotalHintProps = {
  /** The category's own budget, the part not given to subcategories. */
  budgeted: number;
  /** Own budget plus everything its subcategories hold. */
  total: number;
};

// Shown next to a parent category's budget when its subcategories hold
// money, so the parent's full amount is still visible. Categories without
// subcategories always have total === budgeted, so they show nothing.
export function ParentTotalHint({ budgeted, total }: ParentTotalHintProps) {
  const { t } = useTranslation();
  const format = useFormat();

  if (total === budgeted) {
    return null;
  }

  const amount = format(total, 'financial');

  return (
    <Tooltip
      content={
        <Trans>
          Total with subcategories:{' '}
          <FinancialText>{{ amount } as TransObjectLiteral}</FinancialText>
        </Trans>
      }
      placement="bottom"
    >
      <View
        aria-label={t('Total with subcategories: {{amount}}', { amount })}
        data-testid="parent-total-hint"
        style={{
          justifyContent: 'center',
          paddingLeft: 3,
          borderTopWidth: 1,
          borderBottomWidth: 1,
          borderColor: theme.tableBorder,
        }}
      >
        <Text style={{ color: theme.pageTextLight, fontSize: 11 }}>Σ</Text>
      </View>
    </Tooltip>
  );
}
