import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { useGlobalPref } from '#hooks/useGlobalPref';

import { useSidebar } from './SidebarProvider';

import { FloatableSidebar } from './index';

vi.mock('@actual-app/components/hooks/useResponsive', () => ({
  useResponsive: vi.fn(),
}));

vi.mock('#hooks/useGlobalPref', () => ({
  useGlobalPref: vi.fn(),
}));

vi.mock('./SidebarProvider', () => ({
  useSidebar: vi.fn(),
}));

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
  });

  function setup({
    floatingSidebar = true,
    alwaysFloats = false,
  }: { floatingSidebar?: boolean; alwaysFloats?: boolean } = {}) {
    (useGlobalPref as unknown as Mock).mockReturnValue([
      floatingSidebar,
      vi.fn(),
    ]);
    (useSidebar as unknown as Mock).mockReturnValue({
      hidden: false,
      setHidden: vi.fn(),
      setHoveringSidebar,
      floating: floatingSidebar || alwaysFloats,
      alwaysFloats,
    });
    return render(<FloatableSidebar />);
  }

  it('reports hovering the sidebar on mouse over when floating', () => {
    const { getByTestId } = setup({ floatingSidebar: true });

    fireEvent.mouseOver(getByTestId('sidebar-stub').parentElement as Element);

    expect(setHoveringSidebar).toHaveBeenCalledWith(true);
  });

  it('reports the sidebar as no longer hovered on mouse leave when floating', () => {
    const { getByTestId } = setup({ floatingSidebar: true });

    fireEvent.mouseLeave(getByTestId('sidebar-stub').parentElement as Element);

    expect(setHoveringSidebar).toHaveBeenCalledWith(false);
  });

  it('does not attach hover handlers when the sidebar is docked (not floating)', () => {
    const { getByTestId } = setup({
      floatingSidebar: false,
      alwaysFloats: false,
    });
    const wrapper = getByTestId('sidebar-stub').parentElement as Element;

    fireEvent.mouseOver(wrapper);
    fireEvent.mouseLeave(wrapper);

    expect(setHoveringSidebar).not.toHaveBeenCalled();
  });
});
