const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{6}$/;

export function isHexColor(value: string | null | undefined): value is string {
  return !!value && HEX_COLOR_REGEX.test(value);
}

export type ColorPillColors = {
  textColor: 'black' | 'white';
  backgroundColor: string;
  backgroundColorHovered: string;
};

// see: https://www.w3.org/TR/AERT/#color-contrast
export function getColorPillColors(color: string): ColorPillColors {
  const r = parseInt(color.substring(1, 3), 16);
  const g = parseInt(color.substring(3, 5), 16);
  const b = parseInt(color.substring(5, 7), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  if (brightness >= 125) {
    return {
      textColor: 'black',
      backgroundColor: color,
      backgroundColorHovered: `color-mix(in srgb, ${color} 80%, black)`,
    };
  }

  return {
    textColor: 'white',
    backgroundColor: color,
    backgroundColorHovered: `color-mix(in srgb, ${color} 70%, white)`,
  };
}
