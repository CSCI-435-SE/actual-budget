import React, {
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { WheelEvent } from 'react';
import { animated, useSpring } from 'react-spring';

import { View, viewStyles } from '@actual-app/components/view';
import {
  addMonths,
  nextMonth,
  prevMonth,
  subMonths,
} from '@actual-app/core/shared/months';
import { css } from '@emotion/css';

import { useResizeObserver } from '#hooks/useResizeObserver';

import { MonthsContext } from './MonthsContext';

import { useBudgetComponents } from '.';

// How much accumulated horizontal wheel delta it takes to step one month.
const WHEEL_STEP_THRESHOLD = 200;
// After a step fires, ignore wheel events for this long before resetting —
// a fixed window (not re-armed by further events) so a swipe's momentum
// tail can't chain into extra steps, without indefinitely delaying the
// next deliberate swipe the way waiting for total silence would.
const WHEEL_STEP_LOCKOUT_MS = 450;

type BudgetSummariesProps = {
  startMonth: string;
  onMonthSelect: (month: string) => void;
};

export function BudgetSummaries({
  startMonth,
  onMonthSelect,
}: BudgetSummariesProps) {
  const { months } = useContext(MonthsContext);
  const [firstMonth] = months;
  const wheelState = useRef({ accumulated: 0, lockedUntil: 0 });

  const onWheel = (e: WheelEvent) => {
    // Only step months on a horizontal gesture (trackpad swipe or shift+wheel)
    // so plain vertical scrolling over this row is left alone.
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;

    e.preventDefault();

    const state = wheelState.current;
    const now = Date.now();
    if (now < state.lockedUntil) return;

    state.accumulated += e.deltaX;

    if (state.accumulated >= WHEEL_STEP_THRESHOLD) {
      onMonthSelect(nextMonth(startMonth));
      state.accumulated = 0;
      state.lockedUntil = now + WHEEL_STEP_LOCKOUT_MS;
    } else if (state.accumulated <= -WHEEL_STEP_THRESHOLD) {
      onMonthSelect(prevMonth(startMonth));
      state.accumulated = 0;
      state.lockedUntil = now + WHEEL_STEP_LOCKOUT_MS;
    }
  };

  const [widthState, setWidthState] = useState(0);
  const [styles, spring] = useSpring(
    () => ({
      from: { x: 0 },
      config: { mass: 3, tension: 600, friction: 80 },
    }),
    [],
  );

  const containerRef = useResizeObserver<HTMLDivElement>(
    useCallback(rect => {
      setWidthState(rect.width);
    }, []),
  );

  const prevMonth0 = useRef(firstMonth);
  const allMonths = useMemo(() => {
    const all = [...months];
    all.unshift(subMonths(firstMonth, 1));
    all.push(addMonths(months[months.length - 1], 1));
    return all;
  }, [months, firstMonth]);
  const monthWidth = widthState / months.length;

  useLayoutEffect(() => {
    const prevMonth = prevMonth0.current;
    const reversed = prevMonth > firstMonth;
    const offsetX = monthWidth;
    let from = reversed ? -offsetX * 2 : 0;

    if (prevMonth !== allMonths[0] && prevMonth !== allMonths[2]) {
      from = -offsetX;
    }

    const to = -offsetX;
    if (from !== to) {
      void spring.start({ from: { x: from }, to: { x: to } });
    }
  }, [spring, firstMonth, monthWidth, allMonths]);

  useLayoutEffect(() => {
    prevMonth0.current = firstMonth;
  }, [firstMonth]);

  useLayoutEffect(() => {
    void spring.start({ to: { x: -monthWidth }, immediate: true });
  }, [spring, monthWidth]);

  const { SummaryComponent } = useBudgetComponents();

  return (
    <div
      className={css([
        { flex: 1, overflow: 'hidden' },
        months.length === 1 && {
          marginLeft: -4,
          marginRight: -4,
        },
      ])}
      ref={containerRef}
      onWheel={onWheel}
    >
      <animated.div
        className={viewStyles}
        style={{
          flexDirection: 'row',
          width: widthState,
          willChange: 'transform',
          transform: styles.x.to(x => `translateX(${x}px)`),
        }}
      >
        {allMonths.map(month => {
          return (
            <View
              key={month}
              style={{
                flex: `0 0 ${monthWidth}px`,
                paddingLeft: 4,
                paddingRight: 4,
              }}
            >
              <SummaryComponent month={month} />
            </View>
          );
        })}
      </animated.div>
    </div>
  );
}
