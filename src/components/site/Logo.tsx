"use client";

import React, { useState } from "react";
import { Link } from "@/components/ui/link";
import { useBranding } from "@/hooks/use-branding";

interface LogoProps {
  /**
   * `default` → for use on light backgrounds (renders the dark/colored logo).
   * `light`   → for use on dark backgrounds (renders the light/white logo).
   */
  variant?: "default" | "light";
  className?: string;
  showWordmark?: boolean;
}

export function Logo({ variant = "default", className = "" }: LogoProps) {
  const { data } = useBranding();
  const onDark = variant === "light";
  const [imgError, setImgError] = useState(false);

  // If a valid custom logo URL is uploaded and doesn't point to dead cloud paths:
  const remoteLogo = (onDark ? data?.logoUrlDark : data?.logoUrlLight) || data?.logoUrl;
  const validRemoteLogo = remoteLogo && !remoteLogo.startsWith("/__l5e/") ? remoteLogo : null;

  const [currentSrc, setCurrentSrc] = useState<string>(validRemoteLogo || "/logo.png");
  const [allFailed, setAllFailed] = useState(false);

  React.useEffect(() => {
    if (validRemoteLogo) {
      setCurrentSrc(validRemoteLogo);
    }
  }, [validRemoteLogo]);

  const handleError = () => {
    if (currentSrc !== "/logo.png") {
      // Fallback to local official HD logo
      setCurrentSrc("/logo.png");
    } else {
      // If even /logo.png fails, show wordmark icon
      setAllFailed(true);
    }
  };

  return (
    <Link
      to="/"
      className={`group inline-flex min-w-0 items-center gap-2.5 font-display font-bold ${className}`}
      aria-label="Auto World Approvals — Home"
    >
      {!allFailed ? (
        <img
          src={currentSrc}
          alt="Auto World Approvals"
          width={280}
          height={70}
          onError={handleError}
          className="h-11 md:h-14 w-auto max-w-[240px] md:max-w-[280px] object-contain bg-transparent transition-transform duration-300 motion-safe:group-hover:scale-105"
        />
      ) : (
        <div className="flex items-center gap-2.5">
          <img
            src="/brand-icon.png"
            alt="Auto World Approvals"
            width={36}
            height={36}
            className="h-9 w-9 object-contain rounded-lg shadow-sm transition-transform duration-300 group-hover:scale-105"
          />
          <div className="flex flex-col leading-none">
            <span className={`font-display text-lg font-black tracking-tight ${onDark ? "text-white" : "text-[var(--navy)] dark:text-white"}`}>
              AUTO WORLD
            </span>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.25em] text-[var(--electric)]">
              APPROVALS
            </span>
          </div>
        </div>
      )}
    </Link>
  );
}
