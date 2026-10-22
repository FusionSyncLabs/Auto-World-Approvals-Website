import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "@/styles.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0EA5E9",
};

export const metadata: Metadata = {
  title: "Auto World Approvals — Western Canada Vehicle Financing",
  description:
    "Start a short vehicle-financing inquiry for Western Canada. Free, no obligation, no SIN required.",
  authors: [{ name: "Auto World Approvals" }],
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    siteName: "Auto World Approvals",
    locale: "en_CA",
    title: "Auto World Approvals — Western Canada Vehicle Financing",
    description:
      "Start a short vehicle-financing inquiry for Western Canada. Free, no obligation, no SIN required.",
    type: "website",
    url: "https://autoworldapprovals.com",
  },
  twitter: {
    card: "summary_large_image",
    title: "Auto World Approvals — Western Canada Vehicle Financing",
    description:
      "Start a short vehicle-financing inquiry for Western Canada. Free, no obligation, no SIN required.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-screen bg-background font-sans antialiased text-foreground">
        <Script
          id="gtag-consent"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',functionality_storage:'denied',personalization_storage:'denied',security_storage:'granted'});gtag('js',new Date());`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Auto World Approvals",
              url: "https://autoworldapprovals.com",
              logo: "https://autoworldapprovals.com/icon-512.png",
              email: "admin@autoworldapprovals.com",
              areaServed: ["CA-BC", "CA-AB"],
              slogan: "Vehicle financing pre-qualification for Western Canada",
              sameAs: ["https://www.facebook.com/autoworldapprovals"],
            }),
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
