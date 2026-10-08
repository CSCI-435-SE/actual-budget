import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { closeContextMenu } from '#contextmenu/contextMenuSlice';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useDispatch } from '#redux';

import { SidebarProvider, useSidebar } from './SidebarProvider';

vi.mock('#redux', () => ({
  useDispatch: vi.fn(),
  useSelector: vi.fn(),
}));

vi.mock('#hooks/useGlobalPref', () => ({
  useGlobalPref: vi.fn(),
}));

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));

function dispatchPointerOver(target: Element) {
  target.dispatchEvent(new Event('pointerover', { bubbles: true }));
}

function renderSidebar() {
  return renderHook(() => useSidebar(), { wrapper: SidebarProvider });
}

describe('SidebarProvider', () => {
  let mockDispatch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockDispatch = vi.fn();
    (useDispatch as unknown as Mock).mockReturnValue(mockDispatch);
    (useGlobalPref as unknown as Mock).mockReturnValue([false, vi.fn()]);
    (useResponsive as unknown as Mock).mockReturnValue({ width: 1000 });
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  it('starts hidden', () => {
    const { result } = renderSidebar();
    expect(result.current.hidden).toBe(true);
  });

  it('shows the sidebar immediately while it is being hovered', () => {
    const { result } = renderSidebar();

    act(() => {
      result.current.setHoveringSidebar(true);
    });

    expect(result.current.hidden).toBe(false);
  });

  it('hides the sidebar 350ms after the mouse leaves it', () => {
    const { result } = renderSidebar();

    act(() => {
      result.current.setHoveringSidebar(true);
    });
    act(() => {
      result.current.setHoveringSidebar(false);
    });

    // Not hidden yet -- still within the debounce window.
    expect(result.current.hidden).toBe(false);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(result.current.hidden).toBe(true);
  });

  it('keeps the sidebar visible while a dropdown menu opened from it is hovered', () => {
    const { result } = renderSidebar();

    act(() => {
      result.current.setHoveringSidebar(true);
    });
    act(() => {
      // Mouse moves off the sidebar and onto its (portal-rendered) dropdown.
      result.current.setHoveringSidebar(false);
    });

    const popover = document.createElement('div');
    popover.setAttribute('data-popover', '');
    document.body.appendChild(popover);

    act(() => {
      dispatchPointerOver(popover);
    });

    // Well past the normal 350ms hide delay -- should still be visible
    // because the dropdown is being hovered.
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.hidden).toBe(false);
  });

  it('hides and closes the context menu once the mouse leaves the dropdown too', () => {
    const { result } = renderSidebar();

    act(() => {
      result.current.setHoveringSidebar(true);
    });
    act(() => {
      result.current.setHoveringSidebar(false);
    });

    const popover = document.createElement('div');
    popover.setAttribute('data-popover', '');
    document.body.appendChild(popover);

    act(() => {
      dispatchPointerOver(popover);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.hidden).toBe(false);
    mockDispatch.mockClear();

    const elsewhere = document.createElement('div');
    document.body.appendChild(elsewhere);

    act(() => {
      dispatchPointerOver(elsewhere);
    });

    // Leaving the popover restarts the same hide delay.
    expect(result.current.hidden).toBe(false);

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(result.current.hidden).toBe(true);
    expect(mockDispatch).toHaveBeenCalledWith(closeContextMenu());
  });

  it('does not close the context menu while the dropdown is still hovered', () => {
    const { result } = renderSidebar();

    act(() => {
      result.current.setHoveringSidebar(true);
    });
    act(() => {
      result.current.setHoveringSidebar(false);
    });

    const popover = document.createElement('div');
    popover.setAttribute('data-popover', '');
    document.body.appendChild(popover);

    mockDispatch.mockClear();

    act(() => {
      dispatchPointerOver(popover);
    });
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockDispatch).not.toHaveBeenCalledWith(closeContextMenu());
  });

  describe('reflows', () => {
    it('reflows when the floating pref is on and the window is wide', () => {
      (useGlobalPref as unknown as Mock).mockReturnValue([true, vi.fn()]);
      const { result } = renderSidebar();
      expect(result.current.reflows).toBe(true);
    });

    it('does not reflow when the sidebar is forced to float by a narrow window', () => {
      (useGlobalPref as unknown as Mock).mockReturnValue([true, vi.fn()]);
      (useResponsive as unknown as Mock).mockReturnValue({ width: 600 });
      const { result } = renderSidebar();
      expect(result.current.reflows).toBe(false);
    });

    it('does not reflow when the sidebar is pinned', () => {
      const { result } = renderSidebar();
      expect(result.current.reflows).toBe(false);
    });
  });

  describe('menu button hover', () => {
    beforeEach(() => {
      (useGlobalPref as unknown as Mock).mockReturnValue([true, vi.fn()]);
    });

    it('opens the sidebar only after the cursor rests on the button for 200ms', () => {
      const { result } = renderSidebar();

      act(() => {
        result.current.onMenuButtonHoverStart();
      });
      act(() => {
        vi.advanceTimersByTime(199);
      });

      expect(result.current.hidden).toBe(true);

      act(() => {
        vi.advanceTimersByTime(1);
      });

      expect(result.current.hidden).toBe(false);
    });

    it('does not open the sidebar when the cursor passes over the button', () => {
      const { result } = renderSidebar();

      act(() => {
        result.current.onMenuButtonHoverStart();
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      act(() => {
        result.current.onMenuButtonHoverEnd();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.hidden).toBe(true);
    });

    it('hides the sidebar 350ms after the cursor leaves the button', () => {
      const { result } = renderSidebar();

      act(() => {
        result.current.onMenuButtonHoverStart();
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      act(() => {
        result.current.onMenuButtonHoverEnd();
      });

      expect(result.current.hidden).toBe(false);

      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(result.current.hidden).toBe(true);
    });

    it('ignores menu button hovers while the sidebar is animating', () => {
      const { result } = renderSidebar();

      // Open via the sidebar itself, then let it close.
      act(() => {
        result.current.setHoveringSidebar(true);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        result.current.setHoveringSidebar(false);
      });
      act(() => {
        vi.advanceTimersByTime(350);
      });

      expect(result.current.hidden).toBe(true);

      // The close animation is still running: the button slides back under
      // the cursor, but that hover must not reopen the sidebar.
      act(() => {
        result.current.onMenuButtonHoverStart();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(result.current.hidden).toBe(true);
    });

    it('responds to menu button hovers again once the animation finishes', () => {
      const { result } = renderSidebar();

      act(() => {
        result.current.setHoveringSidebar(true);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        result.current.setHoveringSidebar(false);
      });
      act(() => {
        vi.advanceTimersByTime(350);
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        result.current.onMenuButtonHoverStart();
      });
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(result.current.hidden).toBe(false);
    });

    it('does not open if an animation starts during the hover delay', () => {
      const { result } = renderSidebar();

      act(() => {
        result.current.onMenuButtonHoverStart();
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });
      // A tap toggle opens the sidebar mid-delay, starting an animation.
      act(() => {
        result.current.setHidden(false);
      });
      act(() => {
        result.current.setHidden(true);
      });
      act(() => {
        vi.advanceTimersByTime(100);
      });

      expect(result.current.hidden).toBe(true);
    });
  });
});
