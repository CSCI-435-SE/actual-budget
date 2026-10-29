import { useContext, useEffect, useEffectEvent, useRef } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import {
  ColorArea,
  ColorPickerStateContext,
  ColorSlider,
  ColorThumb,
  SliderTrack,
  useLocale,
} from 'react-aria-components';
import type { Color, ColorChannel } from 'react-aria-components';

import { css } from '@emotion/css';

import { View } from './View';

// The thumb sits on arbitrary colors, so it pairs a white ring with a dark one
// instead of using theme tokens: one of the two always stands out
const thumbClassName = css({
  width: 20,
  height: 20,
  borderRadius: '50%',
  boxSizing: 'border-box',
  border: '2px solid white',
  boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.6), inset 0 0 0 1px rgba(0, 0, 0, 0.6)',
  forcedColorAdjust: 'none',
  '&[data-focus-visible]': {
    width: 24,
    height: 24,
    border: '3px solid white',
    boxShadow:
      '0 0 0 2px rgba(0, 0, 0, 0.85), inset 0 0 0 1px rgba(0, 0, 0, 0.6)',
  },
});

type KeyAxes = {
  horizontal: ColorChannel;
  vertical: ColorChannel;
  maxStep: number;
};

const AREA_AXES: KeyAxes = {
  horizontal: 'saturation',
  vertical: 'brightness',
  maxStep: 4,
};
const HUE_AXES: KeyAxes = { horizontal: 'hue', vertical: 'hue', maxStep: 10 };

type CustomColorPickerProps = {
  id?: string;
  onChangeEnd?: (color: Color) => void;
};

// Reads and writes the surrounding ColorPicker's state, so it stays in sync
// with the swatches and the hex field without any wiring of its own
export function CustomColorPicker({ id, onChangeEnd }: CustomColorPickerProps) {
  const state = useContext(ColorPickerStateContext);
  const { direction } = useLocale();

  // Every keyboard step counts as a finished change, so holding an arrow key
  // would settle (and save) on each repeat; hold those until the key is up
  const isKeyDown = useRef(false);
  const pendingColor = useRef<Color | null>(null);
  const repeatCount = useRef(0);

  const flushPending = useEffectEvent(() => {
    const color = pendingColor.current;
    pendingColor.current = null;
    if (color) {
      onChangeEnd?.(color);
    }
  });

  // Closing the popover mid-keypress unmounts this before the key is released
  useEffect(() => () => flushPending(), []);

  // The popover caps its height to the viewport, so on short screens this
  // could open below the fold and look like the toggle did nothing
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    containerRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, []);

  const handleChangeEnd = (color: Color) => {
    if (isKeyDown.current) {
      pendingColor.current = color;
    } else {
      onChangeEnd?.(color);
    }
  };

  const releaseKey = () => {
    isKeyDown.current = false;
    repeatCount.current = 0;
    flushPending();
  };

  // React Aria moves one unit per key repeat (1° of hue, 1% of saturation or
  // brightness), so a held arrow key crawls. A tap still moves one unit, but
  // repeats take over and grow the step the longer the key is held.
  const accelerateHeldArrow = (
    e: KeyboardEvent<HTMLDivElement>,
    { horizontal, vertical, maxStep }: KeyAxes,
  ) => {
    const isHorizontal = e.key === 'ArrowLeft' || e.key === 'ArrowRight';
    const isArrow =
      isHorizontal || e.key === 'ArrowUp' || e.key === 'ArrowDown';
    // Shift already makes React Aria take its larger page steps
    if (!state || !e.repeat || !isArrow || e.shiftKey) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();

    repeatCount.current += 1;
    const step = Math.min(1 + Math.floor(repeatCount.current / 3), maxStep);
    const forwardKey = direction === 'rtl' ? 'ArrowLeft' : 'ArrowRight';
    const sign = e.key === 'ArrowUp' || e.key === forwardKey ? 1 : -1;

    const channel = isHorizontal ? horizontal : vertical;
    const color = state.color.toFormat('hsb');
    const { minValue, maxValue } = color.getChannelRange(channel);
    const value = Math.min(
      maxValue,
      Math.max(minValue, color.getChannelValue(channel) + sign * step),
    );
    const next = color.withChannelValue(channel, value);

    state.setColor(next);
    pendingColor.current = next;
  };

  return (
    <View
      id={id}
      innerRef={containerRef}
      style={{ gap: 8, marginTop: 4 }}
      onKeyDownCapture={() => {
        isKeyDown.current = true;
      }}
      onKeyUpCapture={releaseKey}
      onBlur={(e: FocusEvent<HTMLDivElement>) => {
        // The key may be released after focus has moved elsewhere
        if (!e.currentTarget.contains(e.relatedTarget)) {
          releaseKey();
        }
      }}
    >
      <View onKeyDownCapture={e => accelerateHeldArrow(e, AREA_AXES)}>
        <ColorArea
          colorSpace="hsb"
          xChannel="saturation"
          yChannel="brightness"
          onChangeEnd={handleChangeEnd}
          style={{
            width: '100%',
            height: 140,
            borderRadius: 4,
            flexShrink: 0,
            forcedColorAdjust: 'none',
          }}
        >
          <ColorThumb className={thumbClassName} />
        </ColorArea>
      </View>
      <View onKeyDownCapture={e => accelerateHeldArrow(e, HUE_AXES)}>
        <ColorSlider
          colorSpace="hsb"
          channel="hue"
          onChangeEnd={handleChangeEnd}
        >
          <SliderTrack
            style={{ height: 24, borderRadius: 4, forcedColorAdjust: 'none' }}
          >
            <ColorThumb className={thumbClassName} style={{ top: '50%' }} />
          </SliderTrack>
        </ColorSlider>
      </View>
    </View>
  );
}
