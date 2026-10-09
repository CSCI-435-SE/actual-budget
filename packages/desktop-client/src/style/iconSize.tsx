import { useGlobalPref } from '#hooks/useGlobalPref';

const baseIconScale = {
  '--icon-size-7': 7,
  '--icon-size-8': 8,
  '--icon-size-10': 10,
  '--icon-size-12': 12,
  '--icon-size-13': 13,
  '--icon-size-14': 14, 
  '--icon-size-15': 15,
  '--icon-size-16': 16,
  '--icon-size-17': 17,
  '--icon-size-18': 18,
  '--icon-size-20': 20,
};

export function IconSizeStyle() {
  const [iconSize] = useGlobalPref('iconSize');
  const multiplier = parseFloat(iconSize ?? '1');

  const css = `:root {
    ${Object.entries(baseIconScale)
      .map(([key, base]) => `${key}: ${Math.round(base * multiplier)}px;`)
      .join('\n    ')}
  }`;

  return <style id="icon-size-scale">{css}</style>;
}