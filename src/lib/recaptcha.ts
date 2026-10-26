declare global {
  interface Window {
    grecaptcha?: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

/**
 * Dynamically loads the Google reCAPTCHA v3 script once if site key is configured.
 */
export function loadRecaptchaScript(siteKey: string): Promise<void> {
  if (typeof window === "undefined" || !siteKey || siteKey === "your_recaptcha_site_key_here") {
    return Promise.resolve();
  }
  if (window.grecaptcha) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="google.com/recaptcha/api.js"]');
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google reCAPTCHA script."));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/**
 * Executes reCAPTCHA v3 and returns the verification token.
 */
export async function executeRecaptcha(action = "contact_form"): Promise<string | null> {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (!siteKey || siteKey === "your_recaptcha_site_key_here" || typeof window === "undefined") {
    return null;
  }

  const tokenPromise = (async () => {
    try {
      await loadRecaptchaScript(siteKey);
      return await new Promise<string | null>((resolve) => {
        if (!window.grecaptcha) {
          resolve(null);
          return;
        }
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha!.execute(siteKey, { action });
            resolve(token);
          } catch (err) {
            console.error("[recaptcha] execute error", err);
            resolve(null);
          }
        });
      });
    } catch (err) {
      console.error("[recaptcha] load error", err);
      return null;
    }
  })();

  const timeoutPromise = new Promise<string | null>((resolve) => {
    setTimeout(() => {
      console.warn("[recaptcha] token fetch timed out after 3.5s; continuing without token");
      resolve(null);
    }, 3500);
  });

  return Promise.race([tokenPromise, timeoutPromise]);
}
