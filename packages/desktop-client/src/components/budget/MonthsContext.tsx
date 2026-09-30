// @ts-strict-ignore
import React, { createContext } from 'react';
import type { ReactNode } from 'react';

import * as monthUtils from '@actual-app/core/shared/months';

export type MonthBounds = {
  start: string;
  end: string;
};

export function getValidMonthBounds(
  bounds: MonthBounds,
  startMonth: undefined | string,
  endMonth: string,
) {
  return {
    start: startMonth < bounds.start ? bounds.start : startMonth,
    end: endMonth > bounds.end ? bounds.end : endMonth,
  };
}

export function getVisibleMonths(
  startMonth: undefined | string,
  numMonths: number,
  monthBounds: MonthBounds,
) {
  const endMonth = monthUtils.addMonths(startMonth, numMonths - 1);
  const bounds = getValidMonthBounds(monthBounds, startMonth, endMonth);
  return monthUtils.rangeInclusive(bounds.start, bounds.end);
}

type MonthsContextProps = {
  months: string[];
  type: string;
};

export const MonthsContext = createContext<MonthsContextProps>(null);

type MonthsProviderProps = {
  startMonth: string | undefined;
  numMonths: number;
  monthBounds: MonthBounds;
  type: string;
  children: ReactNode;
};

export function MonthsProvider({
  startMonth,
  numMonths,
  monthBounds,
  type,
  children,
}: MonthsProviderProps) {
  const months = getVisibleMonths(startMonth, numMonths, monthBounds);

  return (
    <MonthsContext.Provider value={{ months, type }}>
      {children}
    </MonthsContext.Provider>
  );
}
