import { isProductionHost } from "@/lib/prod-host";
import { safePagePath } from "@/lib/privacy-telemetry";
import { useEffect, useState, useCallback } from "react";
import { Link } from "@/components/ui/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Cookie, Shield, BarChart3, Megaphone, Sparkles } from "lucide-react";
import { META_ELIGIBILITY_VERIFIED, AD_NOTICE_TEXT } from "@/lib/ad-policy";
import { syncMetaPixel } from "@/lib/meta-pixel";
import {
  STORAGE_KEY,
  POLICY_VERSION,
  type Prefs,
  readPrefs,
  hasAdConsent,
  advertisingRecordId,
} from "@/lib/consent";

export { hasAdConsent, advertisingRecordId };

const DEFAULT_PREFS: Prefs = {
  necessary: true,
  functional: false,
  analytics: false,
  marketing: false,
  ts: 0,
  version: POLICY_VERSION,
};

function writePrefs(p: Prefs) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}


/** Apply consent to Google Analytics (Consent Mode v2) and Meta Pixel. */
function applyConsent(p: Prefs) {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    fbq?: ((...args: unknown[]) => void) & { callMethod?: unknown; queue?: unknown[]; loaded?: boolean; version?: string };
    _awaPixelLoaded?: boolean;
  };

  // Google Consent Mode v2
  w.dataLayer = w.dataLayer || [];
  const gtag = w.gtag || function (...args: unknown[]) {
    w.dataLayer?.push(args);
  };
  w.gtag = gtag;
  gtag("consent", "update", {
    ad_storage: p.marketing ? "granted" : "denied",
    ad_user_data: p.marketing ? "granted" : "denied",
    ad_personalization: p.marketing ? "granted" : "denied",
    analytics_storage: p.analytics ? "granted" : "denied",
    functionality_storage: p.functional ? "granted" : "denied",
    personalization_storage: p.functional ? "granted" : "denied",
    security_storage: "granted",
  });

  // Do not load analytics or automatically capture forms/URLs before consent.
  if (p.analytics && isProductionHost(window.location.hostname)) {
    const path = safePagePath(window.location.pathname);
    gtag("set", { page_location: window.location.origin + path, page_referrer: "" });
    gtag("config", "G-K1F6DQKNRK", { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
    if (!document.getElementById("awa-consented-ga")) {
      const script = document.createElement("script");
      script.id = "awa-consented-ga"; script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=G-K1F6DQKNRK";
      document.head.appendChild(script);
      if (path !== "/admin" && path !== "/crm") gtag("event", "page_view", { page_location: window.location.origin + path, page_referrer: "" });
    }
  }

  // Dataset eligibility is unresolved: no new Pixel or matching installation.
  // Revoke any already-loaded instance immediately, including other open tabs.
  if (w.fbq && (!p.marketing || !META_ELIGIBILITY_VERIFIED)) w.fbq("consent", "revoke");
  try {
    window.localStorage.removeItem("aw_ident");
    for (const name of ["aw_xid", "_fbp", "_fbc"]) {
      document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
      document.cookie = `${name}=; Path=/; Domain=.autoworldapprovals.com; Max-Age=0; SameSite=Lax`;
    }
  } catch { /* privacy remains denied when storage is unavailable */ }

}

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  useEffect(() => {
    const existing = readPrefs();
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (existing) {
      setPrefs(existing);
      applyConsent(existing);
      syncMetaPixel();
    } else {
      // Ensure a "denied" default is registered before any tracker fires.
      applyConsent(DEFAULT_PREFS);
      syncMetaPixel();
      timer = setTimeout(() => setVisible(true), 400);
    }
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      const next = readPrefs() || DEFAULT_PREFS;
      setPrefs(next);
      applyConsent(next);
      syncMetaPixel();
    };
    window.addEventListener("storage", sync);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("storage", sync);
    };
  }, []);

  useEffect(() => {
    const handler = () => setManageOpen(true);
    window.addEventListener("awa:open-cookie-preferences", handler);
    return () => window.removeEventListener("awa:open-cookie-preferences", handler);
  }, []);

  const persist = useCallback(async (next: Omit<Prefs, "ts" | "version" | "necessary" | "recordId">) => {
    const full: Prefs = {
      necessary: true,
      functional: next.functional,
      analytics: next.analytics,
      marketing: next.marketing,
      ts: Date.now(),
      version: POLICY_VERSION,
    };
    setPrefs(full);
    writePrefs(full);
    applyConsent(full);
    syncMetaPixel();
    setVisible(false);
    setManageOpen(false);
    try {
      const resp = await fetch("/api/ad-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advertising: full.marketing && !(navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl,
          analytics: full.analytics,
        }),
      });
      if (resp.ok) {
        const record = await resp.json();
        // Never let a delayed acceptance response overwrite a newer withdrawal.
        if (readPrefs()?.ts === full.ts) {
          const saved = { ...full, recordId: record.id };
          writePrefs(saved);
          setPrefs(saved);
          syncMetaPixel();
        }
      }
    } catch { /* no receipt means no advertising permission */ }
  }, []);


  const acceptAll = () => persist({ functional: true, analytics: true, marketing: true });
  const rejectAll = () => persist({ functional: false, analytics: false, marketing: false });
  const saveCustom = () =>
    persist({
      functional: prefs.functional,
      analytics: prefs.analytics,
      marketing: prefs.marketing,
    });

  return (
    <>
      {visible && !manageOpen && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="Cookie consent"
          className="fixed inset-x-3 bottom-3 z-[60] pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:left-5 sm:bottom-5 sm:w-[380px]"
        >
          <div className="max-h-[calc(100dvh-1.5rem-env(safe-area-inset-bottom))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg">
            <div className="flex items-start gap-2.5">
              <Cookie className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="min-w-0 break-words text-sm leading-snug text-muted-foreground">
                We use cookies to run this site and, with your OK, to improve it.{" "}
                <Link to="/cookies" className="font-medium text-foreground underline underline-offset-2">
                  Learn more
                </Link>
              </p>
            </div>
            <div className="mt-3 grid grid-cols-1 items-center gap-2 min-[360px]:grid-cols-3">
              <button
                type="button"
                onClick={() => setManageOpen(true)}
                className="min-h-11 min-w-0 [overflow-wrap:anywhere] rounded px-1 py-2 text-sm font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Manage
              </button>
              <Button variant="outline" size="sm" className="h-auto min-h-11 min-w-0 px-2" onClick={rejectAll}>
                Reject
              </Button>
              <Button size="sm" className="h-auto min-h-11 min-w-0 px-2" onClick={acceptAll}>
                Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="max-h-[85dvh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Cookie preferences</DialogTitle>
            <DialogDescription>
              Choose which categories of cookies you allow. Strictly necessary cookies cannot be
              disabled because the site cannot function without them. {AD_NOTICE_TEXT}{" "}
              See our <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <PrefRow
              icon={<Shield className="h-4 w-4" />}
              title="Strictly necessary"
              description="Required for security, sign-in, submission retry keys and privacy preferences. Application answers stay in memory until submission. Always on."
              checked
              disabled
            />
            <PrefRow
              icon={<Sparkles className="h-4 w-4" />}
              title="Functional"
              description="Remember preferences such as your selected province or vehicle category to personalize your experience."
              checked={prefs.functional}
              onChange={(v) => setPrefs((p) => ({ ...p, functional: v }))}
            />
            <PrefRow
              icon={<BarChart3 className="h-4 w-4" />}
              title="Analytics"
              description="Help us understand how visitors use the site (e.g. Google Analytics) so we can improve it. Aggregate data only."
              checked={prefs.analytics}
              onChange={(v) => setPrefs((p) => ({ ...p, analytics: v }))}
            />
            <PrefRow
              icon={<Megaphone className="h-4 w-4" />}
              title="Marketing & advertising"
              description="Optional advertising choice. Meta reporting remains disabled pending financing-data eligibility review; this does not authorize promotional email or SMS."
              checked={prefs.marketing}
              onChange={(v) => setPrefs((p) => ({ ...p, marketing: v }))}
            />
          </div>

          <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button variant="ghost" size="sm" className="h-auto min-h-11 min-w-0" onClick={rejectAll}>
              Reject non-essential
            </Button>
            <div className="grid min-w-0 grid-cols-1 gap-2 min-[390px]:grid-cols-2 sm:flex-1">
              <Button variant="outline" size="sm" className="h-auto min-h-11" onClick={acceptAll}>
                Accept all
              </Button>
              <Button size="sm" className="h-auto min-h-11" onClick={saveCustom}>
                Save preferences
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function PrefRow({
  icon,
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-card/50 p-3 ${disabled ? "cursor-default" : "cursor-pointer"}`}>
      <span className="flex min-w-0 items-start gap-2">
        <span className="mt-0.5 hidden sm:flex shrink-0 h-7 w-7 items-center justify-center rounded-md bg-muted text-foreground">
          {icon}
        </span>
        <span className="min-w-0 break-words">
          <span className="block text-sm font-medium">{title}</span>
          <span className="mt-0.5 block text-base leading-relaxed text-muted-foreground">{description}</span>
        </span>
      </span>
      <span className="flex min-h-11 min-w-11 items-center justify-center">
        <Switch
          checked={checked}
          disabled={disabled}
          onCheckedChange={(v) => onChange?.(Boolean(v))}
          aria-label={title}
        />
      </span>
    </label>
  );
}

/** Programmatic entry point for a "Cookie preferences" link (e.g. in the footer). */
export function openCookiePreferences() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("awa:open-cookie-preferences"));
}
