import { useMemo } from 'react';

import { format as monthUtilFormat } from '@actual-app/core/shared/months';
import { getNormalisedString } from '@actual-app/core/shared/normalisation';
import { getScheduledAmount } from '@actual-app/core/shared/schedules';
import type { ScheduleStatuses } from '@actual-app/core/shared/schedules';
import type { ScheduleEntity } from '@actual-app/core/types/models';

import { useAccounts } from '#hooks/useAccounts';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { usePayees } from '#hooks/usePayees';

type UseFilteredSchedulesProps = {
  schedules: readonly ScheduleEntity[];
  filter: string;
  statuses: ScheduleStatuses;
};

export function useFilteredSchedules({
  schedules,
  filter,
  statuses,
}: UseFilteredSchedulesProps): readonly ScheduleEntity[] {
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const { data: payees = [] } = usePayees();
  const { data: accounts = [] } = useAccounts();

  return useMemo(() => {
    if (!filter) {
      return schedules;
    }
    const filterIncludes = (str: string | null | undefined) =>
      str
        ? getNormalisedString(str).includes(getNormalisedString(filter)) ||
          getNormalisedString(filter).includes(getNormalisedString(str))
        : false;

    return schedules.filter(schedule => {
      const payee = payees.find(p => schedule._payee === p.id);
      const account = accounts.find(a => schedule._account === a.id);
      const amount = getScheduledAmount(schedule._amount);
      let amountStr = '';
      if (schedule._amountOp === 'isbetween') {
        amountStr = '±';
      } else if (schedule._amountOp === 'isapprox') {
        amountStr = '~';
      }
      amountStr +=
        (amount > 0 ? '+' : '') + format(Math.abs(amount || 0), 'financial');
      const dateStr = schedule.next_date
        ? monthUtilFormat(schedule.next_date, dateFormat)
        : null;

      return (
        filterIncludes(schedule.name) ||
        filterIncludes(payee && payee.name) ||
        filterIncludes(account && account.name) ||
        filterIncludes(amountStr) ||
        filterIncludes(statuses.get(schedule.id)) ||
        filterIncludes(dateStr)
      );
    });
  }, [payees, accounts, schedules, filter, statuses, format, dateFormat]);
}
