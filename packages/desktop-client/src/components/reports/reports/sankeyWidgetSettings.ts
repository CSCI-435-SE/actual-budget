import type {
  RuleConditionEntity,
  SankeyWidget,
  TimeFrame,
} from '@actual-app/core/types/models';

import {
  GRAPH_LAYER_ORDER,
  GraphLayers,
  isGraphLayer,
} from '#components/reports/spreadsheets/sankey-spreadsheet';
import {
  toComparableConditions,
  toComparableTimeFrame,
} from '#components/reports/widgetModified';

type SankeyMeta = NonNullable<SankeyWidget['meta']>;
type SankeyCategorySort = NonNullable<SankeyMeta['categorySort']>;

export type SankeyGraphMode = 'budgeted' | 'spent';

export type LayerDirection = 'from' | 'to';
export type LayerRange = {
  from: GraphLayers;
  to: GraphLayers;
};

export function getAvailableLayers(mode: SankeyGraphMode): GraphLayers[] {
  return GRAPH_LAYER_ORDER.filter(layer => {
    if (mode === 'budgeted') {
      return layer !== GraphLayers.IncomePayee;
    }

    return layer !== GraphLayers.Budget;
  }) as GraphLayers[];
}

export function getDefaultLayerRange(mode: SankeyGraphMode): LayerRange {
  return {
    from:
      mode === 'budgeted'
        ? GraphLayers.IncomeCategory
        : GraphLayers.IncomePayee,
    to: GraphLayers.Category,
  };
}

export function normalizeLayerRange(
  mode: SankeyGraphMode,
  candidate: LayerRange,
  changedDirection?: LayerDirection,
): LayerRange {
  const availableLayers = getAvailableLayers(mode);
  const fallback = getDefaultLayerRange(mode);
  const defaultFromIndex = availableLayers.indexOf(fallback.from);
  const defaultToIndex = availableLayers.indexOf(fallback.to);

  let from = availableLayers.includes(candidate.from)
    ? candidate.from
    : fallback.from;
  let to = availableLayers.includes(candidate.to) ? candidate.to : fallback.to;

  let fromIndex = availableLayers.indexOf(from);
  let toIndex = availableLayers.indexOf(to);

  if (fromIndex >= toIndex) {
    if (changedDirection === 'from') {
      const adjustedToIndex = Math.min(
        availableLayers.length - 1,
        Math.max(fromIndex + 1, defaultToIndex),
      );
      to = availableLayers[adjustedToIndex] ?? fallback.to;
    } else if (changedDirection === 'to') {
      const adjustedFromIndex = Math.max(
        0,
        Math.min(toIndex - 1, defaultFromIndex),
      );
      from = availableLayers[adjustedFromIndex] ?? fallback.from;
    } else {
      from = fallback.from;
      to = fallback.to;
    }

    fromIndex = availableLayers.indexOf(from);
    toIndex = availableLayers.indexOf(to);
  }

  if (fromIndex >= toIndex) {
    return fallback;
  }

  return { from, to };
}

/** The layers a widget opens with: the saved ones, fitted to the mode. */
export function getInitialLayerRange(
  mode: SankeyGraphMode,
  layerFrom: string | undefined,
  layerTo: string | undefined,
): LayerRange {
  const fallback = getDefaultLayerRange(mode);
  return normalizeLayerRange(mode, {
    from: isGraphLayer(layerFrom) ? layerFrom : fallback.from,
    to: isGraphLayer(layerTo) ? layerTo : fallback.to,
  });
}

export type SankeyWidgetSettings = Required<
  Pick<
    SankeyMeta,
    | 'conditions'
    | 'conditionsOp'
    | 'mode'
    | 'topNcategories'
    | 'categorySort'
    | 'showPercentages'
    | 'showTransfers'
    | 'layerFrom'
    | 'layerTo'
    | 'timeFrame'
    | 'groupAccounts'
  >
>;

/** The settings "Save widget" writes for a Sankey widget. */
export function buildSankeyWidgetSettings({
  conditions,
  conditionsOp,
  graphMode,
  topNcategories,
  categorySort,
  showPercentages,
  showTransfers,
  layerFrom,
  layerTo,
  start,
  end,
  timeFrameMode,
  groupAccounts,
}: {
  conditions: RuleConditionEntity[];
  conditionsOp: 'and' | 'or';
  graphMode: SankeyGraphMode;
  topNcategories: number;
  categorySort: SankeyCategorySort;
  showPercentages: boolean;
  showTransfers: boolean;
  layerFrom: GraphLayers;
  layerTo: GraphLayers;
  start: string;
  end: string;
  timeFrameMode: TimeFrame['mode'];
  groupAccounts: boolean;
}): SankeyWidgetSettings {
  return {
    conditions,
    conditionsOp,
    mode: graphMode,
    topNcategories,
    categorySort,
    showPercentages,
    showTransfers,
    layerFrom,
    layerTo,
    timeFrame: { start, end, mode: timeFrameMode },
    groupAccounts,
  };
}

export function toComparableSankeySettings(
  meta: Partial<SankeyMeta> | null | undefined,
) {
  // Same fallbacks the report uses when it opens a widget.
  const mode = meta?.mode ?? 'spent';
  const layers = getInitialLayerRange(mode, meta?.layerFrom, meta?.layerTo);
  return {
    ...toComparableConditions(meta?.conditions, meta?.conditionsOp),
    mode,
    topNcategories: meta?.topNcategories ?? 15,
    categorySort: meta?.categorySort ?? 'per-group',
    showPercentages: meta?.showPercentages ?? false,
    showTransfers: meta?.showTransfers ?? false,
    groupAccounts: meta?.groupAccounts ?? false,
    layerFrom: layers.from,
    layerTo: layers.to,
    timeFrame: toComparableTimeFrame(meta?.timeFrame),
  };
}
