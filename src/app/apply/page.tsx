"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, AlertCircle, Info, ShieldCheck, Zap, Car, Sparkles, Check } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { Link } from "@/components/ui/link";
import { cn } from "@/lib/utils";
import { getTracking } from "@/lib/attribution";
import { trackGa } from "@/lib/analytics";
import { hasAdConsent, advertisingRecordId } from "@/components/site/CookieConsent";
import { META_ELIGIBILITY_VERIFIED } from "@/lib/ad-policy";
import { isBlockedRegion, BLOCKED_PROVINCES, EASTERN_REGION_MESSAGE } from "@/lib/phone";
import { ChoiceCard } from "@/components/funnel/ChoiceCard";
import { VehicleGridCard } from "@/components/funnel/VehicleGridCard";
import { LenderMatchingLoader } from "@/components/funnel/LenderMatchingLoader";
import { StepShell } from "@/components/funnel/StepShell";
import { IntakeReview } from "@/components/funnel/IntakeReview";
import {
  VehicleSchema,
  BudgetSchema,
  EmploymentSchema,
  IncomeSchema,
  ContactSchema,
  IntakeSubmissionSchema,
  dateOfBirthError,
} from "@/lib/funnel/intake-validation";
import { DobInput } from "@/components/funnel/DobInput";
import {
  VEHICLE_TYPES,
  BUDGETS,
  YES_NO,
  EMPLOYMENT,
  PAY_FREQUENCIES,
  TIME_LENGTHS,
  PROVINCES,
  INDUSTRIES,
  incomeRanges,
  VEHICLE_CONDITIONS,
  DOWN_PAYMENTS,
  TRADE_IN,
  PURCHASE_TIMELINES,
  type ChoiceOption,
  type FunnelData,
  type StepId,
  getSteps,
  NON_QUALIFYING_EMPLOYMENT,
  type FunnelVariant,
} from "@/lib/funnel/schema";

const TOKEN_KEY = "awa.intake_submission_key.v2";
const LOCAL_DATA_KEY = "awa.application.v3";

function ApplyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const vt = searchParams?.get("vt");

  const [data, setData] = useState<FunnelData>({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [variant, setVariant] = useState<FunnelVariant>("A");
  const submitLock = useRef(false);
  const submissionKey = useRef<string | null>(null);
  const dataRef = useRef<FunnelData>({});
  dataRef.current = data;
  const completedStepsRef = useRef(new Set<string>());
  const steps = useMemo(() => getSteps(data), [data]);
  const currentStep = steps[Math.min(idx, steps.length - 1)];
  const progressPercent = Math.round((idx / steps.length) * 100);

  useEffect(() => {
    if (!hydrated) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
  }, [currentStep, hydrated]);

  useEffect(() => {
    try {
      localStorage.removeItem(LOCAL_DATA_KEY);
      localStorage.removeItem("awa.draft_token.v1");
      submissionKey.current = sessionStorage.getItem(TOKEN_KEY);
      if (!submissionKey.current || !/^[0-9a-f-]{36}$/i.test(submissionKey.current)) {
        submissionKey.current = crypto.randomUUID();
        sessionStorage.setItem(TOKEN_KEY, submissionKey.current);
      }
      localStorage.setItem("awa.application_started_v1", "true");
    } catch {
      submissionKey.current = crypto.randomUUID();
    }
    const selected = vt === "ev" ? "ev_hybrid" : vt;
    if (selected && VEHICLE_TYPES.some((o) => o.value === selected)) {
      setData({ vehicle_type: selected });
    }
    setVariant(readVariant());
    setHydrated(true);
  }, [vt]);

  const update = useCallback((patch: Partial<FunnelData>) => {
    dataRef.current = { ...dataRef.current, ...patch };
    setData(dataRef.current);
    setErrorMsg(null);
  }, []);

  const next = () => {
    if (!completedStepsRef.current.has(currentStep)) {
      if (completedStepsRef.current.size === 0) trackGa("application_start", { form_variant: variant });
      completedStepsRef.current.add(currentStep);
      trackGa("application_step_complete", { step_number: idx + 1, step_name: currentStep, form_variant: variant });
    }
    setIdx((i) => Math.min(i + 1, steps.length - 1));
  };

  const back = () => setIdx((i) => Math.max(0, i - 1));

  const handleSubmit = async (patch: Partial<FunnelData>) => {
    if (submitLock.current) return;
    const merged = { ...dataRef.current, ...patch };
    const { consent_accuracy, consent_contact, consent_not_guarantee, consent_marketing, ...answers } = merged;
    const key = submissionKey.current;
    if (!key) {
      setErrorMsg("Please refresh before submitting.");
      return;
    }
    const input = {
      idempotency_key: key,
      answers,
      consents: {
        consent_accuracy,
        consent_contact,
        consent_not_guarantee,
        consent_marketing: consent_marketing === true,
      },
      tracking: readTracking(),
      ad_consent: hasAdConsent(),
      advertising_consent_id: advertisingRecordId(),
    };
    const parsed = IntakeSubmissionSchema.safeParse(input);
    if (!parsed.success) {
      setErrorMsg(parsed.error.issues[0]?.message || "Please check your answers.");
      return;
    }
    submitLock.current = true;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Unable to submit. Please try again.");
      }
      const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
      if (META_ELIGIBILITY_VERIFIED && hasAdConsent() && fbq && !result.duplicate && !result.is_test) {
        fbq("track", "Lead", {}, { eventID: result.event_id });
      }
      if (!result.duplicate) trackGa("generate_lead", { form_variant: variant });
      try {
        sessionStorage.removeItem(TOKEN_KEY);
      } catch {
        /* storage unavailable */
      }
      router.push(`/thank-you?id=${result.id}`);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Unable to submit. Your answers are still here; please try again.");
      trackGa("application_error", { error_code: "submit_failed", form_variant: variant });
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-soft">
      {/* Canada Drives Modern Sticky Header */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-2">
            <Logo />
          </div>

          <div className="flex items-center gap-3">
            <Link href="/" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              Exit
            </Link>
          </div>
        </div>

        {/* Animated Gradient Progress Bar */}
        <div
          className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Micro-Progress Subheader */}
        <div className="container mx-auto flex items-center justify-end px-4 py-1.5 text-xs font-semibold text-muted-foreground">
          <span className="text-primary font-bold">{progressPercent}% Complete</span>
        </div>

        <p aria-live="polite" aria-atomic="true" className="sr-only">
          Step {idx + 1} of {steps.length} · {stepLabel(currentStep)}
        </p>
      </header>

      <main data-private data-clarity-mask="true" className="container mx-auto px-4 py-8 lg:px-8 lg:py-12 ph-no-capture">
        <div className="mx-auto w-full max-w-[640px]">
          {matching ? (
            <LenderMatchingLoader
              onComplete={() => {
                setMatching(false);
                next();
              }}
            />
          ) : NON_QUALIFYING_EMPLOYMENT.has(data.employment_status || "") ? (
            <NotQualified onBack={back} />
          ) : currentStep === "review" ? (
            <IntakeReview
              data={data}
              update={update}
              onBack={back}
              onEdit={(step) => {
                const index = steps.indexOf(step);
                if (index >= 0) setIdx(index);
              }}
              onSubmit={handleSubmit}
              submitting={submitting}
              errorMsg={errorMsg}
            />
          ) : (
            <StepRenderer
              key={currentStep}
              step={currentStep}
              data={data}
              update={update}
              onNext={next}
              onBack={back}
              canBack={idx > 0}
              provinceLabel={PROVINCES.find((o) => o.value === data.province)?.label || "Western Canada"}
              onNameContinue={(patch) => {
                update(patch);
                next();
              }}
              onSubmit={(patch) => {
                update(patch);
                setMatching(true);
              }}
              submitting={submitting}
              errorMsg={errorMsg}
            />
          )}

          <nav aria-label="Application legal documents" className="mt-6 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Privacy Policy
            </Link>
            <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Terms of Use
            </Link>
            <Link href="/consent" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Consent
            </Link>
            <button
              type="button"
              className="underline hover:text-foreground cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit"
              onClick={() => window.dispatchEvent(new Event("awa:open-cookie-preferences"))}
            >
              Cookie Preferences
            </button>
          </nav>
        </div>
      </main>
    </div>
  );
}

export default function ApplyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-soft flex items-center justify-center p-8 text-muted-foreground">Loading application...</div>}>
      <ApplyForm />
    </Suspense>
  );
}

const VARIANT_KEY = "aw_funnel_variant_v1";
function readVariant(): FunnelVariant {
  try {
    const v = localStorage.getItem(VARIANT_KEY);
    if (v === "A" || v === "B") return v;
    const pick: FunnelVariant = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem(VARIANT_KEY, pick);
    return pick;
  } catch {
    return "A";
  }
}

function readTracking() {
  if (typeof window === "undefined") return {};
  return { ...getTracking(), funnel_variant: readVariant() };
}

function formatPostal(v: string): string {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3)}`;
}

function inferProvinceFromPostal(postal: string): string | undefined {
  const c = postal.trim().toUpperCase().charAt(0);
  const first3 = postal.trim().toUpperCase().replace(/\s/g, "").slice(0, 3);
  if (first3 === "X0A" || first3 === "X0G") return "NU";
  if (first3.startsWith("X")) return "NT";
  const map: Record<string, string> = {
    A: "NL", B: "NS", C: "PE", E: "NB", G: "QC", H: "QC", J: "QC",
    K: "ON", L: "ON", M: "ON", N: "ON", P: "ON",
    R: "MB", S: "SK", T: "AB", V: "BC", Y: "YT",
  };
  return map[c];
}

interface StepProps {
  step: StepId;
  data: FunnelData;
  update: (p: Partial<FunnelData>) => void;
  onNext: () => void;
  onBack: () => void;
  canBack: boolean;
  provinceLabel: string;
  onNameContinue: (p: Partial<FunnelData>) => void;
  onSubmit: (p: Partial<FunnelData>) => void;
  submitting: boolean;
  errorMsg: string | null;
}

function StepRenderer({
  step,
  data,
  update,
  onNext,
  onBack,
  canBack,
  onSubmit,
  submitting,
  errorMsg,
}: StepProps) {
  const validation = useMemo(() => getStepValidation(step, data), [step, data]);
  const [showErrors, setShowErrors] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = useCallback((key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), []);

  useEffect(() => {
    if (showErrors && validation.valid) setShowErrors(false);
  }, [showErrors, validation.valid]);

  const handleNext = () => {
    if (validation.valid) {
      setShowErrors(false);
      onNext();
    } else {
      setShowErrors(true);
      setTouched((t) => {
        const nextMap = { ...t };
        for (const k of validation.missingKeys) nextMap[k] = true;
        return nextMap;
      });
      if (typeof document !== "undefined" && validation.missingKeys.length > 0) {
        const el = document.querySelector<HTMLElement>(
          `[data-field="${validation.missingKeys[0]}"] input, [data-field="${validation.missingKeys[0]}"] select`
        );
        el?.focus();
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const missingSet = new Set(validation.missingKeys);
  const fieldError = (key: string) => (touched[key] || showErrors) && missingSet.has(key);
  const fieldMessage = (key: string) => validation.messages[key] || "This field is required";

  // Footer for manual input steps: has validation alerts, Back, and prominent Continue button
  const inputFooter = (
    <div className="space-y-3">
      {showErrors && !validation.valid && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive bg-background px-3 py-2 text-sm text-destructive animate-fade-in">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {validation.missingLabels.length === 1 ? (
              <>Almost there — just need your <strong>{validation.missingLabels[0]}</strong>.</>
            ) : (
              <>Almost there — just need your <strong>{validation.missingLabels.join(", ")}</strong>.</>
            )}
          </span>
        </div>
      )}
      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <Button variant="ghost" onClick={onBack} disabled={!canBack} className="h-11 sm:h-10">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="hero" size="lg" onClick={handleNext} className="h-14 w-full text-base sm:h-11 sm:w-auto sm:min-w-[170px] sm:text-sm">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  // Footer for 1-tap choice steps: clean Back link and helper note
  const autoAdvanceFooter = (
    <div className="flex items-center justify-between pt-1">
      {canBack ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground h-9 px-2 text-xs font-semibold gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
      ) : (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-9 px-2 text-xs font-semibold gap-1.5"
        >
          <Link href="/">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
          </Link>
        </Button>
      )}
      <span className="text-xs text-muted-foreground/70 font-medium">
        Tap any option to continue
      </span>
    </div>
  );

  const choice = (field: keyof FunnelData, options: ChoiceOption[], autoAdvance = true) => (
    <div className="grid gap-3">
      {options.map((o) => (
        <ChoiceCard
          key={o.value}
          label={o.label}
          description={o.description}
          selected={data[field] === o.value}
          onClick={() => {
            update({ [field]: o.value } as Partial<FunnelData>);
            if (field === "vehicle_type") trackGa("vehicle_type_select", { step_name: "vehicle_type" });
            if (autoAdvance) setTimeout(onNext, 220);
          }}
        />
      ))}
    </div>
  );

  switch (step) {
    case "vehicle_type": {
      const vehicleCards = [
        { value: "suv", label: "SUV / Crossover", image: "/vehicles/selection-suv.webp", badge: "Most Popular" },
        { value: "truck", label: "Truck", image: "/vehicles/selection-truck.webp", badge: "Work Ready" },
        { value: "car", label: "Sedan / Car", image: "/vehicles/selection-car.webp", badge: "Fuel Saver" },
        { value: "van", label: "Van / Minivan", image: "/vehicles/selection-van.webp", badge: "Family Choice" },
        { value: "ev_hybrid", label: "Electric / Hybrid", image: "/vehicles/selection-electric.webp", badge: "Eco Friendly" },
      ];

      return (
        <StepShell
          title="What type of vehicle are you looking for?"
          description="Select your preferred body style to view matched rates and certified inventory."
          footer={autoAdvanceFooter}
        >
          <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 sm:gap-4">
            {vehicleCards.map((v) => (
              <VehicleGridCard
                key={v.value}
                label={v.label}
                badge={v.badge}
                imageSrc={v.image}
                selected={data.vehicle_type === v.value}
                onClick={() => {
                  update({ vehicle_type: v.value });
                  trackGa("vehicle_type_select", { step_name: "vehicle_type" });
                  setTimeout(onNext, 240);
                }}
              />
            ))}
            <button
              type="button"
              data-intake-choice
              aria-pressed={Boolean(data.vehicle_type === "not_sure")}
              onClick={() => {
                update({ vehicle_type: "not_sure" });
                trackGa("vehicle_type_select", { step_name: "vehicle_type" });
                setTimeout(onNext, 240);
              }}
              className={cn(
                "group relative flex flex-col items-center justify-between rounded-2xl border-2 border-dashed p-4 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]",
                data.vehicle_type === "not_sure"
                  ? "border-primary bg-primary/5 shadow-md shadow-primary/10 ring-2 ring-primary/20"
                  : "border-border/80 bg-card/60 hover:-translate-y-1 hover:border-primary/50 hover:bg-card hover:shadow-lg hover:shadow-slate-200/50"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors",
                  data.vehicle_type === "not_sure"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card group-hover:border-primary/40"
                )}
              >
                {data.vehicle_type === "not_sure" && <Check className="h-3.5 w-3.5 stroke-[2.5]" />}
              </span>

              <div className="my-2 flex h-24 w-full items-center justify-center">
                <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5 shadow-sm transition-all duration-200 group-hover:scale-105 group-hover:border-primary/40 group-hover:bg-primary/10">
                  <Car className="h-8 w-8 stroke-[1.8] text-primary transition-transform duration-200 group-hover:scale-105" />
                  <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-amber-400/40 bg-amber-400/20 text-amber-500 shadow-xs">
                    <Sparkles className="h-3 w-3 stroke-[2.5]" />
                  </span>
                </div>
              </div>

              <div>
                <span className="block font-display text-base font-bold text-foreground">
                  Not Sure Yet
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Show me all options
                </span>
              </div>
            </button>
          </div>
          <Helper>
            All credit profiles welcome · No SIN required · Free pre-qualification
          </Helper>
        </StepShell>
      );
    }

    case "monthly_budget": {
      const budgetItems: { value: string; label: string; badge?: string; desc?: string }[] = [
        { value: "under_400", label: "Under $400 / mo", badge: "Budget Friendly", desc: "Great for fuel-efficient commuters & sedans" },
        { value: "400_499", label: "$400 – $499 / mo", badge: "Most Popular", desc: "Top choice for mid-size SUVs & compacts" },
        { value: "500_600", label: "$500 – $600 / mo", badge: "Great Selection", desc: "Popular for full-size SUVs & light trucks" },
        { value: "over_600", label: "$600+ / mo", badge: "Heavy Duty / Luxury", desc: "Ideal for 4x4 trucks & loaded packages" },
        { value: "not_sure", label: "Not sure — show me what fits", desc: "We'll calculate the lowest possible payments" },
      ];

      return (
        <StepShell
          title="What monthly payment feels comfortable?"
          description="Choose a range you feel good about — this helps us calculate matching terms."
          footer={autoAdvanceFooter}
        >
          <div className="grid gap-3">
            {budgetItems.map((b) => (
              <ChoiceCard
                key={b.value}
                label={b.label}
                description={b.desc}
                badge={b.badge}
                selected={data.monthly_budget === b.value}
                onClick={() => {
                  update({ monthly_budget: b.value });
                  setTimeout(onNext, 220);
                }}
              />
            ))}
          </div>
          <Helper>
            This is only a preference to help select vehicles. It does not affect approval odds.
          </Helper>
        </StepShell>
      );
    }

    case "employment_status": {
      const employmentItems = [
        { value: "employed", label: "Employed (Full-Time / Part-Time)", badge: "Fast Approval", desc: "Hourly wage, salary, or T4 paystub" },
        { value: "self_employed", label: "Self-Employed / Contractor / Gig", badge: "Flexible Proof", desc: "Sole proprietor, 1099, or business owner" },
        { value: "seasonal", label: "Seasonal / Trades / Construction", desc: "Resource, forestry, oil & gas, or trade work" },
        { value: "other", label: "Other Regular Income", desc: "Settlements, investments, or structured income" },
      ];

      return (
        <StepShell
          title="What is your primary income source?"
          description="Lenders across Western Canada have programs tailored to every working situation."
          footer={autoAdvanceFooter}
        >
          <div className="grid gap-3">
            {employmentItems.map((item) => (
              <ChoiceCard
                key={item.value}
                label={item.label}
                description={item.desc}
                badge={item.badge}
                selected={data.employment_status === item.value}
                onClick={() => {
                  update({ employment_status: item.value });
                  setTimeout(onNext, 220);
                }}
              />
            ))}
          </div>
          <Helper>
            Why we ask: lenders need this to match the right program. Never shared without consent.
          </Helper>
        </StepShell>
      );
    }

    case "industry":
      return (
        <StepShell title="What kind of work do you do?" description="Just the closest match — no typing needed." footer={autoAdvanceFooter}>
          {choice("industry", INDUSTRIES, true)}
          <Helper>We only ask so lenders can match your file to the right program.</Helper>
        </StepShell>
      );

    case "employment_details":
      return (
        <StepShell title="Tell us where you work" description="Optional — it can speed up verification." footer={inputFooter}>
          <div className="grid gap-4">
            <Field label="Occupation" optional fieldKey="job_title">
              <Input autoFocus value={data.job_title ?? ""} onChange={(e) => update({ job_title: e.target.value })} autoComplete="organization-title" placeholder="Service technician" />
            </Field>
            <Field label={data.employment_status === "self_employed" ? "Business name" : "Company name"} optional fieldKey="employer_name">
              <Input value={data.employer_name ?? ""} onChange={(e) => update({ employer_name: e.target.value })} autoComplete="organization" placeholder="Acme Ltd." />
            </Field>
          </div>
        </StepShell>
      );

    case "income":
      return (
        <StepShell title="What is your income?" description="Before tax — a range is all we need." footer={autoAdvanceFooter}>
          <p className="mb-2 text-sm font-medium">How often are you paid?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PAY_FREQUENCIES.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={data.pay_frequency === o.value}
                onClick={() => update({ pay_frequency: o.value, income_amount: "" })}
              />
            ))}
          </div>
          {data.pay_frequency && (
            <div className="mt-6 animate-fade-in">
              <p className="mb-2 text-sm font-medium">Approximate gross income each pay, before tax</p>
              <div className="grid gap-3">
                {incomeRanges(data.pay_frequency).map((o) => (
                  <ChoiceCard
                    key={o.value}
                    label={o.label}
                    selected={data.income_amount === o.value}
                    onClick={() => {
                      update({ income_amount: o.value });
                      setTimeout(onNext, 220);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <Helper>Why we ask: lenders need a rough range to match you. We never ask for your SIN or banking login, and nothing is shared without your consent.</Helper>
        </StepShell>
      );

    case "additional_income":
      return (
        <StepShell
          title="Any additional income?"
          description="Child benefit, pension, side work — it all helps."
          footer={data.additional_income === "yes" ? inputFooter : autoAdvanceFooter}
        >
          <div className="grid gap-3">
            {YES_NO.map((o) => (
              <ChoiceCard
                key={o.value}
                label={o.label}
                selected={data.additional_income === o.value}
                onClick={() => {
                  update({
                    additional_income: o.value,
                    ...(o.value === "no"
                      ? { additional_income_source: "", additional_income_amount: "" }
                      : {}),
                  });
                  if (o.value === "no") setTimeout(onNext, 220);
                }}
              />
            ))}
          </div>
          {data.additional_income === "yes" && (
            <div className="mt-5 grid gap-4 animate-fade-in">
              <Field label="Source" required error={fieldError("additional_income_source")} errorMessage={fieldMessage("additional_income_source")} fieldKey="additional_income_source" onBlur={() => touch("additional_income_source")}>
                <Input autoFocus value={data.additional_income_source ?? ""} onChange={(e) => update({ additional_income_source: e.target.value })} placeholder="e.g. Pension, child benefit, side work" />
              </Field>
              <Field label="Monthly amount" required error={fieldError("additional_income_amount")} errorMessage={fieldMessage("additional_income_amount")} fieldKey="additional_income_amount" onBlur={() => touch("additional_income_amount")}>
                <Input value={data.additional_income_amount ?? ""} onChange={(e) => update({ additional_income_amount: e.target.value })} placeholder="Amount per month" inputMode="decimal" />
              </Field>
            </div>
          )}
        </StepShell>
      );

    case "employment_length":
      return (
        <StepShell title="How long have you had this work or business?" footer={autoAdvanceFooter}>
          {choice("employment_length", TIME_LENGTHS, true)}
          <Helper>This helps the advisor understand the stability of your income.</Helper>
        </StepShell>
      );

    case "address_details":
      return (
        <StepShell title="Where and when are you looking to buy?" description="We'll fill in your province. We serve drivers in Western Canada — BC, Alberta, Saskatchewan, Manitoba, Yukon, the Northwest Territories and Nunavut." footer={inputFooter}>
          <div className="grid gap-4">
            <Field label="Postal code" optional error={fieldError("postal_code")} errorMessage={fieldMessage("postal_code")} fieldKey="postal_code" onBlur={() => touch("postal_code")}>
              <Input
                autoFocus
                inputMode="text"
                value={data.postal_code ?? ""}
                onChange={(e) => {
                  const formatted = formatPostal(e.target.value);
                  const inferred = inferProvinceFromPostal(formatted);
                  update({ postal_code: formatted, ...(inferred ? { province: inferred } : {}) });
                }}
                placeholder="V6B 0A1"
                autoComplete="postal-code"
                maxLength={7}
              />
            </Field>
            <Field label="Province" required error={fieldError("province")} errorMessage={fieldMessage("province")} fieldKey="province" onBlur={() => touch("province")}>
              <select className="h-11 w-full rounded-md border border-input bg-background px-3 text-base" value={data.province ?? ""} onChange={(e) => update({ province: e.target.value })} autoComplete="address-level1">
                <option value="">Select</option>
                {PROVINCES.filter((p) => !BLOCKED_PROVINCES.includes(p.value)).map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </Field>
            <p className="text-sm text-muted-foreground">Enter your postal code and province so we can service your inquiry.</p>
            <p className="mt-3 text-sm font-medium">When would you like to purchase?</p>
            {choice("purchase_timeline", PURCHASE_TIMELINES, false)}
          </div>
        </StepShell>
      );

    case "street_address":
      return (
        <StepShell title="What is your mailing address?" description="Lenders require a complete mailing address to match financing programs." footer={inputFooter}>
          <div className="grid gap-4">
            <Field label="Street address" required error={fieldError("street_address")} errorMessage={fieldMessage("street_address")} fieldKey="street_address" onBlur={() => touch("street_address")}>
              <Input autoFocus value={data.street_address ?? ""} onChange={(e) => update({ street_address: e.target.value })} autoComplete="street-address" placeholder="1234 Main St" maxLength={255} />
            </Field>
            <Field label="City" required error={fieldError("city")} errorMessage={fieldMessage("city")} fieldKey="city" onBlur={() => touch("city")}>
              <Input value={data.city ?? ""} onChange={(e) => update({ city: e.target.value })} autoComplete="address-level2" placeholder="Vancouver" maxLength={120} />
            </Field>
          </div>
          <Helper>Why we ask: lenders need a mailing address for financing documents. We only share it with your advisor and appropriate dealer-finance partners.</Helper>
        </StepShell>
      );

    case "date_of_birth":
      return (
        <StepShell title="What is your date of birth?" description="Lenders use your date of birth to match you with the right financing programs." footer={inputFooter}>
          <Field label="Date of birth" required error={fieldError("date_of_birth")} errorMessage={fieldMessage("date_of_birth")} fieldKey="date_of_birth">
            <DobInput value={data.date_of_birth ?? ""} onChange={(iso) => update({ date_of_birth: iso })} autoFocus />
          </Field>
          <Helper>Why we ask: lenders require your date of birth. We never ask for your SIN or banking details.</Helper>
        </StepShell>
      );

    case "contact":
      return <ContactStep data={data} update={update} onSubmit={onSubmit} onBack={onBack} submitting={submitting} errorMsg={errorMsg} />;
    case "thank_you":
      return <StepShell title="Application received"><p className="text-muted-foreground">Redirecting…</p></StepShell>;
  }
}

function NotQualified({ onBack }: { onBack: () => void }) {
  return (
    <StepShell title="Thank you for your interest" description="We appreciate you taking the time.">
      <div className="space-y-4 text-base leading-relaxed text-muted-foreground">
        <p>Right now, our lending partners are only able to consider applications where the applicant has employment or self-employment income, so we're not able to continue your application today.</p>
        <p>If your situation changes, you'd be very welcome to come back — and if you have questions, email us at <a href="mailto:admin@autoworldapprovals.com" className="break-words underline">admin@autoworldapprovals.com</a>.</p>
        <p className="text-sm">No application has been recorded and none of your answers have been saved.</p>
      </div>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button>
        <Button asChild variant="hero" size="lg"><Link href="/">Return to homepage<ArrowRight className="h-4 w-4" /></Link></Button>
      </div>
    </StepShell>
  );
}

function Helper({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-px h-3.5 w-3.5 flex-shrink-0 text-[var(--electric)]" />
      <span>{children}</span>
    </p>
  );
}

function formatPhoneInput(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

interface ContactStepProps {
  data: FunnelData;
  update: (p: Partial<FunnelData>) => void;
  onSubmit: (p: Partial<FunnelData>) => void;
  onBack: () => void;
  submitting: boolean;
  errorMsg: string | null;
}

function ContactStep({ data, update, onSubmit, onBack, submitting }: ContactStepProps) {
  const [showErrors, setShowErrors] = useState(false);
  const result = ContactSchema.safeParse(data);
  const errors = result.success ? {} : Object.fromEntries(result.error.issues.map((i) => [String(i.path[0]), i.message]));

  return (
    <StepShell
      title="How can your vehicle advisor reach you?"
      description="Enter your contact info to calculate your pre-qualified rates and view matched dealer inventory."
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!result.success) {
            setShowErrors(true);
            const key = result.error.issues[0]?.path[0];
            if (typeof key === "string") document.getElementById(key)?.focus();
            return;
          }
          onSubmit(result.data);
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field key="first_name" label="First name" required fieldKey="first_name" error={showErrors && !!errors["first_name"]} errorMessage={errors["first_name"]}>
            <NameInput value={data.first_name || ""} onChange={(e) => update({ first_name: e.target.value })} autoComplete="given-name" />
          </Field>
          <Field key="last_name" label="Last name" required fieldKey="last_name" error={showErrors && !!errors["last_name"]} errorMessage={errors["last_name"]}>
            <NameInput value={data.last_name || ""} onChange={(e) => update({ last_name: e.target.value })} autoComplete="family-name" />
          </Field>
          <Field key="phone" label="Canadian phone number" required fieldKey="phone" error={showErrors && !!errors["phone"]} errorMessage={errors["phone"]}>
            <Input
              value={data.phone || ""}
              onChange={(e) => update({ phone: formatPhoneInput(e.target.value) })}
              type="tel"
              autoComplete="tel"
              placeholder="e.g. 604-555-0199"
              maxLength={16}
            />
          </Field>
          <Field key="email" label="Email address" required fieldKey="email" error={showErrors && !!errors["email"]} errorMessage={errors["email"]}>
            <Input
              value={data.email || ""}
              onChange={(e) => update({ email: e.target.value })}
              type="email"
              autoComplete="email"
              placeholder="name@example.ca"
              maxLength={255}
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Preferred contact method" optional fieldKey="preferred_contact">
            <select
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={data.preferred_contact || ""}
              onChange={(e) => update({ preferred_contact: e.target.value })}
            >
              <option value="">No preference</option>
              <option value="phone">Phone Call</option>
              <option value="text">Text Message (SMS)</option>
              <option value="email">Email</option>
            </select>
          </Field>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button
            type="submit"
            variant="hero"
            size="xl"
            disabled={submitting}
            className="h-14 sm:h-12 w-full sm:w-auto text-base font-bold shadow-lg shadow-primary/20"
          >
            Find Matched Financing Options <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </StepShell>
  );
}

interface FieldProps {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: boolean;
  errorMessage?: string;
  fieldKey?: string;
  hint?: string;
  onBlur?: () => void;
}

function Field({ label, children, required, optional, error, errorMessage, fieldKey, hint, onBlur }: FieldProps) {
  const child = React.Children.only(children) as React.ReactElement<{
    id?: string;
    "aria-required"?: boolean;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
    onBlur?: (e: React.FocusEvent<unknown>) => void;
  }>;
  const input = React.cloneElement(child, {
    id: fieldKey,
    "aria-required": required || undefined,
    "aria-invalid": error || undefined,
    "aria-describedby": error ? `${fieldKey}-error` : undefined,
    onBlur: (e: React.FocusEvent<unknown>) => {
      onBlur?.();
      child.props.onBlur?.(e);
    },
  });

  return (
    <div data-field={fieldKey} className={cn("rounded-md transition-all", error && "ring-2 ring-amber-400/70 ring-offset-2 ring-offset-background p-2 -m-2 animate-fade-in")}>
      <Label htmlFor={fieldKey} className="mb-1.5 flex flex-wrap items-center gap-1.5 text-sm font-medium">
        <span>{label}</span>
        {required && <span className="text-destructive" aria-hidden>*</span>}
        {optional && <span className="text-xs font-normal text-muted-foreground">(optional)</span>}
      </Label>
      {input}
      {error && errorMessage && <p id={`${fieldKey}-error`} role="alert" className="mt-1 text-xs text-amber-700 dark:text-amber-300">{errorMessage}</p>}
      {!error && hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface Validation {
  valid: boolean;
  missingKeys: string[];
  missingLabels: string[];
  hintLabel?: string;
  messages: Record<string, string>;
}

function getStepValidation(step: StepId, d: FunnelData): Validation {
  const check = (entries: Array<[string, string, unknown]>): Validation => {
    const messages: Record<string, string> = {};
    const missing = entries.filter(([, , v]) => !v);
    for (const [k, l, v] of entries) {
      if (!v) messages[k] = `Please add your ${l.toLowerCase()}`;
    }
    return {
      valid: missing.length === 0,
      missingKeys: missing.map(([k]) => k),
      missingLabels: missing.map(([, l]) => l),
      hintLabel: missing.length > 0 ? missing.map(([, l]) => l).slice(0, 3).join(", ") : undefined,
      messages,
    };
  };

  const schemas: Partial<Record<StepId, { safeParse: (input: unknown) => { success: boolean; error?: { issues: Array<{ path: (string | number)[]; message: string }> } } }>> = {
    vehicle_type: VehicleSchema,
    monthly_budget: BudgetSchema,
    employment_status: EmploymentSchema,
    income: IncomeSchema,
    contact: ContactSchema,
  };
  const schema = schemas[step];
  if (schema) {
    const result = schema.safeParse(d);
    if (result.success) return { valid: true, missingKeys: [], missingLabels: [], messages: {} };
    const messages = Object.fromEntries((result.error?.issues || []).map((i) => [String(i.path[0]), i.message]));
    const keys = Object.keys(messages);
    return { valid: false, missingKeys: keys, missingLabels: keys.map((k) => k.replace(/_/g, " ")), messages };
  }

  switch (step) {
    case "vehicle_type": return check([["vehicle_type", "vehicle type", d.vehicle_type]]);
    case "monthly_budget": return check([["monthly_budget", "monthly budget", d.monthly_budget]]);
    case "employment_status": return check([["employment_status", "employment status", d.employment_status]]);
    case "industry": return check([["industry", "line of work", d.industry]]);
    case "employment_details": return { valid: true, missingKeys: [], missingLabels: [], messages: {} };
    case "income": return check([
      ["pay_frequency", "pay frequency", d.pay_frequency],
      ["income_amount", "income range", d.income_amount],
    ]);
    case "additional_income":
      return d.additional_income === "yes"
        ? check([
            ["additional_income_source", "income source", d.additional_income_source],
            ["additional_income_amount", "monthly amount", d.additional_income_amount],
          ])
        : check([["additional_income", "answer", d.additional_income]]);
    case "employment_length": return check([["employment_length", "answer", d.employment_length]]);
    case "address_details": {
      const postal = (d.postal_code ?? "").trim();
      const v = check([
        ["province", "province", d.province],
        ["purchase_timeline", "purchase timing", d.purchase_timeline],
      ]);
      if (postal && !/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTVWXYZ] ?\d[ABCEGHJ-NPRSTVWXYZ]\d$/i.test(postal)) {
        return { valid: false, missingKeys: ["postal_code"], missingLabels: ["postal code"], hintLabel: "postal code", messages: { postal_code: "Enter a valid Canadian postal code" } };
      }
      if (isBlockedRegion(d.province, d.postal_code)) {
        const key = d.province && BLOCKED_PROVINCES.includes(d.province) ? "province" : "postal_code";
        return {
          valid: false,
          missingKeys: [...v.missingKeys, key],
          missingLabels: [...v.missingLabels, "Western Canada address"],
          hintLabel: "Western Canada address",
          messages: { ...v.messages, [key]: EASTERN_REGION_MESSAGE },
        };
      }
      return v;
    }
    case "residence_status": return check([["residence_status", "answer", d.residence_status]]);
    case "address_length": return check([["address_length", "answer", d.address_length]]);
    case "date_of_birth": {
      const error = dateOfBirthError(d.date_of_birth ?? "");
      return {
        valid: !error,
        missingKeys: error ? ["date_of_birth"] : [],
        missingLabels: error ? ["date of birth"] : [],
        messages: error ? { date_of_birth: error } : {},
      };
    }
    case "street_address": return check([["street_address", "street address", d.street_address], ["city", "city", d.city]]);
    default: return { valid: true, missingKeys: [], missingLabels: [], messages: {} };
  }
}

function stepLabel(step: string): string {
  if (step === "vehicle_type") return "Vehicle";
  if (step === "monthly_budget") return "Budget";
  if (/employment|industry|income/.test(step)) return "Work & income";
  if (/address|residence|postal|street/.test(step)) return "Location";
  if (step === "qualified" || step === "review") return "Review";
  return "About you";
}
