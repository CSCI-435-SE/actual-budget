import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { useSidebar } from './SidebarProvider';

import { FloatableSidebar } from './index';

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));

vi.mock('./SidebarProvider', () => ({
  SIDEBAR_TRANSITION_MS: 500,
  useSidebar: vi.fn(),
}));

const SIDEBAR_WIDTH = 240;

vi.mock('./Sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar-stub" />,
}));

describe('FloatableSidebar', () => {
  let setHoveringSidebar: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    setHoveringSidebar = vi.fn();
    (useResponsive as unknown as Mock).mockReturnValue({
      isNarrowWidth: false,
    });
    // jsdom has no ResizeObserver; report a fixed sidebar width on observe.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(
          private callback: (
            entries: { contentRect: { width: number } }[],
          ) => void,
        ) {}
        observe() {
          this.callback([{ contentRect: { width: SIDEBAR_WIDTH } }]);
        }
        disconnect = vi.fn();
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setup({
    floatingSidebar = true,
    alwaysFloats = false,
    hidden = false,
  }: {
    floatingSidebar?: boolean;
    alwaysFloats?: boolean;
    hidden?: boolean;
  } = {}) {
    (useSidebar as unknown as Mock).mockReturnValue({
      hidden,
      setHidden: vi.fn(),
      setHoveringSidebar,
      floating: floatingSidebar || alwaysFloats,
      alwaysFloats,
      reflows: floatingSidebar && !alwaysFloats,
    });
    return render(<FloatableSidebar />);
  }

  function getWrapper(getByTestId: (id: string) => HTMLElement) {
    return getByTestId('sidebar-stub').parentElement
      ?.parentElement as HTMLElement;
  }

  it('reports hovering the sidebar on mouse over when floating', () => {
    const { getByTestId } = setup({ floatingSidebar: true });

    fireEvent.mouseOver(getWrapper(getByTestId));

    expect(setHoveringSidebar).toHaveBeenCalledWith(true);
  });

  it('reports the sidebar as no longer hovered on mouse leave when floating', () => {
    const { getByTestId } = setup({ floatingSidebar: true });

    fireEvent.mouseLeave(getWrapper(getByTestId));

    expect(setHoveringSidebar).toHaveBeenCalledWith(false);
  });

  it('attaches hover handlers when the sidebar always floats, even if the floating pref is off', () => {
    const { getByTestId } = setup({
      floatingSidebar: false,
      alwaysFloats: true,
    });

    fireEvent.mouseOver(getWrapper(getByTestId));

    expect(setHoveringSidebar).toHaveBeenCalledWith(true);
  });

  it('does not attach hover handlers when the sidebar is docked (not floating)', () => {
    const { getByTestId } = setup({
      floatingSidebar: false,
      alwaysFloats: false,
    });
    const wrapper = getWrapper(getByTestId);

    fireEvent.mouseOver(wrapper);
    fireEvent.mouseLeave(wrapper);

    expect(setHoveringSidebar).not.toHaveBeenCalled();
  });

  it('keeps a reflowing sidebar in the layout and collapses its width while hidden', () => {
    const { getByTestId } = setup({ floatingSidebar: true, hidden: true });
    const wrapper = getWrapper(getByTestId);

    expect(getComputedStyle(wrapper).position).not.toBe('absolute');
    expect(getComputedStyle(wrapper).marginRight).toBe(`-${SIDEBAR_WIDTH}px`);
  });

  it('gives a reflowing sidebar its full width while open', () => {
    const { getByTestId } = setup({ floatingSidebar: true, hidden: false });
    const wrapper = getWrapper(getByTestId);

    expect(getComputedStyle(wrapper).position).not.toBe('absolute');
    expect(getComputedStyle(wrapper).marginRight).toBe('0px');
  });

  it('overlays the content when the sidebar always floats', () => {
    const { getByTestId } = setup({
      floatingSidebar: false,
      alwaysFloats: true,
      hidden: true,
    });
    const wrapper = getWrapper(getByTestId);

    expect(getComputedStyle(wrapper).position).toBe('absolute');
    expect(getComputedStyle(wrapper).marginRight).toBe('0px');
  });

  it('does not collapse a docked sidebar', () => {
    const { getByTestId } = setup({ floatingSidebar: false, hidden: true });
    const wrapper = getWrapper(getByTestId);

    expect(getComputedStyle(wrapper).position).not.toBe('absolute');
    expect(getComputedStyle(wrapper).marginRight).toBe('0px');
  });
});
