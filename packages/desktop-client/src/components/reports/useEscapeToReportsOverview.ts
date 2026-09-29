import { useHotkeys } from 'react-hotkeys-hook';
import { useLocation } from 'react-router';

import { useNavigate } from '#hooks/useNavigate';

// Modals, popovers, autocompletes and date pickers dismiss themselves on
// Escape, so backing out of the report must wait until they are closed.
function isOverlayOpen() {
  return document.querySelector('[data-popover], [role="dialog"]') !== null;
}

export function useEscapeToReportsOverview() {
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromOverview = Boolean(location.state?.goBack);

  useHotkeys(
    'escape',
    () => {
      if (cameFromOverview) {
        // Return to the dashboard the report was opened from
        void navigate(-1);
      } else {
        void navigate('/reports');
      }
    },
    {
      scopes: ['app'],
      ignoreEventWhen: e => e.defaultPrevented || isOverlayOpen(),
    },
    [navigate, cameFromOverview],
  );
}
