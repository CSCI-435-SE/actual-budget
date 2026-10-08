import { useState } from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { NON_DRAGGABLE_AREA_CLASS_NAME } from '#components/reports/constants';
import { GoalTagSelect } from '#components/reports/GoalTagSelect';
import { AmountInput } from '#components/util/AmountInput';

type GoalSettings = {
  targetAmount: number;
  linkedTag?: string;
};

type GoalSettingsEditorProps = {
  idPrefix: string;
  initialSettings: GoalSettings;
  onSave: (settings: GoalSettings) => void;
  onCancel: () => void;
};

export function GoalSettingsEditor({
  idPrefix,
  initialSettings,
  onSave,
  onCancel,
}: GoalSettingsEditorProps) {
  const [targetAmount, setTargetAmount] = useState(
    initialSettings.targetAmount,
  );
  const [linkedTag, setLinkedTag] = useState(initialSettings.linkedTag);

  const amountId = `${idPrefix}-amount`;
  const tagId = `${idPrefix}-tag`;
  const labelStyle = { color: theme.pageTextSubdued, marginBottom: 3 };

  return (
    <View
      className={NON_DRAGGABLE_AREA_CLASS_NAME}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-end',
        gap: 10,
      }}
    >
      <View>
        <label htmlFor={amountId} style={labelStyle}>
          <Trans>Goal amount</Trans>
        </label>
        <AmountInput
          id={amountId}
          value={targetAmount}
          sign="+"
          focused
          style={{ width: 140 }}
          onUpdate={setTargetAmount}
          onEnter={(_, amount) =>
            onSave({ targetAmount: amount ?? targetAmount, linkedTag })
          }
        />
      </View>
      <View>
        <label htmlFor={tagId} style={labelStyle}>
          <Trans>Linked tag</Trans>
        </label>
        <GoalTagSelect
          id={tagId}
          value={linkedTag}
          onChange={setLinkedTag}
          style={{ minWidth: 120 }}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 5 }}>
        <Button onPress={onCancel}>
          <Trans>Cancel</Trans>
        </Button>
        <Button
          variant="primary"
          onPress={() => onSave({ targetAmount, linkedTag })}
        >
          <Trans>Save</Trans>
        </Button>
      </View>
    </View>
  );
}
