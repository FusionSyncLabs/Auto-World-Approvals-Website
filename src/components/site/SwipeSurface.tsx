"use client";

import { useRef, type ReactNode } from "react";
import { motion, type PanInfo } from "framer-motion";

interface SwipeSurfaceProps {
  children: ReactNode;
  enabled: boolean;
  onNext: () => void;
  onPrevious: () => void;
  onDraggingChange: (dragging: boolean) => void;
  className?: string;
}

export function SwipeSurface({ children, enabled, onNext, onPrevious, onDraggingChange, className = "" }: SwipeSurfaceProps) {
  const suppressClick = useRef(false);

  const finishSwipe = (event: MouseEvent | TouchEvent | PointerEvent, { offset, velocity }: PanInfo) => {
    onDraggingChange(false);
    if (!enabled || event.type === "pointercancel") return;
    const horizontal = Math.abs(offset.x) > Math.abs(offset.y);
    const intentional = Math.abs(offset.x) >= 40 || (Math.abs(offset.x) >= 12 && Math.abs(velocity.x) >= 500);
    if (!horizontal || !intentional) return;
    if (offset.x < 0) onNext();
    else onPrevious();
  };

  return (
    <div
      className={`overflow-hidden ${className}`}
      onPointerDownCapture={() => {
        suppressClick.current = false;
      }}
      onPointerCancelCapture={() => onDraggingChange(false)}
      onDragStartCapture={(event) => event.preventDefault()}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          if (event.detail > 0) {
            event.preventDefault();
            event.stopPropagation();
          }
        }
      }}
    >
      <motion.div
        drag={enabled ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        dragMomentum={false}
        onDragStart={() => onDraggingChange(true)}
        onDrag={(_event, { offset }) => {
          if (Math.abs(offset.x) >= 12 && Math.abs(offset.x) > Math.abs(offset.y)) suppressClick.current = true;
        }}
        onDragEnd={finishSwipe}
        whileDrag={{ cursor: "grabbing" }}
        className={enabled ? "touch-pan-y cursor-grab" : undefined}
      >
        {children}
      </motion.div>
    </div>
  );
}
