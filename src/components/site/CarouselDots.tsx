"use client";

import { useEffect, useRef, useState } from "react";

interface CarouselDotsProps {
  total: number;
  current: number;
  onSelect: (index: number) => void;
  label: "slide" | "page";
  dark?: boolean;
}

export function CarouselDots({ total, current, onSelect, label, dark = false }: CarouselDotsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleLimit, setVisibleLimit] = useState(6);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const selected = container.querySelector<HTMLButtonElement>('button[aria-current="true"]');
      const other = container.querySelector<HTMLButtonElement>('button:not([aria-current="true"])');
      const normalWidth = (other || selected)?.getBoundingClientRect().width || 24;
      const activeExtra = Math.max(0, (selected?.getBoundingClientRect().width || normalWidth) - normalWidth);
      const capacity = Math.max(1, Math.floor((container.clientWidth - activeExtra) / normalWidth));
      setVisibleLimit(Math.min(6, total, capacity));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [total, visibleLimit]);

  const active = Math.min(Math.max(current, 0), total - 1);
  // Keep the active position visible as larger carousels move through the list.
  const start = Math.max(0, Math.min(active - Math.floor((visibleLimit - 1) / 2), total - visibleLimit));

  return (
    <div ref={containerRef} className="flex min-w-0 flex-nowrap items-center justify-center">
      {Array.from({ length: Math.min(total, visibleLimit) }, (_, offset) => {
        const index = start + offset;
        const selected = index === active;
        return (
          <button
            key={index}
            type="button"
            aria-label={`Go to ${label} ${index + 1}`}
            aria-current={selected ? "true" : undefined}
            onClick={() => onSelect(index)}
            className={`group/dot flex h-11 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 ${
              selected ? "w-[32px]" : "w-[24px]"
            } ${dark ? "focus-visible:ring-white" : "focus-visible:ring-ring"} sm:w-11`}
          >
            <span
              aria-hidden="true"
              className={`h-2 rounded-full transition-all duration-300 ${
                selected
                  ? "w-[28px] bg-[var(--electric)] shadow-[0_0_10px_var(--electric)]"
                  : dark
                    ? "w-2 bg-white/20 group-hover/dot:bg-white/40"
                    : "w-2 bg-border group-hover/dot:bg-muted-foreground/40"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
