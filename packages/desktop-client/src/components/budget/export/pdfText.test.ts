import { describe, expect, it } from 'vitest';

import { toPdfSafeText } from './pdfText';

// The special characters are built from their code points, not written as
// literals or `\u` escapes, because the formatter rewrites those (it turned
// U+2019 into an ASCII apostrophe) and several of them look like a space.
const LRE = String.fromCharCode(0x202a); // left-to-right embedding
const PDF = String.fromCharCode(0x202c); // pop directional formatting
const NNBSP = String.fromCharCode(0x202f); // narrow no-break space
const NBSP = String.fromCharCode(0x00a0); // no-break space
const RSQUO = String.fromCharCode(0x2019); // apostrophe-dot separator
const MINUS = String.fromCharCode(0x2212); // minus sign
const EURO = String.fromCharCode(0x20ac);
const RUPEE = String.fromCharCode(0x20b9);
const HOUSE_EMOJI = String.fromCodePoint(0x1f3e0);

// Each input is the exact string `useFormat(value, 'financial')` produces
// for that setting: a currency symbol before the amount is wrapped in
// LRE/PDF, and the "space" option and the space-comma thousands separator
// are NNBSP. Expected values are what AC1/AC2 of issue #97 say should print:
// the app's visible text, with ordinary spaces.
describe('toPdfSafeText', () => {
  it.each([
    // [number format, symbol position/space, input, expected]
    ['comma-dot', 'before', `${LRE}$${PDF}1,234.56`, '$1,234.56'],
    ['comma-dot', 'before, negative', `-${LRE}$${PDF}45.00`, '-$45.00'],
    [
      'comma-dot',
      'before + space',
      `${LRE}$${PDF}${NNBSP}1,234.56`,
      '$ 1,234.56',
    ],
    ['comma-dot', 'after + space', `1,234.56${NNBSP}$`, '1,234.56 $'],
    ['dot-comma', 'after', `1.234,56${EURO}`, `1.234,56${EURO}`],
    [
      'dot-comma',
      'after + space, negative',
      `-45,00${NNBSP}${EURO}`,
      `-45,00 ${EURO}`,
    ],
    ['dot-comma', 'before', `${LRE}${EURO}${PDF}1.234,56`, `${EURO}1.234,56`],
    [
      'space-comma',
      'after + space',
      `1${NNBSP}234,56${NNBSP}${EURO}`,
      `1 234,56 ${EURO}`,
    ],
    [
      'space-comma',
      'before, negative',
      `-${LRE}${EURO}${PDF}1${NNBSP}234,56`,
      `-${EURO}1 234,56`,
    ],
    [
      'apostrophe-dot',
      'before + space',
      `${LRE}CHF${PDF}${NNBSP}1${RSQUO}234.56`,
      `CHF 1${RSQUO}234.56`,
    ],
    [
      'apostrophe-dot',
      'after + space, negative',
      `-1${RSQUO}234.56${NNBSP}CHF`,
      `-1${RSQUO}234.56 CHF`,
    ],
    ['comma-dot-in', 'before', `${LRE}$${PDF}12,34,567.89`, '$12,34,567.89'],
    ['comma-dot-in', 'after, negative', '-12,34,567.89$', '-12,34,567.89$'],
  ])(
    'cleans a %s amount with the symbol %s',
    (_format, _position, input, expected) => {
      expect(toPdfSafeText(input)).toBe(expected);
    },
  );

  it('leaves an amount with no currency set unchanged', () => {
    expect(toPdfSafeText('-1,234,567.89')).toBe('-1,234,567.89');
  });

  // AC2: a negative must print with an ASCII hyphen-minus.
  it('turns a Unicode minus sign into a hyphen-minus', () => {
    expect(toPdfSafeText(`${MINUS}45.00`)).toBe('-45.00');
  });

  it('turns a no-break space into an ordinary space', () => {
    expect(toPdfSafeText(`1${NBSP}234`)).toBe('1 234');
  });

  it('keeps characters the PDF font can draw', () => {
    const drawable = [
      'Café Ü',
      EURO,
      RSQUO,
      String.fromCharCode(0x2014), // em dash
      String.fromCharCode(0x2013), // en dash
      String.fromCharCode(0x2026), // ellipsis
    ].join(' ');
    expect(toPdfSafeText(drawable)).toBe(drawable);
  });

  // Issue #97, Design Decision 1: strip U+200E/U+200F, U+202A-U+202E and
  // U+2066-U+2069. useFormat only emits U+202A/U+202C today, so each mark is
  // checked on its own in case that changes.
  it.each([
    0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067,
    0x2068, 0x2069,
  ])('strips the direction mark U+%s', code => {
    const mark = String.fromCharCode(code);
    expect(toPdfSafeText(`${mark}$${mark}12.00`)).toBe('$12.00');
  });

  // Latin-1 (up to U+00FF) is what the PDF font covers.
  it('keeps the last Latin-1 character and replaces the first one after it', () => {
    const lastLatin1 = String.fromCharCode(0x00ff); // y with diaeresis
    const firstAfter = String.fromCharCode(0x0100); // A with macron
    expect(toPdfSafeText(lastLatin1)).toBe(lastLatin1);
    expect(toPdfSafeText(firstAfter)).toBe('?');
  });

  // Out of scope for #97 (needs an embedded font), but one unsupported
  // character must not garble the rest of the text.
  it('replaces characters the PDF font cannot draw with a single "?"', () => {
    expect(toPdfSafeText(`${HOUSE_EMOJI} Rent`)).toBe('? Rent');
    expect(toPdfSafeText(`${RUPEE}1,234.56`)).toBe('?1,234.56');
  });
});
