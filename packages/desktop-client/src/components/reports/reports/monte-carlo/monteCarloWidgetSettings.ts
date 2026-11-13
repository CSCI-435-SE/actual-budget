import type { MonteCarloWidget } from '@actual-app/core/types/models';

import { monteCarloConfigFromMeta } from './monteCarloSimulation';
import type { MonteCarloConfig } from './monteCarloSimulation';

type MonteCarloMeta = NonNullable<MonteCarloWidget['meta']>;

/**
 * The Monte Carlo settings in comparable form: read the same way the report
 * reads a saved widget, so missing fields compare equal to their defaults.
 *
 * A pot linked to an account takes its starting balance from the account's
 * live balance, and saving stores that balance only as a fallback. It is a
 * computed value, not a user input, so it is left out: otherwise the label
 * would appear whenever the account balance moves.
 */
export function toComparableMonteCarloSettings(
  meta: Partial<MonteCarloMeta> | MonteCarloConfig | null | undefined,
) {
  const config = monteCarloConfigFromMeta(meta ?? undefined);
  return {
    ...config,
    pots: config.pots.map(pot => {
      if (pot.accountId == null) {
        return pot;
      }
      const { startingBalance: _computed, ...inputs } = pot;
      return inputs;
    }),
  };
}
