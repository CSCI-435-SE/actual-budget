// @ts-strict-ignore
import React, {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Dispatch, ReactNode, SetStateAction } from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';

import { closeContextMenu } from '#contextmenu/contextMenuSlice';
import { useGlobalPref } from '#hooks/useGlobalPref';
import { useDispatch } from '#redux';

const HOVER_HIDE_DELAY = 350;
const MENU_HOVER_OPEN_DELAY = 200;
export const SIDEBAR_TRANSITION_MS = 500;

type SidebarContextValue = {
  hidden: boolean;
  setHidden: Dispatch<SetStateAction<boolean>>;
  setHoveringSidebar: Dispatch<SetStateAction<boolean>>;
  onMenuButtonHoverStart: () => void;
  onMenuButtonHoverEnd: () => void;
  floating: boolean;
  alwaysFloats: boolean;
  reflows: boolean;
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
  // When floating by choice (not forced by a narrow window), the open sidebar
  // takes up layout space so the main content shrinks instead of being covered.
  const reflows = !!floatingSidebar && !alwaysFloats;
  const dispatch = useDispatch();

  // A dropdown menu opened from the sidebar (e.g. BudgetName's) renders in a
  // portal, outside the sidebar's own DOM subtree, so hovering it never
  // triggers the sidebar's onMouseOver/onMouseLeave. Track hover of the
  // sidebar and of any open popover separately, then derive `hidden` from
  // both combined, so the sidebar (and its menu) stay visible while either
  // is being used, and only hide together once neither is hovered anymore.
  const [hoveringSidebar, setHoveringSidebar] = useState(false);
  const [hoveringPopover, setHoveringPopover] = useState(false);
  const [hoveringMenuButton, setHoveringMenuButton] = useState(false);

  // While the sidebar animates open or closed, the titlebar's menu button
  // slides with the main content and can end up under a resting cursor.
  // Ignore menu button hovers until the animation finishes so that can't
  // start an open/close loop.
  const isAnimatingRef = useRef(false);
  const isFirstRenderRef = useRef(true);
  const menuHoverTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    isAnimatingRef.current = true;
    const timeout = setTimeout(() => {
      isAnimatingRef.current = false;
    }, SIDEBAR_TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [hidden]);

  useEffect(() => () => clearTimeout(menuHoverTimeoutRef.current), []);

  function onMenuButtonHoverStart() {
    if (isAnimatingRef.current) {
      return;
    }
    clearTimeout(menuHoverTimeoutRef.current);
    // Only open once the cursor rests on the button, so a mouse passing over
    // it on the way somewhere else doesn't open the sidebar.
    menuHoverTimeoutRef.current = setTimeout(() => {
      if (!isAnimatingRef.current) {
        setHoveringMenuButton(true);
      }
    }, MENU_HOVER_OPEN_DELAY);
  }

  function onMenuButtonHoverEnd() {
    clearTimeout(menuHoverTimeoutRef.current);
    setHoveringMenuButton(false);
  }

  useEffect(() => {
    function handlePointerOver(e: PointerEvent) {
      const target = e.target as Element | null;
      setHoveringPopover(!!target?.closest?.('[data-popover]'));
    }
    document.addEventListener('pointerover', handlePointerOver);
    return () => document.removeEventListener('pointerover', handlePointerOver);
  }, []);

  useLayoutEffect(() => {
    if (hoveringSidebar || hoveringPopover || hoveringMenuButton) {
      setHidden(false);
      return;
    }
    const timeout = setTimeout(() => setHidden(true), HOVER_HIDE_DELAY);
    return () => clearTimeout(timeout);
  }, [hoveringSidebar, hoveringPopover, hoveringMenuButton]);

  useEffect(() => {
    if (hidden && !hoveringPopover) {
      dispatch(closeContextMenu());
    }
  }, [hidden, hoveringPopover, dispatch]);

  return (
    <SidebarContext.Provider
      value={{
        hidden,
        setHidden,
        setHoveringSidebar,
        onMenuButtonHoverStart,
        onMenuButtonHoverEnd,
        floating,
        alwaysFloats,
        reflows,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const {
    hidden,
    setHidden,
    setHoveringSidebar,
    onMenuButtonHoverStart,
    onMenuButtonHoverEnd,
    floating,
    alwaysFloats,
    reflows,
  } = useContext(SidebarContext);

  return useMemo(
    () => ({
      hidden,
      setHidden,
      setHoveringSidebar,
      onMenuButtonHoverStart,
      onMenuButtonHoverEnd,
      floating,
      alwaysFloats,
      reflows,
    }),
    [
      hidden,
      setHidden,
      setHoveringSidebar,
      onMenuButtonHoverStart,
      onMenuButtonHoverEnd,
      floating,
      alwaysFloats,
      reflows,
    ],
  );
}
