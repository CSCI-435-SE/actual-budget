import React, { useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Block } from '@actual-app/components/block';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { GoalCardWidget } from '@actual-app/core/types/models';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { FinancialText } from '#components/FinancialText';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { ReportCard } from '#components/reports/ReportCard';
import { ReportCardName } from '#components/reports/ReportCardName';
import { useFormat } from '#hooks/useFormat';

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
  const format = useFormat();

  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);

  const currentAmount = meta?.currentAmount ?? 0;
  const targetAmount = meta?.targetAmount ?? 0;
  const progress =
    targetAmount > 0
      ? Math.min(Math.max(currentAmount / targetAmount, 0), 1)
      : 0;
  const progressPercent = Math.round(progress * 100);

  return (
    <ReportCard
      widgetId={widgetId}
      isEditing={isEditing}
      disableClick={nameMenuOpen}
      to={`/reports/goal/${widgetId}`}
      onRename={() => setNameMenuOpen(true)}
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
          <View
            aria-hidden
            style={{
              height: 12,
              borderRadius: 6,
              backgroundColor: theme.pillBackground,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                backgroundColor: theme.reportsGreen,
              }}
            />
          </View>
          <Block
            style={{
              ...styles.tnum,
              marginTop: 5,
              textAlign: 'right',
              color: theme.pageTextSubdued,
            }}
          >
            {progressPercent}%
          </Block>
        </View>
      </View>
    </ReportCard>
  );
}
