import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id?: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

interface Props {
  onToken: (token: string) => void;
  onExpire?: () => void;
  className?: string;
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptLoading: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Turnstile"));
    document.head.appendChild(s);
  });
  return scriptLoading;
}

export function TurnstileWidget({ onToken, onExpire, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const siteKey = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || process.env.VITE_TURNSTILE_SITE_KEY) as string | undefined;

  useEffect(() => {
    if (!siteKey || !ref.current) return;
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          callback: (token: string) => onToken(token),
          "expired-callback": () => onExpire?.(),
          "error-callback": () => onExpire?.(),
          theme: "light",
          size: "compact",
        });
      })
      .catch((e) => console.error("[turnstile]", e));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* noop */ }
      }
    };
  }, [siteKey, onToken, onExpire]);

  if (!siteKey) {
    return (
      <div className={`text-xs text-muted-foreground ${className ?? ""}`}>
        Captcha not configured.
      </div>
    );
  }
  return <div ref={ref} className={`flex justify-center sm:justify-start ${className ?? ""}`} />;
}
