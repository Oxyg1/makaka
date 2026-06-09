import { useRef, useCallback } from 'react';

const DISMISS_THRESHOLD = 100;
const VELOCITY_THRESHOLD = 0.6;

export function useSheetSwipe(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const startT = useRef<number>(0);
  const lastY = useRef<number>(0);
  const lastT = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.touches[0].clientY - rect.top > 76) return;
    startY.current = e.touches[0].clientY;
    startT.current = performance.now();
    lastY.current = startY.current;
    lastT.current = startT.current;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || !sheetRef.current) return;
    const y = e.touches[0].clientY;
    const dy = y - startY.current;
    lastY.current = y;
    lastT.current = performance.now();
    if (dy >= 0) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    } else {
      // rubber-band when pulling up past top
      const eased = -Math.pow(-dy, 0.7);
      sheetRef.current.style.transform = `translateY(${eased}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;
    const endY = e.changedTouches[0].clientY;
    const dy = endY - startY.current;
    const dt = Math.max(1, performance.now() - lastT.current + 16);
    const velocity = (endY - lastY.current) / dt;
    startY.current = null;
    if (!sheetRef.current) return;
    if (dy > DISMISS_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      onClose();
    } else {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
    }
  }, [onClose]);

  return { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd };
}
