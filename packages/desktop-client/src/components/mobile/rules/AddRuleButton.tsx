import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgAdd } from '@actual-app/components/icons/v1';

import { useNavigate } from '#hooks/useNavigate';

export function AddRuleButton() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleAddRule = useCallback(() => {
    void navigate('/rules/new');
  }, [navigate]);

  return (
    <Button
      variant="bare"
      aria-label={t('Add new rule')}
      style={{ margin: 10 }}
      onPress={handleAddRule}
    >
      <SvgAdd style={{ width: 'var(--icon-size-20)', height: 'var(--icon-size-20)' }}  />
    </Button>
  );
}
