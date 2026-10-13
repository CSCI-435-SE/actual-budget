// @ts-strict-ignore
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#server/main', () => ({
  getDefaultDocumentDir: () => '/mock/documents',
}));

import * as asyncStorage from '#platform/server/asyncStorage';
import { runHandler } from '#server/mutators';

import { app } from './app';

const saveGlobalPrefs = app.handlers['save-global-prefs'];
const loadGlobalPrefs = app.handlers['load-global-prefs'];

describe('icon-size preference', () => {
  beforeEach(async () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    await (global as any).emptyDatabase()();
    vi.clearAllMocks();
  });

  it('saves icon-size to asyncStorage', async () => {
    await runHandler(saveGlobalPrefs, { iconSize: '1.15' });

    expect(vi.mocked(asyncStorage.setItem)).toHaveBeenCalledWith(
      'icon-size',
      '1.15',
    );
  });

  it('loads icon-size from asyncStorage', async () => {
    vi.mocked(asyncStorage.multiGet).mockResolvedValue({
      'icon-size': '1.15',
    });

    const prefs = await runHandler(loadGlobalPrefs, undefined);

    expect(prefs.iconSize).toBe('1.15');
  });

  it('round-trips icon-size through save and load', async () => {
    await runHandler(saveGlobalPrefs, { iconSize: '1.3' });

    vi.mocked(asyncStorage.multiGet).mockResolvedValue({
      'icon-size': '1.3',
    });

    const prefs = await runHandler(loadGlobalPrefs, undefined);

    expect(prefs.iconSize).toBe('1.3');
  });

  it('falls back to default when icon-size is not set', async () => {
    vi.mocked(asyncStorage.multiGet).mockResolvedValue({});

    const prefs = await runHandler(loadGlobalPrefs, undefined);

    expect(prefs.iconSize).toBe('1');
  });

  it('saves small icon-size multiplier correctly', async () => {
    await runHandler(saveGlobalPrefs, { iconSize: '0.85' });

    expect(vi.mocked(asyncStorage.setItem)).toHaveBeenCalledWith(
      'icon-size',
      '0.85',
    );
  });

  it('loads small icon-size multiplier correctly', async () => {
    vi.mocked(asyncStorage.multiGet).mockResolvedValue({
      'icon-size': '0.85',
    });

    const prefs = await runHandler(loadGlobalPrefs, undefined);

    expect(prefs.iconSize).toBe('0.85');
  });

  it('does not save icon-size when it is not provided', async () => {
    await runHandler(saveGlobalPrefs, {});

    expect(vi.mocked(asyncStorage.setItem)).not.toHaveBeenCalledWith(
      'icon-size',
      expect.anything(),
    );
  });

  it('returns undefined for icon-size when storage returns null', async () => {
    vi.mocked(asyncStorage.multiGet).mockResolvedValue({
      'icon-size': null,
    });

    const prefs = await runHandler(loadGlobalPrefs, undefined);

    expect(prefs.iconSize).toBe('1');
  });
});