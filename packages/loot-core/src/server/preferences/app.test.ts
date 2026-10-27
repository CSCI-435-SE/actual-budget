// @ts-strict-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as asyncStorage from '#platform/server/asyncStorage';
import { runHandler } from '#server/mutators';

import { app } from './app';

// vi.mock is hoisted above the imports, so this applies before main.ts loads
vi.mock('#server/main', () => ({
  getDefaultDocumentDir: () => '/mock/documents',
}));

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

  describe('icon-size', () => {
    // Backs setItem/multiGet with one in-memory map so a load reads back
    // exactly what the preceding save wrote.
    function backStorageWithMemory() {
      const stored = new Map<string, unknown>();
      vi.mocked(asyncStorage.setItem).mockImplementation(async (key, value) => {
        stored.set(key, value);
      });
      vi.mocked(asyncStorage.multiGet).mockImplementation(async keys =>
        Object.fromEntries(keys.map(key => [key, stored.get(key)])),
      );
    }

    it('saves icon-size to asyncStorage', async () => {
      await runHandler(saveGlobalPrefs, { iconSize: '1.25' });

      expect(vi.mocked(asyncStorage.setItem)).toHaveBeenCalledWith(
        'icon-size',
        '1.25',
      );
    });

    it('does not write icon-size when saving other prefs', async () => {
      await runHandler(saveGlobalPrefs, { fontSize: '1.1' });

      expect(vi.mocked(asyncStorage.setItem)).not.toHaveBeenCalledWith(
        'icon-size',
        expect.anything(),
      );
    });

    it('loads icon-size from asyncStorage', async () => {
      vi.mocked(asyncStorage.multiGet).mockResolvedValue({
        'icon-size': '1.25',
      });

      const prefs = await runHandler(loadGlobalPrefs, undefined);

      expect(prefs.iconSize).toBe('1.25');
    });

    it.each(['0.75', '1', '1.25', '1.5'])(
      'round-trips icon-size %s through save and load',
      async iconSize => {
        backStorageWithMemory();

        await runHandler(saveGlobalPrefs, { iconSize });
        const prefs = await runHandler(loadGlobalPrefs, undefined);

        expect(prefs.iconSize).toBe(iconSize);
      },
    );

    it('keeps font-size and icon-size independent', async () => {
      backStorageWithMemory();

      await runHandler(saveGlobalPrefs, { fontSize: '0.85', iconSize: '1.5' });
      const prefs = await runHandler(loadGlobalPrefs, undefined);

      expect(prefs.fontSize).toBe('0.85');
      expect(prefs.iconSize).toBe('1.5');
    });

    it('falls back to default multiplier when icon-size is not set', async () => {
      vi.mocked(asyncStorage.multiGet).mockResolvedValue({});

      const prefs = await runHandler(loadGlobalPrefs, undefined);

      expect(prefs.iconSize).toBe('1');
    });

    it('falls back to default multiplier when icon-size is empty', async () => {
      vi.mocked(asyncStorage.multiGet).mockResolvedValue({ 'icon-size': '' });

      const prefs = await runHandler(loadGlobalPrefs, undefined);

      expect(prefs.iconSize).toBe('1');
    });
  });
});
