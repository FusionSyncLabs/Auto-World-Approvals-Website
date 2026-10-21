"use client";

import React, { type ReactNode } from "react";

interface StepShellProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function StepShell({ title, description, children, footer }: StepShellProps) {
  return (
    <div
      data-step-shell
      className="relative min-w-0 rounded-2xl sm:rounded-3xl border border-slate-200/90 bg-card p-4 sm:p-8 lg:p-10 shadow-xl shadow-slate-200/50 animate-fade-in"
    >
      <div className="relative">
        <h1
          tabIndex={-1}
          data-step-heading
          className="font-display text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-foreground focus:outline-none text-center sm:text-left"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed text-center sm:text-left">
            {description}
          </p>
        )}
        <div className="mt-5 sm:mt-8">{children}</div>
        {footer && (
          <div className="mt-6 border-t border-border pt-4 sm:mt-8 sm:pt-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
