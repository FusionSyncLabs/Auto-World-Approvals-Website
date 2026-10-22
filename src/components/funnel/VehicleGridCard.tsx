"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface VehicleGridCardProps {
  label: string;
  badge?: string;
  imageSrc: string | { src: string } | any;
  selected?: boolean;
  onClick: () => void;
}

export function VehicleGridCard({
  label,
  badge,
  imageSrc,
  selected,
  onClick,
}: VehicleGridCardProps) {
  const imgSrc = typeof imageSrc === "string" ? imageSrc : imageSrc?.src || "";
  return (
    <button
      type="button"
      data-intake-choice
      aria-pressed={Boolean(selected)}
      onClick={onClick}
      className={cn(
        "group relative flex min-w-0 flex-col items-center justify-between rounded-xl sm:rounded-2xl border-2 p-3 sm:p-4 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]",
        selected
          ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-2 ring-primary/20"
          : "border-border/80 bg-card hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg hover:shadow-slate-200/50"
      )}
    >
      <div className="flex w-full min-w-0 items-start justify-between gap-2">
        {badge && (
          <span className="min-w-0 rounded-full bg-primary/10 px-2 py-0.5 text-left text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-primary [overflow-wrap:anywhere]">
            {badge}
          </span>
        )}

        <span
          aria-hidden
          className={cn(
            "ml-auto flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card group-hover:border-primary/40"
          )}
        >
          {selected && <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[2.5]" />}
        </span>
      </div>

      <div className="my-1.5 sm:my-2 flex h-20 sm:h-24 w-full items-center justify-center">
        <img
          src={imgSrc}
          alt={label}
          className="max-h-16 sm:max-h-20 w-auto max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
          loading="eager"
        />
      </div>

      <span className="mt-0.5 sm:mt-1 block max-w-full font-display text-xs sm:text-base font-bold text-foreground leading-snug [overflow-wrap:anywhere]">
        {label}
      </span>
    </button>
  );
}
