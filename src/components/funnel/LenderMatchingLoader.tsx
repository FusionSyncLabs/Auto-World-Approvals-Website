"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck, Car, Building2, BadgePercent, Search, Loader2 } from "lucide-react";

interface LenderMatchingLoaderProps {
  onComplete: () => void;
}

export function LenderMatchingLoader({ onComplete }: LenderMatchingLoaderProps) {
  const [progress, setProgress] = useState(15);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setProgress(45);
      setStage(1);
    }, 700);

    const t2 = setTimeout(() => {
      setProgress(80);
      setStage(2);
    }, 1500);

    const t3 = setTimeout(() => {
      setProgress(100);
      setStage(3);
    }, 2200);

    const t4 = setTimeout(() => {
      onComplete();
    }, 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  const items = [
    { label: "Verifying vehicle preferences & budget", icon: Car },
    { label: "Matching 30+ lenders in British Columbia & Alberta", icon: Building2 },
    { label: "Calculating pre-qualification interest tiers", icon: BadgePercent },
  ];

  return (
    <div className="rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-card p-5 sm:p-10 shadow-xl shadow-slate-200/50 text-center animate-fade-in">
      {/* High-End Fintech Orbital Radar Loader */}
      <div className="relative mx-auto mb-5 sm:mb-6 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center">
        {/* Soft pulsing ambient aura */}
        <span
          className="absolute inset-0 rounded-full bg-primary/15 animate-ping opacity-60"
          style={{ animationDuration: "2s" }}
        />

        {/* Outer glowing orbital track */}
        <div className="absolute inset-0 rounded-full border-2 border-slate-200 dark:border-slate-800" />

        {/* Spinning gradient ring */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-[var(--electric)] animate-spin"
          style={{ animationDuration: "1.1s" }}
        />

        {/* Core animated icon container */}
        <div className="relative flex h-11 w-11 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[var(--navy)] text-white shadow-lg shadow-primary/25">
          <Search className="h-5 w-5 sm:h-6 sm:w-6 animate-pulse text-white" />
        </div>
      </div>

      <h2 className="font-display text-xl sm:text-3xl font-extrabold text-foreground">
        Matching Your Financing Options
      </h2>
      <p className="mx-auto mt-1.5 sm:mt-2 max-w-md text-xs sm:text-base text-muted-foreground">
        Connecting your inquiry with certified dealer-finance partners in Western Canada...
      </p>

      {/* Progress bar */}
      <div className="mx-auto mt-6 sm:mt-8 max-w-md">
        <div className="mb-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Search in progress
          </span>
          <span className="text-primary font-bold text-xs sm:text-sm">{progress}%</span>
        </div>
        <div className="h-2 sm:h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 via-[var(--electric)] to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Checklist */}
      <div className="mx-auto mt-6 sm:mt-8 max-w-sm space-y-2 sm:space-y-3 text-left">
        {items.map((it, i) => {
          const isDone = stage > i;
          const isCurrent = stage === i;
          const Icon = it.icon;

          return (
            <div
              key={it.label}
              className={`flex items-center gap-2.5 sm:gap-3 rounded-xl border p-2.5 sm:p-3 transition-all duration-300 ${
                isDone
                  ? "border-emerald-500/30 bg-emerald-500/5 text-foreground dark:border-emerald-900/60 dark:bg-emerald-950/20"
                  : isCurrent
                  ? "border-primary/50 bg-primary/5 text-foreground shadow-sm ring-1 ring-primary/20"
                  : "border-border/50 bg-card/40 text-muted-foreground opacity-60"
              }`}
            >
              {isDone ? (
                <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 sm:h-4.5 sm:w-4.5 stroke-[2.2]" />
                </div>
              ) : isCurrent ? (
                <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-primary" />
                </div>
              ) : (
                <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </div>
              )}
              <span className="text-xs sm:text-sm font-semibold leading-tight">{it.label}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 sm:mt-8 flex items-center justify-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs font-medium text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-600 shrink-0" />
        <span>100% Free · No credit check required · No obligation</span>
      </div>
    </div>
  );
}
