// Use the browser ESM build: the default `csv-stringify/sync` entry pulls in
// the Node build (which imports `stream`), breaking lazy-loaded chunks in the
// browser bundle. The browser ESM build is self-contained.
import { stringify as csvStringify } from 'csv-stringify/browser/esm/sync';

// Values starting with these characters are interpreted as formulas by
// spreadsheet apps, so they get a leading `'` to keep them as plain text.
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;

export function stringifyCsv(rows: unknown[][], columns: string[]): string {
  return csvStringify(rows, {
    header: true,
    columns,
    cast: {
      string: (value: string) =>
        FORMULA_TRIGGERS.test(value) ? "'" + value : value,
    },
  });
}
