import { useRef, useCallback } from 'react';

export function useSheetSwipe(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.touches[0].clientY - rect.top > 76) return; // only handle+header zone
    startY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || !sheetRef.current) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0) {
      sheetRef.current.style.transform = `translateY(${dy}px)`;
      sheetRef.current.style.transition = 'none';
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    if (!sheetRef.current) return;
    if (dy > 100) {
      onClose();
    } else {
      sheetRef.current.style.transition = '';
      sheetRef.current.style.transform = '';
    }
  }, [onClose]);

  return { sheetRef, handleTouchStart, handleTouchMove, handleTouchEnd };
}
