import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const HERO_SLOTS = [
  { key: "hero_image_url", label: "Hero background", aspect: "16/9" as const },
  { key: "hero_cat_suv_url", label: "Category — SUV / Crossover", aspect: "5/3" as const },
  { key: "hero_cat_truck_url", label: "Category — Truck", aspect: "5/3" as const },
  { key: "hero_cat_sedan_url", label: "Category — Sedan", aspect: "5/3" as const },
  { key: "hero_cat_ev_url", label: "Category — Electric / Hybrid", aspect: "5/3" as const },
  { key: "hero_why_url", label: "Why Us — Keys handoff", aspect: "1/1" as const },
] as const;

export type HeroSlotKey = (typeof HERO_SLOTS)[number]["key"];

export function useBranding() {
  return useQuery({
    queryKey: ["branding"],
    queryFn: async () => {
      const keys = [
        "favicon_url",
        "logo_url",
        "logo_url_light",
        "logo_url_dark",
        ...HERO_SLOTS.map((s) => s.key),
      ];
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", keys);
      if (error) throw error;
      const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
      const str = (v: unknown) => (typeof v === "string" ? v : "");
      return {
        faviconUrl: str(m.favicon_url),
        logoUrl: str(m.logo_url),
        logoUrlLight: str(m.logo_url_light) || str(m.logo_url),
        logoUrlDark: str(m.logo_url_dark) || str(m.logo_url_light) || str(m.logo_url),
        heroImageUrl: str(m.hero_image_url),
        heroSlots: Object.fromEntries(
          HERO_SLOTS.map((s) => [s.key, str(m[s.key])]),
        ) as Record<HeroSlotKey, string>,
      };
    },
    staleTime: 30 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}
