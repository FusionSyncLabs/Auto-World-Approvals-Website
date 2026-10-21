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
      className="relative min-w-0 rounded-3xl border border-slate-200/90 bg-card p-5 shadow-xl shadow-slate-200/50 sm:p-8 lg:p-10 animate-fade-in"
    >
      <div className="relative">
        <h1
          tabIndex={-1}
          data-step-heading
          className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl focus:outline-none"
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground sm:text-base leading-relaxed">
            {description}
          </p>
        )}
        <div className="mt-6 sm:mt-8">{children}</div>
        {footer && (
          <div className="mt-7 border-t border-border pt-5 sm:mt-8 sm:pt-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
