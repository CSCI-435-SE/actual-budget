import React, { useMemo, useState } from 'react';
import { Form } from 'react-aria-components';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { View } from '@actual-app/components/view';
import type { IntegerAmount } from '@actual-app/core/shared/util';
import type { CategoryEntity } from '@actual-app/core/types/models';

import { CategoryAutocomplete } from '#components/autocomplete/CategoryAutocomplete';
import {
  addToBeBudgetedGroup,
  removeCategoriesFromGroups,
} from '#components/budget/util';
import { FinancialInput } from '#components/util/FinancialInput';
import { useCategories } from '#hooks/useCategories';

type CoverMenuProps = {
  showToBeBudgeted?: boolean;
  initialAmount?: IntegerAmount | null;
  categoryId?: CategoryEntity['id'];
  onSubmit: (amount: IntegerAmount, categoryId: CategoryEntity['id']) => void;
  onClose: () => void;
};

export function CoverMenu({
  showToBeBudgeted = true,
  initialAmount = 0,
  categoryId,
  onSubmit,
  onClose,
}: CoverMenuProps) {
  const { t } = useTranslation();

  const { data: { grouped: originalCategoryGroups } = { grouped: [] } } =
    useCategories();

  const [fromCategoryId, setFromCategoryId] = useState<string | null>(null);

  const filteredCategoryGroups = useMemo(() => {
    const expenseGroups = originalCategoryGroups.filter(g => !g.is_income);
    const categoryGroups = showToBeBudgeted
      ? addToBeBudgetedGroup(expenseGroups)
      : expenseGroups;
    return categoryId
      ? removeCategoriesFromGroups(categoryGroups, categoryId)
      : categoryGroups;
  }, [categoryId, showToBeBudgeted, originalCategoryGroups]);

  const [amount, setAmount] = useState<IntegerAmount>(
    Math.abs(initialAmount ?? 0),
  );

  function _onSubmit() {
    if (amount && fromCategoryId) {
      onSubmit(amount, fromCategoryId);
    }
    onClose();
  }

  return (
    <Form
      onSubmit={e => {
        e.preventDefault();
        _onSubmit();
      }}
    >
      <View style={{ padding: 10 }}>
        <View style={{ marginBottom: 5 }}>
          <Trans>Cover this amount:</Trans>
        </View>
        <View>
          <FinancialInput
            value={amount}
            onUpdate={setAmount}
            onChangeValue={setAmount}
          />
        </View>
        <View style={{ margin: '10px 0 5px 0' }}>
          <Trans>From:</Trans>
        </View>

        <CategoryAutocomplete
          categoryGroups={filteredCategoryGroups}
          value={null}
          focused
          openOnFocus
          onSelect={(id: string | undefined) => setFromCategoryId(id || null)}
          inputProps={{
            placeholder: t('(none)'),
          }}
          showHiddenCategories={false}
        />

        <View
          style={{
            alignItems: 'flex-end',
            marginTop: 10,
          }}
        >
          <Button
            type="submit"
            variant="primary"
            style={{
              fontSize: 12,
              paddingTop: 3,
            }}
          >
            <Trans>Transfer</Trans>
          </Button>
        </View>
      </View>
    </Form>
  );
}
