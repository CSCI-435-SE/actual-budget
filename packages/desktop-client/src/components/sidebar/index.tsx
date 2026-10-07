import React, { useState } from 'react';

import { useResponsive } from '@actual-app/components/hooks/useResponsive';
import { View } from '@actual-app/components/view';

import { useResizeObserver } from '#hooks/useResizeObserver';

import { Sidebar } from './Sidebar';
import { SIDEBAR_TRANSITION_MS, useSidebar } from './SidebarProvider';

export function FloatableSidebar() {
  const sidebar = useSidebar();
  const { isNarrowWidth } = useResponsive();
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const sidebarRef = useResizeObserver<HTMLDivElement>(rect => {
    setSidebarWidth(rect.width);
  });

  const sidebarShouldFloat = sidebar.floating;
  // A reflowing sidebar stays in the flex layout next to the main content and
  // collapses its own width while hidden, so the content resizes alongside it.
  const sidebarReflows = sidebar.reflows;
  const transition = `${SIDEBAR_TRANSITION_MS}ms`;

  return isNarrowWidth ? null : (
    <View
      onMouseOver={
        sidebarShouldFloat
          ? e => {
              e.stopPropagation();
              sidebar.setHoveringSidebar(true);
            }
          : undefined
      }
      onMouseLeave={
        sidebarShouldFloat ? () => sidebar.setHoveringSidebar(false) : undefined
      }
      style={{
        position:
          sidebarShouldFloat && !sidebarReflows ? 'absolute' : undefined,
        top: 8,
        // If not floating, the -50 takes into account the transform below
        bottom: sidebarShouldFloat ? 8 : -50,
        ...(sidebarReflows && {
          flexShrink: 0,
          marginTop: 8,
          marginBottom: 8,
          marginRight: sidebar.hidden ? -sidebarWidth : 0,
        }),
        zIndex: 1001,
        borderRadius: sidebarShouldFloat ? '0 6px 6px 0' : 0,
        overflow: 'hidden',
        boxShadow:
          !sidebarShouldFloat || sidebar.hidden
            ? 'none'
            : '0 15px 30px 0 rgba(0,0,0,0.25), 0 3px 15px 0 rgba(0,0,0,.5)',
        transform: `translateY(${!sidebarShouldFloat ? -8 : 0}px)
                      translateX(${
                        sidebarShouldFloat && sidebar.hidden ? '-100' : '0'
                      }%)`,
        transition: `transform ${transition}, box-shadow ${transition}, border-radius ${transition}, bottom ${transition}, margin-right ${transition}`,
      }}
    >
      <View innerRef={sidebarRef} style={{ flex: 1 }}>
        <Sidebar />
      </View>
    </View>
  );
}
