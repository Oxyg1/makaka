import { useRef, useCallback } from 'react';

/**
 * iOS-style свайп-вниз для закрытия шторок.
 *
 * Возвращает ref'ы на оверлей и саму шторку + touch-обработчики.
 * Жест стартует только из зоны «ручка + шапка» (верхние ~76px),
 * поэтому не конфликтует со скроллом контента и не требует
 * preventDefault (никаких passive-listener проблем).
 *
 * Двигаем ТОЛЬКО transform/opacity — всё на GPU, без layout.
 */
export function useSheetSwipe(onClose: () => void) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const lastY = useRef(0);
  const lastT = useRef(0);
  const vy = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const y = e.touches[0].clientY;
    if (y - rect.top > 76) return; // только зона ручки/шапки
    startY.current = y;
    lastY.current = y;
    lastT.current = Date.now();
    vy.current = 0;
    dragging.current = false;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current === null || !sheetRef.current) return;
    const y = e.touches[0].clientY;
    const dy = y - startY.current;
    const now = Date.now();
    const dt = now - lastT.current;
    if (dt > 0) vy.current = (y - lastY.current) / dt;
    lastY.current = y;
    lastT.current = now;
    if (dy <= 0) {
      // тянут вверх — лёгкое резиновое сопротивление
      sheetRef.current.style.transition = 'none';
      sheetRef.current.style.transform = `translateY(${dy * 0.18}px)`;
      return;
    }
    dragging.current = true;
    sheetRef.current.style.transition = 'none';
    sheetRef.current.style.transform = `translateY(${dy}px)`;
    if (overlayRef.current) {
      overlayRef.current.style.opacity = String(Math.max(0.15, 1 - dy / 620));
    }
  }, []);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.changedTouches[0].clientY - startY.current;
    startY.current = null;
    const sheet = sheetRef.current;
    if (!sheet) return;

    const shouldClose = dragging.current && (dy > 130 || vy.current > 0.55);
    if (shouldClose) {
      sheet.style.transition = 'transform 0.26s cubic-bezier(0.4,0,1,1)';
      sheet.style.transform = 'translateY(100%)';
      if (overlayRef.current) {
        overlayRef.current.style.transition = 'opacity 0.26s ease';
        overlayRef.current.style.opacity = '0';
      }
      window.setTimeout(onClose, 230);
    } else {
      sheet.style.transition = 'transform 0.34s cubic-bezier(0.22,1,0.36,1)';
      sheet.style.transform = '';
      if (overlayRef.current) {
        overlayRef.current.style.transition = 'opacity 0.22s ease';
        overlayRef.current.style.opacity = '';
      }
    }
    dragging.current = false;
  }, [onClose]);

  return {
    sheetRef,
    overlayRef,
    swipeHandlers: { onTouchStart, onTouchMove, onTouchEnd },
  };
}
