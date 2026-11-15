// jsPDF's built-in fonts (Helvetica, etc.) only cover the WinAnsi character
// set. If a string contains even one character outside it, jsPDF encodes the
// whole string as two bytes per character, and the font then draws each byte
// on its own: U+202A shows up as " *", U+202C as " ,", and every other
// character gets a NUL in front of it. `useFormat` adds several of these
// characters to amounts (direction marks around the currency symbol, narrow
// no-break spaces as separators), so every string has to be cleaned before
// it is handed to jsPDF.
//
// Characters are matched by code point rather than written as literals,
// because they are invisible or look like other characters, and the code
// formatter has rewritten literal curly quotes into ASCII ones before.

// The characters above U+00FF that WinAnsi still includes (its 0x80-0x9F
// range): euro, single/double low-9 and curly quotes, ellipsis, daggers,
// per mille, en/em dash, bullet, trade mark, and a few accented capitals.
// jsPDF maps these to single bytes, so they render correctly.
const WIN_ANSI_EXTRAS = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

// Invisible bidirectional formatting marks: LRM/RLM, the LRE-RLO embeddings
// and overrides, and the isolates. Same set `useFormat`'s `fromEdit` strips.
function isDirectionMark(code: number): boolean {
  return (
    code === 0x200e ||
    code === 0x200f ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2066 && code <= 0x2069)
  );
}

// No-break space and narrow no-break space; an ordinary space looks the same
// in a PDF.
function isNonAsciiSpace(code: number): boolean {
  return code === 0x00a0 || code === 0x202f;
}

const MINUS_SIGN = 0x2212;

// Iterates by code point, so an emoji (a surrogate pair) is handled as one
// character and becomes a single '?'.
export function toPdfSafeText(text: string): string {
  let result = '';
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;

    if (isDirectionMark(code)) {
      continue;
    }

    if (isNonAsciiSpace(code)) {
      result += ' ';
    } else if (code === MINUS_SIGN) {
      result += '-';
    } else if (code <= 0xff || WIN_ANSI_EXTRAS.has(code)) {
      result += char;
    } else {
      // Emoji, the rupee sign, non-Latin scripts: '?' keeps one unsupported
      // character from garbling the rest of the string.
      result += '?';
    }
  }
  return result;
}
