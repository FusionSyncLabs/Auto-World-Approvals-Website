import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { FaviconUpdater } from "@/components/site/FaviconUpdater";
import { CookieConsent } from "@/components/site/CookieConsent";
import { captureAttribution } from "@/lib/attribution";

import { getActiveFavicon } from "@/lib/logos.functions";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error("Website page failed; confidential details withheld");
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    try {
      return await getActiveFavicon();
    } catch {
      return { faviconUrl: "" };
    }
  },
  head: ({ loaderData }) => {
    const dynamicFavicon = (loaderData?.faviconUrl ?? "").trim();
    const iconLinks = dynamicFavicon
      ? [
          { rel: "icon", type: "image/png", href: dynamicFavicon },
          { rel: "shortcut icon", type: "image/png", href: dynamicFavicon },
          { rel: "apple-touch-icon", sizes: "180x180", href: dynamicFavicon },
        ]
      : [
          { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
          { rel: "icon", type: "image/png", sizes: "192x192", href: "/icon-192.png" },
          { rel: "icon", type: "image/png", sizes: "512x512", href: "/icon-512.png" },
          { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        ];
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "theme-color", content: "#0EA5E9" },
        { title: "Auto World Approvals — Western Canada Vehicle Financing" },
        { name: "description", content: "Start a short vehicle-financing inquiry for Western Canada. Free, no obligation, no SIN required." },
        { name: "google-site-verification", content: "gfQKBffRKhHkqKESzAkB1w_KbRvw_G8k2lCiPlfweUM" },
        { name: "author", content: "Auto World Approvals" },
        { name: "robots", content: "index,follow,max-image-preview:large,max-snippet:-1" },
        { property: "og:site_name", content: "Auto World Approvals" },
        { property: "og:locale", content: "en_CA" },
        { property: "og:title", content: "Auto World Approvals — Western Canada Vehicle Financing" },
        { property: "og:description", content: "Start a short vehicle-financing inquiry for Western Canada. Free, no obligation, no SIN required." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: "Auto World Approvals — Western Canada Vehicle Financing" },
        { name: "twitter:description", content: "Start a short vehicle-financing inquiry for Western Canada. Free, no obligation, no SIN required." },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        ...iconLinks,
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "Auto World Approvals",
            url: "https://autoworldapprovals.com",
            logo: "https://autoworldapprovals.com/icon-512.png",
            email: "admin@autoworldapprovals.com",
            areaServed: ["CA-BC", "CA-AB"],
            slogan: "Vehicle financing pre-qualification for Western Canada",
            sameAs: ["https://www.facebook.com/autoworldapprovals"],
            contactPoint: [{
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "admin@autoworldapprovals.com",
              areaServed: ["CA-BC", "CA-AB"],
              availableLanguage: ["English"],
            }],

          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Auto World Approvals",
            url: "https://autoworldapprovals.com",
            inLanguage: "en-CA",
          }),
        },
        {
          // Google Consent Mode v2 — set defaults to DENIED before any tag loads.
          // The CookieConsent component will call gtag('consent','update', ...) after the user chooses.
          children: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'denied',personalization_storage:'denied',security_storage:'granted'});gtag('js',new Date());`,
        },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  // Capture first-touch marketing attribution (UTMs, gclid, fbclid, referrer)
  // on whatever page the visitor first lands on.
  useEffect(() => {
    captureAttribution();
    // apply_cta_click: any link into the application, no parameters.
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
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <FaviconUpdater />
      <Toaster richColors position="top-right" />
      <CookieConsent />
    </QueryClientProvider>
  );
}
