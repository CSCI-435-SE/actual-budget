import { useGlobalPref } from '#hooks/useGlobalPref';

const baseScale = {
  '--font-size-10': 10,   // tinyText
  '--font-size-11': 11,
  '--font-size-12': 12,   // verySmallText
  '--font-size-13': 13,   // smallText, altMenuText, altMenuHeaderText
  '--font-size-14': 14,
  '--font-size-15': 15,   // mediumText
  '--font-size-16': 16,   // text (base)
  '--font-size-17': 17,   // mobileMenuItem
  '--font-size-18': 18,
  '--font-size-20': 20,   // largeText
  '--font-size-22': 22,
  '--font-size-25': 25,
  '--font-size-30': 30,   // veryLargeText
  '--font-size-40': 40,
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