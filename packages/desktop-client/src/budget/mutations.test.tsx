import type { ReactNode } from 'react';

import {
  clearServer,
  initServer,
} from '@actual-app/core/platform/client/connection';
import type { CategoryEntity } from '@actual-app/core/types/models';
import { renderHook, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTestAppStore, TestProviders } from '#mocks';
import type { AppStore } from '#redux/store';

import {
  CATEGORY_NAME_MAX_LENGTH,
  useCreateCategoryMutation,
  useSaveCategoryMutation,
} from './mutations';

vi.mock(
  '@actual-app/core/platform/client/connection',
  () => import('#mocks/connection'),
);

// With no translation resources loaded, i18next echoes the key back with
// interpolation applied - matching what the notification messages render.
void i18next.init({
  lng: 'en',
  interpolation: { escapeValue: false },
});

function wrapperFor(store: AppStore) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <TestProviders store={store}>{children}</TestProviders>;
  };
}

function getNotifications(store: AppStore) {
  return store.getState().notifications.notifications;
}

const tooLongName = 'a'.repeat(CATEGORY_NAME_MAX_LENGTH + 1);
const maxLengthName = 'a'.repeat(CATEGORY_NAME_MAX_LENGTH);

afterEach(async () => {
  await clearServer();
});

// Mobile's "new category" modal calls useCreateCategoryMutation directly.
describe('useCreateCategoryMutation (mobile category creation)', () => {
  it('rejects a name over the character limit without contacting the server', async () => {
    const createCategoryHandler = vi.fn(async () => 'new-id');
    initServer({ 'category-create': createCategoryHandler });

    const store = createTestAppStore();
    const { result } = renderHook(() => useCreateCategoryMutation(), {
      wrapper: wrapperFor(store),
    });

    await result.current.mutateAsync({
      name: tooLongName,
      groupId: 'group1',
      isIncome: false,
      isHidden: false,
    });

    expect(createCategoryHandler).not.toHaveBeenCalled();
    expect(getNotifications(store)).toMatchObject([
      { type: 'error', message: expect.stringContaining('50') },
    ]);
  });

  it('allows a name at the character limit', async () => {
    const createCategoryHandler = vi.fn(async () => 'new-id');
    initServer({ 'category-create': createCategoryHandler });

    const store = createTestAppStore();
    const { result } = renderHook(() => useCreateCategoryMutation(), {
      wrapper: wrapperFor(store),
    });

    await result.current.mutateAsync({
      name: maxLengthName,
      groupId: 'group1',
      isIncome: false,
      isHidden: false,
    });

    expect(createCategoryHandler).toHaveBeenCalledWith({
      name: maxLengthName,
      groupId: 'group1',
      isIncome: false,
      hidden: false,
    });
    expect(getNotifications(store)).toEqual([]);
  });
});

// Desktop's "new category" row saves through useSaveCategoryMutation with id: 'new'.
describe('useSaveCategoryMutation (desktop category creation)', () => {
  function newCategory(name: string): CategoryEntity {
    return {
      id: 'new',
      name,
      group: 'group1',
      is_income: false,
      hidden: false,
    };
  }

  beforeEach(() => {
    initServer({
      'get-categories': async () => ({ grouped: [], list: [] }),
    });
  });

  it('rejects a name over the character limit without contacting the server', async () => {
    const createCategoryHandler = vi.fn(async () => 'new-id');
    initServer({
      'get-categories': async () => ({ grouped: [], list: [] }),
      'category-create': createCategoryHandler,
    });

    const store = createTestAppStore();
    const { result } = renderHook(() => useSaveCategoryMutation(), {
      wrapper: wrapperFor(store),
    });

    await result.current.mutateAsync({ category: newCategory(tooLongName) });

    expect(createCategoryHandler).not.toHaveBeenCalled();
    expect(getNotifications(store)).toMatchObject([
      { type: 'error', message: expect.stringContaining('50') },
    ]);
  });

  it('allows a name at the character limit', async () => {
    const createCategoryHandler = vi.fn(async () => 'new-id');
    initServer({
      'get-categories': async () => ({ grouped: [], list: [] }),
      'category-create': createCategoryHandler,
    });

    const store = createTestAppStore();
    const { result } = renderHook(() => useSaveCategoryMutation(), {
      wrapper: wrapperFor(store),
    });

    await result.current.mutateAsync({ category: newCategory(maxLengthName) });

    await waitFor(() => expect(createCategoryHandler).toHaveBeenCalled());
    expect(getNotifications(store)).toEqual([]);
  });
});
