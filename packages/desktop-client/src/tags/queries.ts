import { send } from '@actual-app/core/platform/client/connection';
import type { TagEntity } from '@actual-app/core/types/models';
import { queryOptions } from '@tanstack/react-query';

export const tagQueries = {
  all: () => ['tags'],
  lists: () => [...tagQueries.all(), 'lists'],
  list: () =>
    queryOptions<TagEntity[]>({
      queryKey: [...tagQueries.lists()],
      queryFn: () => send('tags-get'),
      placeholderData: [],
      // Manually invalidated when tags change
      staleTime: Infinity,
    }),
  // Number of transactions using each tag, keyed by tag name. Nested under
  // `lists()` so every tag mutation (including renames, which rewrite notes)
  // also refreshes the counts.
  counts: () =>
    queryOptions<Map<TagEntity['tag'], number>>({
      queryKey: [...tagQueries.lists(), 'counts'],
      queryFn: async () => {
        const counts = await send('tags-get-counts');
        return new Map(Object.entries(counts ?? {}));
      },
      // Transactions change outside of tag mutations, so refetch whenever the
      // Tags page mounts instead of relying on invalidation
      staleTime: 0,
    }),
};
