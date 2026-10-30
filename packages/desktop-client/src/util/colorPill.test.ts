import { describe, expect, it } from 'vitest';

import { getColorPillColors, isHexColor } from './colorPill';

describe('isHexColor', () => {
  it('accepts 6-digit hex colors', () => {
    expect(isHexColor('#1E88E5')).toBe(true);
    expect(isHexColor('#1e88e5')).toBe(true);
  });

  it('rejects anything else', () => {
    expect(isHexColor(null)).toBe(false);
    expect(isHexColor(undefined)).toBe(false);
    expect(isHexColor('')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#FFF')).toBe(false);
    expect(isHexColor('#1E88E5FF')).toBe(false);
    expect(isHexColor('red#1E88E5')).toBe(false);
  });
});

describe('getColorPillColors', () => {
  it('uses black text on light colors', () => {
    expect(getColorPillColors('#FFFF7F')).toEqual({
      textColor: 'black',
      backgroundColor: '#FFFF7F',
      backgroundColorHovered: 'color-mix(in srgb, #FFFF7F 80%, black)',
    });
  });

  it('uses white text on dark colors', () => {
    expect(getColorPillColors('#1E88E5')).toEqual({
      textColor: 'white',
      backgroundColor: '#1E88E5',
      backgroundColorHovered: 'color-mix(in srgb, #1E88E5 70%, white)',
    });
    expect(getColorPillColors('#000000').textColor).toBe('white');
  });

  it('switches to black text at a brightness of exactly 125', () => {
    // (125 * 299 + 125 * 587 + 125 * 114) / 1000 = 125
    expect(getColorPillColors('#7D7D7D').textColor).toBe('black');
    // (124 * 299 + 124 * 587 + 124 * 114) / 1000 = 124
    expect(getColorPillColors('#7C7C7C').textColor).toBe('white');
  });
});
