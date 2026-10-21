"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { FaviconUpdater } from "@/components/site/FaviconUpdater";
import { CookieConsent } from "@/components/site/CookieConsent";
import { captureAttribution } from "@/lib/attribution";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
          },
        },
      })
  );

  useEffect(() => {
    captureAttribution();
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.("a[href]");
      const href = a?.getAttribute("href") || "";
      if (href.startsWith("/apply") && !window.location.pathname.startsWith("/apply")) {
        import("@/lib/analytics").then((m) => m.trackGa("apply_cta_click"));
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <FaviconUpdater />
      <Toaster richColors position="top-right" />
      <CookieConsent />
    </QueryClientProvider>
  );
}
