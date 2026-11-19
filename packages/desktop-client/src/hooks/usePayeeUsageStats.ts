import { useQuery } from '@tanstack/react-query';

import { payeeQueries } from '#payees';

export function usePayeeUsageStats() {
  return useQuery(payeeQueries.usageStats());
}
