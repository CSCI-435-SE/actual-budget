import { useGlobalPref } from '#hooks/useGlobalPref';

// Returns a CSS length that scales an icon's base pixel size by the user's
// icon size preference. Falls back to the base size when the variable is
// unset (e.g. in tests that render without IconSizeStyle).
export function scaledIconSize(baseSize: number) {
  return `calc(${baseSize}px * var(--icon-scale, 1))`;
}

export function IconSizeStyle() {
  const [iconSize] = useGlobalPref('iconSize');
  const multiplier = parseFloat(iconSize ?? '1') || 1;

  const css = `:root {
    --icon-scale: ${multiplier};
  }`;

  return <style id="icon-size-scale">{css}</style>;
}
