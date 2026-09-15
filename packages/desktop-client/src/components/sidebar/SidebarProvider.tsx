// @ts-strict-ignore
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';

import { closeContextMenu } from '#contextmenu/contextMenuSlice';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useDispatch } from '#redux';

const HOVER_HIDE_DELAY = 350;

type SidebarContextValue = {
  hidden: boolean;
  setHidden: Dispatch<SetStateAction<boolean>>;
  setHoveringSidebar: Dispatch<SetStateAction<boolean>>;
  floating: boolean;
  alwaysFloats: boolean;
};

const SidebarContext = createContext<SidebarContextValue>(null);

type SidebarProviderProps = {
  children: ReactNode;
};

export function SidebarProvider({ children }: SidebarProviderProps) {
  const [floatingSidebar] = useGlobalPref('floatingSidebar');
  const [hidden, setHidden] = useState(true);
  const { width } = useResponsive();
  const alwaysFloats = width < 668;
  const floating = floatingSidebar || alwaysFloats;
  const dispatch = useDispatch();

  // A dropdown menu opened from the sidebar (e.g. BudgetName's) renders in a
  // portal, outside the sidebar's own DOM subtree, so hovering it never
  // triggers the sidebar's onMouseOver/onMouseLeave. Track hover of the
  // sidebar and of any open popover separately, then derive `hidden` from
  // both combined, so the sidebar (and its menu) stay visible while either
  // is being used, and only hide together once neither is hovered anymore.
  const [hoveringSidebar, setHoveringSidebar] = useState(false);
  const [hoveringPopover, setHoveringPopover] = useState(false);

  useEffect(() => {
    function handlePointerOver(e: PointerEvent) {
      const target = e.target as Element | null;
      setHoveringPopover(!!target?.closest?.('[data-popover]'));
    }
    document.addEventListener('pointerover', handlePointerOver);
    return () => document.removeEventListener('pointerover', handlePointerOver);
  }, []);

  useLayoutEffect(() => {
    if (hoveringSidebar || hoveringPopover) {
      setHidden(false);
      return;
    }
    const timeout = setTimeout(() => setHidden(true), HOVER_HIDE_DELAY);
    return () => clearTimeout(timeout);
  }, [hoveringSidebar, hoveringPopover]);

  useEffect(() => {
    if (hidden && !hoveringPopover) {
      dispatch(closeContextMenu());
    }
  }, [hidden, hoveringPopover, dispatch]);

  return (
    <SidebarContext.Provider
      value={{ hidden, setHidden, setHoveringSidebar, floating, alwaysFloats }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const { hidden, setHidden, setHoveringSidebar, floating, alwaysFloats } =
    useContext(SidebarContext);

  return useMemo(
    () => ({ hidden, setHidden, setHoveringSidebar, floating, alwaysFloats }),
    [hidden, setHidden, setHoveringSidebar, floating, alwaysFloats],
  );
}
