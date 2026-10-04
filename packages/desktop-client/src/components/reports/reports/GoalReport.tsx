import { Trans, useTranslation } from 'react-i18next';
import { useParams } from 'react-router';

import { Block } from '@actual-app/components/block';
import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { styles } from '@actual-app/components/styles';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import type { GoalCardWidget } from '@actual-app/core/types/models';
import type { TransObjectLiteral } from '@actual-app/core/types/util';

import { EditablePageHeaderTitle } from '#components/EditablePageHeaderTitle';
import { FinancialText } from '#components/FinancialText';
import { MobileBackButton } from '#components/mobile/MobileBackButton';
import { MobilePageHeader, Page, PageHeader } from '#components/Page';
import { PrivacyFilter } from '#components/PrivacyFilter';
import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { useDashboardWidget } from '#hooks/useDashboardWidget';
import { useFormat } from '#hooks/useFormat';
import { useNavigate } from '#hooks/useNavigate';
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
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const format = useFormat();
  const { isNarrowWidth } = useResponsive();

  const title = widget?.meta?.name || t('Personal goal');

  const currentAmount = widget?.meta?.currentAmount ?? 0;
  const targetAmount = widget?.meta?.targetAmount ?? 0;
  const progress =
    targetAmount > 0
      ? Math.min(Math.max(currentAmount / targetAmount, 0), 1)
      : 0;
  const progressPercent = Math.round(progress * 100);

  const updateDashboardWidgetMutation = useUpdateDashboardWidgetMutation();

  const onSaveWidgetName = async (newName: string) => {
    if (!widget) {
      dispatch(
        addNotification({
          notification: {
            type: 'error',
            message: t('Cannot save: No widget available.'),
          },
        }),
      );
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
      <View
        style={{
          flex: 1,
          padding: 20,
          background: theme.pageBackground,
        }}
      >
        <View style={{ marginBottom: 20 }}>
          <Block
            style={{
              ...styles.largeText,
              fontWeight: 500,
              marginBottom: 5,
            }}
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

        <View
          aria-hidden
          style={{
            height: 16,
            borderRadius: 8,
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
    </Page>
  );
}
