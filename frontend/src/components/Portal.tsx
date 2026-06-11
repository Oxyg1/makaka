import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/** Renders children at document.body so modals escape any backdrop-filter
 *  parent (which would otherwise turn into a containing block for `position: fixed`). */
export default function Portal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
