import { type RefObject, useEffect, useState } from "react";

const useDragToScroll = (ref: RefObject<HTMLElement | null>) => {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }

    let isDown = false;
    let startY = 0;
    let scrollTopStart = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDown = true;
      startY = e.clientY;
      scrollTopStart = el.scrollTop;
      el.setPointerCapture(e.pointerId);
      setIsDragging(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) {
        return;
      }
      const dy = e.clientY - startY;
      el.scrollTop = scrollTopStart - dy;
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDown) {
        return;
      }
      isDown = false;
      el.releasePointerCapture(e.pointerId);
      setIsDragging(false);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
    };
  }, [ref]);

  return { isDragging };
};

export { useDragToScroll };
