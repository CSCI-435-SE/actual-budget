import { useRef } from 'react';
import type { RefObject } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

/**
 * Binds `/` to focus a search input. Returns the ref to pass to `<Search />`.
 *
 * The hotkey does not fire while a form field already has focus, so `/` can
 * still be typed into the search box itself.
 */
export function useSearchHotkey(): RefObject<HTMLInputElement | null> {
  const searchInput = useRef<HTMLInputElement>(null);

  useHotkeys(
    '/',
    e => {
      e.preventDefault();
      searchInput.current?.focus();
    },
    {
      useKey: true,
      scopes: ['app'],
    },
  );

  return searchInput;
}
