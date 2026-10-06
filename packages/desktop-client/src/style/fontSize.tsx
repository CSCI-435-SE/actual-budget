import { useEffect } from 'react';
import { useGlobalPref } from '#hooks/useGlobalPref';

// Base values matching styles.ts exactly
const baseScale = {
  '--font-size-tiny': 10,
  '--font-size-very-small': 12,
  '--font-size-small': 13,
  '--font-size-alt-menu': 13,
  '--font-size-medium': 15,
  '--font-size-base': 16,
  '--font-size-mobile-menu': 17,
  '--font-size-large': 20,
  '--font-size-very-large': 30,
};

export function FontSizeStyle() {
  const [fontSize] = useGlobalPref('fontSize');
  const multiplier = parseFloat(fontSize ?? '1');

  const css = `:root {
    ${Object.entries(baseScale)
      .map(([key, base]) => `${key}: ${Math.round(base * multiplier)}px;`)
      .join('\n    ')}
  }`;

  return <style id="font-size-scale">{css}</style>;
}