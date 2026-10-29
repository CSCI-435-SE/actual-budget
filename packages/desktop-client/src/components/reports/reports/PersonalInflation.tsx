import { useParams } from 'react-router';

import type { PersonalInflationWidget } from '@actual-app/core/types/models';

import { LoadingIndicator } from '#components/reports/LoadingIndicator';
import { useDashboardWidget } from '#hooks/useDashboardWidget';

import { PersonalInflationReport } from './PersonalInflationReport';

export function PersonalInflation() {
  const params = useParams();
  const { data: widget, isLoading } =
    useDashboardWidget<PersonalInflationWidget>({
      id: params.id,
      type: 'personal-inflation-card',
    });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return <PersonalInflationReport widget={widget} />;
}
