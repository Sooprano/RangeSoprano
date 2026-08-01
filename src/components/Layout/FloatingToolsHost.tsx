import { createPortal } from 'react-dom';
import { useFloatingToolsStore } from '@/store/floatingToolsStore';
import { FloatingContent } from '@/modules/viewer/Floating/FloatingContent';

/**
 * Mounted once in AppLayout. Portals the floating tools content into the PiP
 * window managed by `floatingToolsStore`, so it persists across route changes
 * and can be opened from the sidebar. Renders nothing while no window is open.
 */
export function FloatingToolsHost() {
  const container = useFloatingToolsStore((s) => s.container);
  const close = useFloatingToolsStore((s) => s.close);

  if (!container) return null;
  return createPortal(<FloatingContent onClose={close} />, container);
}
