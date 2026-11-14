// Setup for vitest.stryker.issue-97.config.mts (mutation testing #97).
//
// Same as vitest.stryker.setup.ts, plus an i18next init. The regular test
// run gets i18next initialized indirectly (setupTests.ts -> mocks -> redux
// store -> i18n); this lighter config skips that chain. With no resources
// loaded, i18next echoes each English key back, which is what the export
// tests expect ("Total", "To Budget", column headers).
import i18next from 'i18next';

global.IS_TESTING = true;

await i18next.init({ lng: 'en', interpolation: { escapeValue: false } });
