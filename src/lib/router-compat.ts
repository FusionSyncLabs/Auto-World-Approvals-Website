"use client";

import {
  useRouter as useNextRouter,
  usePathname as useNextPathname,
  useSearchParams as useNextSearchParams,
  useParams as useNextParams,
} from "next/navigation";
import { Link as UniversalLink } from "@/components/ui/link";

export { UniversalLink as Link };

export function useNavigate() {
  const router = useNextRouter();
  return (options: string | { to?: string; replace?: boolean; search?: Record<string, string> }) => {
    if (typeof options === "string") {
      router.push(options);
    } else if (options.to) {
      if (options.replace) {
        router.replace(options.to);
      } else {
        router.push(options.to);
      }
    }
  };
}

export function useRouter() {
  const router = useNextRouter();
  const pathname = useNextPathname();
  return {
    ...router,
    state: {
      location: {
        pathname,
      },
    },
    invalidate: () => router.refresh(),
  };
}

export function useRouterState<T>(config?: {
  select?: (state: { location: { pathname: string } }) => T;
}): T {
  const pathname = useNextPathname();
  const state = { location: { pathname } };
  if (config?.select) {
    return config.select(state);
  }
  return state as unknown as T;
}

export function useSearch(): Record<string, string> {
  const params = useNextSearchParams();
  const result: Record<string, string> = {};
  params?.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export function useParams(): Record<string, string> {
  return (useNextParams() || {}) as Record<string, string>;
}
