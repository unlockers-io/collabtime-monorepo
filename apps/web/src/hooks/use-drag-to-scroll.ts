import { type RefObject, useEffect, useState } from "react";

const useDragToScroll = (ref: RefObject<HTMLElement | null>) => {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    let isDown = false;
    let startY = 0;
    let scrollTopStart = 0;

    const onPointerDown = (e: PointerEvent) => {
      if (!e.isPrimary || e.button !== 0) {
        return;
      }
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // The element went away mid-gesture; without capture there is no
        // lostpointercapture to end the drag, so never start one.
        return;
      }
      isDown = true;
      startY = e.clientY;
      scrollTopStart = el.scrollTop;
      setIsDragging(true);
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) {
        return;
      }
      const dy = e.clientY - startY;
      el.scrollTop = scrollTopStart - dy;
    };

    /**
     * The only terminator: the spec fires lostpointercapture after implicit
     * release following both pointerup and pointercancel, so a browser taking
     * the gesture over for native scrolling still ends the drag. pointerup
     * alone left `isDown` true forever on touch.
     */
    const onLostPointerCapture = () => {
      isDown = false;
      setIsDragging(false);
    };

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("lostpointercapture", onLostPointerCapture);

    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("lostpointercapture", onLostPointerCapture);
    };
  }, [ref]);

  return { isDragging };
};

export { useDragToScroll };
