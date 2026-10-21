import { useEffect } from "react";
import { useBranding } from "@/hooks/use-branding";

export function FaviconUpdater() {
  const { data } = useBranding();
  const url = data?.faviconUrl;

  useEffect(() => {
    if (!url || typeof document === "undefined") return;
    const selectors = ['link[rel="icon"]', 'link[rel="apple-touch-icon"]', 'link[rel="mask-icon"]'];
    selectors.forEach((sel) => {
      document.querySelectorAll<HTMLLinkElement>(sel).forEach((link) => {
        link.href = url;
        link.removeAttribute("type");
      });
    });
  }, [url]);

  return null;
}
