"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { metaTrack, syncMetaPixel } from "@/lib/meta-pixel";

export function MetaPageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const first = useRef(true);

  useEffect(() => {
    syncMetaPixel();
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (!pathname) return;
    if (pathname.startsWith("/admin") || pathname.startsWith("/crm")) return;
    metaTrack("PageView");
  }, [pathname, searchParams]);

  return null;
}
