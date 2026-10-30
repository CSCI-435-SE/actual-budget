import { useTranslation } from 'react-i18next';

import type { ScheduleEntity } from '@actual-app/core/types/models';

import { SelectedItemsButton } from '#components/table';
import { useSelectedDispatch } from '#hooks/useSelected';

import type { ScheduleItemAction } from './SchedulesTable';

// Restart only applies to completed schedules, which can't be selected
type Actions = Exclude<ScheduleItemAction, 'restart'>;

type SelectedSchedulesButtonProps = {
  onAction: (name: Actions, id: ScheduleEntity['id']) => Promise<void>;
};

export function SelectedSchedulesButton({
  onAction,
}: SelectedSchedulesButtonProps) {
  const { t } = useTranslation();
  const dispatch = useSelectedDispatch();

  async function handleSelect(name: Actions, scheduleIds: string[]) {
    for (const id of scheduleIds) {
      await onAction(name, id);
    }

    // Completed and deleted schedules leave the selectable list
    if (name === 'complete' || name === 'delete') {
      dispatch({ type: 'select-none' });
    }
  }

  return (
    <SelectedItemsButton<Actions>
      id="selected-schedules"
      name={count =>
        count === 1 ? t('1 schedule') : t('{{count}} schedules', { count })
      }
      items={[
        { name: 'post-transaction', text: t('Post transaction') },
        { name: 'post-transaction-today', text: t('Post transaction today') },
        { name: 'skip', text: t('Skip next scheduled date') },
        { name: 'complete', text: t('Complete') },
        { name: 'delete', text: t('Delete') },
      ]}
      onSelect={(name, ids) => void handleSelect(name, ids)}
    />
  );
}
