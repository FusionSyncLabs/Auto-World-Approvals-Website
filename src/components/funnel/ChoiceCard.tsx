"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChoiceCardProps {
  label: string;
  description?: string;
  badge?: string;
  icon?: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
}

export function ChoiceCard({
  label,
  description,
  badge,
  icon,
  selected,
  onClick,
}: ChoiceCardProps) {
  return (
    <button
      data-intake-choice
      type="button"
      aria-pressed={Boolean(selected)}
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-h-[64px] items-center justify-between rounded-2xl border-2 px-5 py-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:active:scale-[0.99]",
        selected
          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10 ring-2 ring-primary/20"
          : "border-border/80 bg-card hover:border-primary/50 hover:bg-slate-50/80 hover:shadow-sm"
      )}
    >
      <div className="flex min-w-0 items-center gap-3.5 pr-3">
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-colors",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-slate-100 text-slate-600 group-hover:bg-primary/10 group-hover:text-primary"
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display text-base font-bold text-foreground">
              {label}
            </span>
            {badge && (
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                {badge}
              </span>
            )}
          </div>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              {description}
            </p>
          )}
        </div>
      </div>

      <span
        data-choice-indicator
        aria-hidden
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card group-hover:border-primary/40"
        )}
      >
        {selected && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
      </span>
    </button>
  );
}
