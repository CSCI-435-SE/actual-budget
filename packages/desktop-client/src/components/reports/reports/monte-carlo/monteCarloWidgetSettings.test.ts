import type { MonteCarloWidget } from '@actual-app/core/types/models';
import { describe, expect, it } from 'vitest';

import { isWidgetModified } from '#components/reports/widgetModified';

import {
  createMonteCarloContribution,
  createMonteCarloPot,
  MONTE_CARLO_DEFAULTS,
  monteCarloConfigFromMeta,
} from './monteCarloSimulation';
import type { MonteCarloConfig } from './monteCarloSimulation';
import { toComparableMonteCarloSettings } from './monteCarloWidgetSettings';

type Meta = NonNullable<MonteCarloWidget['meta']>;

const LINKED_POT = {
  ...createMonteCarloPot('pot-linked'),
  name: 'Brokerage',
  accountId: 'acct-1',
  startingBalance: 10_000_000,
};
const MANUAL_POT = {
  ...createMonteCarloPot('pot-manual'),
  name: 'Pension',
  startingBalance: 20_000_000,
  accessAge: 67,
};

const SAVED_CONFIG: MonteCarloConfig = {
  ...MONTE_CARLO_DEFAULTS,
  pots: [LINKED_POT, MANUAL_POT],
  currentAge: 55,
  targetAge: 95,
  simulationCount: 1000,
};
const SAVED_META: Meta = { name: 'Retirement plan', ...SAVED_CONFIG };

/** The config the report holds after opening a saved widget. */
function opened(meta: Meta | null): MonteCarloConfig {
  return monteCarloConfigFromMeta(meta);
}

function isModified(saved: Meta | null, current: MonteCarloConfig) {
  return isWidgetModified({
    hasWidget: true,
    isReady: true,
    saved: toComparableMonteCarloSettings(saved),
    current: toComparableMonteCarloSettings(current),
  });
}

function withPot(
  config: MonteCarloConfig,
  id: string,
  changes: Partial<MonteCarloConfig['pots'][number]>,
): MonteCarloConfig {
  return {
    ...config,
    pots: config.pots.map(pot =>
      pot.id === id ? { ...pot, ...changes } : pot,
    ),
  };
}

describe('Monte Carlo widget settings', () => {
  it('is not modified when the inputs match the saved widget', () => {
    expect(isModified(SAVED_META, opened(SAVED_META))).toBe(false);
  });

  it('treats a widget without saved inputs as the defaults the report opens with', () => {
    expect(isModified(null, MONTE_CARLO_DEFAULTS)).toBe(false);
    expect(isModified({ name: 'Monte Carlo' }, MONTE_CARLO_DEFAULTS)).toBe(
      false,
    );
  });

  it.each<[string, Partial<MonteCarloConfig>]>([
    ['currentAge', { currentAge: 56 }],
    ['targetAge', { targetAge: 90 }],
    ['simulationCount', { simulationCount: 5000 }],
    ['withdrawalStrategy', { withdrawalStrategy: 'sequential' }],
    ['returnModel', { returnModel: 'historical-bootstrap' }],
    ['inflationMean', { inflationMean: null }],
    ['minimumSpending', { minimumSpending: 100_000 }],
    [
      'contributions',
      { contributions: [createMonteCarloContribution('c-1', 'pot-manual')] },
    ],
    ['taxModel', { taxModel: 'bands' }],
  ])('is modified when %s changes', (_, change) => {
    expect(isModified(SAVED_META, { ...opened(SAVED_META), ...change })).toBe(
      true,
    );
  });

  it('is modified when a pot input changes', () => {
    const current = opened(SAVED_META);
    expect(
      isModified(SAVED_META, withPot(current, 'pot-manual', { accessAge: 60 })),
    ).toBe(true);
    expect(
      isModified(SAVED_META, withPot(current, 'pot-linked', { name: 'ISA' })),
    ).toBe(true);
    expect(
      isModified(
        SAVED_META,
        withPot(current, 'pot-linked', { accountId: 'acct-2' }),
      ),
    ).toBe(true);
  });

  it('is modified when a manual pot balance changes', () => {
    expect(
      isModified(
        SAVED_META,
        withPot(opened(SAVED_META), 'pot-manual', {
          startingBalance: 25_000_000,
        }),
      ),
    ).toBe(true);
  });

  it('ignores the balance of a pot linked to an account', () => {
    // The page swaps in the account's live balance, which can differ from
    // the balance stored when the widget was last saved.
    const withLiveBalance = withPot(opened(SAVED_META), 'pot-linked', {
      startingBalance: 12_345_600,
    });
    expect(isModified(SAVED_META, withLiveBalance)).toBe(false);
  });

  it('is not modified after changing an input back', () => {
    const current = opened(SAVED_META);
    expect(isModified(SAVED_META, { ...current, currentAge: 60 })).toBe(true);
    expect(isModified(SAVED_META, { ...current, currentAge: 55 })).toBe(false);
  });

  describe('when more than one place writes the widget', () => {
    // "Save widget" writes the resolved config over the saved widget, and
    // renaming writes only the name. The label compares against whatever
    // was saved last, whichever write it came from.
    const edited = withPot(
      { ...opened(SAVED_META), simulationCount: 2000 },
      'pot-linked',
      { startingBalance: 11_000_000 },
    );

    it('keeps the label after a rename, which saves only the name', () => {
      expect(isModified(SAVED_META, edited)).toBe(true);

      const afterRename: Meta = { ...SAVED_META, name: 'Renamed' };
      expect(isModified(afterRename, edited)).toBe(true);
    });

    it('clears the label once "Save widget" writes the resolved config', () => {
      const afterRename: Meta = { ...SAVED_META, name: 'Renamed' };
      const afterSave: Meta = { ...afterRename, ...edited };
      expect(isModified(afterSave, edited)).toBe(false);

      // A later rename keeps the newly saved inputs, so it stays clear.
      const afterSecondRename: Meta = { ...afterSave, name: 'Renamed again' };
      expect(isModified(afterSecondRename, edited)).toBe(false);
    });

    it('stays clear when the linked account balance moves after saving', () => {
      const afterSave: Meta = { ...SAVED_META, ...edited };
      const balanceMoved = withPot(edited, 'pot-linked', {
        startingBalance: 9_000_000,
      });
      expect(isModified(afterSave, balanceMoved)).toBe(false);
    });
  });
});
