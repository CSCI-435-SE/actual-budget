// @ts-strict-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Must be before any import that triggers main.ts
vi.mock('#server/main', () => ({
  getDefaultDocumentDir: () => '/mock/documents',
}));

import * as asyncStorage from '#platform/server/asyncStorage';
import { runHandler } from '#server/mutators';

import { app } from './app';

const saveGlobalPrefs = app.handlers['save-global-prefs'];
const loadGlobalPrefs = app.handlers['load-global-prefs'];

describe('global preferences', () => {
  beforeEach(async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    await (global as any).emptyDatabase()();
    vi.clearAllMocks();
  });

  describe('font-size', () => {
    it('saves font-size to asyncStorage', async () => {
      await runHandler(saveGlobalPrefs, { fontSize: '1.1' });

      expect(vi.mocked(asyncStorage.setItem)).toHaveBeenCalledWith(
        'font-size',
        '1.1',
      );
    });

    it('loads font-size from asyncStorage', async () => {
      vi.mocked(asyncStorage.multiGet).mockResolvedValue({
        'font-size': '1.1',
      });

      const prefs = await runHandler(loadGlobalPrefs, undefined);

      expect(prefs.fontSize).toBe('1.1');
    });

    it('round-trips font-size through save and load', async () => {
      await runHandler(saveGlobalPrefs, { fontSize: '1.2' });

      vi.mocked(asyncStorage.multiGet).mockResolvedValue({
        'font-size': '1.2',
      });

      const prefs = await runHandler(loadGlobalPrefs, undefined);

      expect(prefs.fontSize).toBe('1.2');
    });

    it('falls back to default multiplier when font-size is not set', async () => {
      vi.mocked(asyncStorage.multiGet).mockResolvedValue({});

      const prefs = await runHandler(loadGlobalPrefs, undefined);

      expect(prefs.fontSize).toBe('1');
    });
  });
});