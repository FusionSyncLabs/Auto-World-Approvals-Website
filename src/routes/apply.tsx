import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, AlertCircle, Check, Info, Loader2, ShieldCheck, BadgeCheck } from "lucide-react";
import { Logo } from "@/components/site/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NameInput } from "@/components/ui/name-input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getTracking } from "@/lib/attribution";
import { trackGa } from "@/lib/analytics";
import { hasAdConsent, advertisingRecordId } from "@/components/site/CookieConsent";
import { META_ELIGIBILITY_VERIFIED } from "@/lib/ad-policy";
import { metaTrack } from "@/lib/meta-pixel";


import { phoneError, isBlockedRegion, BLOCKED_PROVINCES, EASTERN_REGION_MESSAGE } from "@/lib/phone";



import { ChoiceCard } from "@/components/funnel/ChoiceCard";

import { StepShell } from "@/components/funnel/StepShell";
import { IntakeReview } from "@/components/funnel/IntakeReview";
import { submitIntake } from "@/lib/funnel/intake.functions";
import { VehicleSchema, BudgetSchema, EmploymentSchema, IncomeSchema, ContactSchema, IntakeSubmissionSchema, dateOfBirthError } from "@/lib/funnel/intake-validation";
import { DobInput } from "@/components/funnel/DobInput";
import {
  VEHICLE_TYPES, BUDGETS, YES_NO, EMPLOYMENT, PAY_FREQUENCIES, TIME_LENGTHS,
  RESIDENCE, PROVINCES, INDUSTRIES, incomeRanges, VEHICLE_CONDITIONS, DOWN_PAYMENTS, TRADE_IN, PURCHASE_TIMELINES,
  type ChoiceOption, type FunnelData, type StepId,
  getSteps,
  NON_QUALIFYING_EMPLOYMENT,
  type FunnelVariant,
} from "@/lib/funnel/schema";

export const Route = createFileRoute("/apply")({
  validateSearch: (search: Record<string, unknown>): { vt?: string; r?: string } => ({
    ...(typeof search.vt === "string" ? { vt: search.vt } : {}),
    ...(typeof search.r === "string" ? { r: search.r } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Check Financing Options | Auto World Approvals" },
      { name: "description", content: "Start your Western Canada vehicle financing inquiry. An advisor will review your preferences — no obligation." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Check Financing Options | Auto World Approvals" },
      { property: "og:description", content: "A few quick questions is all it takes to start your vehicle financing pre-qualification." },
      { property: "og:url", content: "https://autoworldapprovals.com/apply" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ApplyPage,
});

const TOKEN_KEY = "awa.intake_submission_key.v2";
const LOCAL_DATA_KEY = "awa.application.v3";
type SaveState = "idle" | "saving" | "saved" | "error";

function ApplyPage() {
  const navigate = useNavigate();
  const { vt } = Route.useSearch();
  const submitIntakeFn = useServerFn(submitIntake);
  const [data, setData] = useState<FunnelData>({});
  const [idx, setIdx] = useState(0);
  const [submitting, setSubmitting] = useState(false);
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
  useEffect(() => {
    if (!hydrated) return;
    window.scrollTo({ top: 0, behavior: "instant" });
    document.querySelector<HTMLElement>("[data-step-heading]")?.focus({ preventScroll: true });
  }, [currentStep, hydrated]);

  useEffect(() => {
    // Remove legacy caches; never restore personal or financing answers from
    // an unencrypted browser store. Only a random retry key is kept.
    try {
      localStorage.removeItem(LOCAL_DATA_KEY);
      localStorage.removeItem("awa.draft_token.v1");
      submissionKey.current = sessionStorage.getItem(TOKEN_KEY);
      if (!submissionKey.current || !/^[0-9a-f-]{36}$/i.test(submissionKey.current)) {
        submissionKey.current = crypto.randomUUID();
        sessionStorage.setItem(TOKEN_KEY, submissionKey.current);
      }
      localStorage.setItem("awa.application_started_v1", "true");
    } catch { submissionKey.current = crypto.randomUUID(); }
    const selected = vt === "ev" ? "ev_hybrid" : vt;
    if (selected && VEHICLE_TYPES.some((o) => o.value === selected)) setData({ vehicle_type: selected });
    setVariant(readVariant());
    setHydrated(true);
    // Remove entry parameters once applied; answers never enter the URL.
    if (vt) void navigate({ to: "/apply", search: {}, replace: true });
  }, []);

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
    if (!key) { setErrorMsg("Please refresh before submitting."); return; }
    const input = { idempotency_key: key, answers, consents: { consent_accuracy, consent_contact, consent_not_guarantee, consent_marketing: consent_marketing === true }, tracking: readTracking(), ad_consent: hasAdConsent(), advertising_consent_id: advertisingRecordId() };
    const parsed = IntakeSubmissionSchema.safeParse(input);
    if (!parsed.success) { setErrorMsg(parsed.error.issues[0]?.message || "Please check your answers."); return; }
    submitLock.current = true;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const result = await submitIntakeFn({ data: parsed.data });
      if (!result.duplicate && !result.is_test) metaTrack("Lead", { eventId: result.event_id });
      if (!result.duplicate) trackGa("generate_lead", { form_variant: variant });
      try {
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.setItem("awa.last_lead_id", result.id);
      } catch { /* storage unavailable */ }
      void navigate({ to: "/thank-you" });

    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "Unable to submit. Your answers are still here; please try again.");
      trackGa("application_error", { error_code: "submit_failed", form_variant: variant });
    } finally { submitLock.current = false; setSubmitting(false); }
  };
  return <div className="min-h-screen bg-soft">
    <header className="application-header z-20 border-b border-border bg-background/95">
      <div className="container mx-auto grid grid-cols-[minmax(0,1fr)_auto] min-h-20 items-center gap-2 px-4 lg:px-8">
        <div className="flex min-w-0 items-center gap-2"><Logo /></div>
        <Link to="/" className="text-sm text-muted-foreground">Home</Link>
      </div>
      <p aria-live="polite" aria-atomic="true" className="sr-only">Step {idx + 1} of {steps.length} · {stepLabel(currentStep)}</p>
    </header>
    <main data-private data-clarity-mask="true" className="container mx-auto px-4 py-8 lg:px-8 lg:py-12 ph-no-capture"><div className="mx-auto w-full max-w-[560px]">
      {!hydrated ? <p className="text-center text-muted-foreground">Loading…</p> : NON_QUALIFYING_EMPLOYMENT.has(data.employment_status || "") ? <NotQualified onBack={back} /> : currentStep === "review" ? <IntakeReview data={data} update={update} onBack={back} onEdit={(step) => { const index = steps.indexOf(step); if (index >= 0) setIdx(index); }} onSubmit={handleSubmit} submitting={submitting} errorMsg={errorMsg} /> : <StepRenderer key={currentStep} step={currentStep} data={data} update={update} onNext={next} onBack={back} canBack={idx > 0} provinceLabel={PROVINCES.find((o) => o.value === data.province)?.label || "Western Canada"} onNameContinue={(patch) => { update(patch); next(); }} onSubmit={(patch) => { update(patch); next(); }} submitting={submitting} errorMsg={errorMsg} />}
      <p className="mt-5 text-center text-base text-muted-foreground"><ShieldCheck className="mr-1 inline h-4 w-4 text-success" />Your details help staff and dealer-finance partners respond to your inquiry.</p>
      <nav aria-label="Application legal documents" className="mt-3 flex flex-wrap items-baseline justify-center gap-x-4 gap-y-3 text-base text-muted-foreground"><Link to="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Privacy</Link><Link to="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Terms</Link><Link to="/consent" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">Consent</Link><button type="button" className="underline hover:text-foreground cursor-pointer bg-transparent border-0 p-0 text-inherit font-inherit" onClick={() => window.dispatchEvent(new Event("awa:open-cookie-preferences"))}>Cookie preferences</button></nav>
    </div></main>
  </div>;
}

const VARIANT_KEY = "aw_funnel_variant_v1";
function readVariant(): FunnelVariant {
  try {
    const v = localStorage.getItem(VARIANT_KEY);
    if (v === "A" || v === "B") return v;
    const pick: FunnelVariant = Math.random() < 0.5 ? "A" : "B";
    localStorage.setItem(VARIANT_KEY, pick);
    return pick;
  } catch { return "A"; }
}

function readTracking() {
  if (typeof window === "undefined") return {};
  return { ...getTracking(), funnel_variant: readVariant() };
}

function digitsOnly(v: string): string {
  let d = v.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}

function formatPostal(v: string): string {
  const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  if (clean.length <= 3) return clean;
  return `${clean.slice(0, 3)} ${clean.slice(3)}`;
}
function inferProvinceFromPostal(postal: string): string | undefined {
  const c = postal.trim().toUpperCase().charAt(0);
  // The three territories share the X prefix: X0A/X0G are Nunavut, X0E/X1A are
  // the Northwest Territories, so the first three characters decide between them.
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
function isEmail(v: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

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
  step, data, update, onNext, onBack, canBack, provinceLabel,
  onNameContinue, onSubmit, submitting, errorMsg,
}: StepProps) {
  const validation = useMemo(() => getStepValidation(step, data), [step, data]);
  const [showErrors, setShowErrors] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = useCallback((key: string) => setTouched((t) => (t[key] ? t : { ...t, [key]: true })), []);

  useEffect(() => {
    if (showErrors && validation.valid) setShowErrors(false);
  }, [showErrors, validation.valid]);

  const handleNext = () => {
    if (validation.valid) { setShowErrors(false); onNext(); }
    else {
      setShowErrors(true);
      // mark all fields on this step as touched so inline errors appear immediately
      setTouched((t) => {
        const next = { ...t };
        for (const k of validation.missingKeys) next[k] = true;
        return next;
      });
      if (typeof document !== "undefined" && validation.missingKeys.length > 0) {
        const el = document.querySelector<HTMLElement>(
          `[data-field="${validation.missingKeys[0]}"] input, [data-field="${validation.missingKeys[0]}"] select`,
        );
        el?.focus();
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  };

  const missingSet = new Set(validation.missingKeys);
  const fieldError = (key: string) => (touched[key] || showErrors) && missingSet.has(key);
  const fieldMessage = (key: string) => validation.messages[key] || "This field is required";

  const nav = (
    <div className="space-y-3">
      {showErrors && !validation.valid && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive bg-background px-3 py-2 text-sm text-destructive animate-fade-in">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            {validation.missingLabels.length === 1
              ? <>Almost there — just need your <strong>{validation.missingLabels[0]}</strong>.</>
              : <>Almost there — just need your <strong>{validation.missingLabels.join(", ")}</strong>.</>}
          </span>
        </div>
      )}
      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        {canBack ? <Button variant="ghost" onClick={onBack} className="h-11 sm:h-10"><ArrowLeft className="h-4 w-4" /> Back</Button> : <Button asChild variant="ghost" className="h-11 sm:h-10"><Link to="/"><ArrowLeft className="h-4 w-4" /> Back to Home</Link></Button>}
        <Button variant="hero" size="lg" onClick={handleNext} className="h-14 w-full text-base sm:h-11 sm:w-auto sm:min-w-[170px] sm:text-sm">
          Continue <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  const backRow = (
    <div className="mt-6 flex justify-start">
      <Button variant="ghost" size="sm" onClick={onBack} disabled={!canBack} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>
    </div>
  );

  const choice = (field: keyof FunnelData, options: ChoiceOption[], autoAdvance = false) => (
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
    case "vehicle_type":
      return (
        <StepShell title="What type of vehicle are you looking for?" description="Pick the closest match — you can change it before submitting." footer={nav}>
          {choice("vehicle_type", VEHICLE_TYPES, false)}
          <p className="mb-3 mt-6 text-sm font-medium">New or used? (optional)</p>
          {choice("vehicle_condition", VEHICLE_CONDITIONS, false)}
          <Helper>This helps us match you with the right inventory and lenders.</Helper>
        </StepShell>
      );

    case "monthly_budget":
      return (
        <StepShell title="What monthly payment works for you?" description="These are preferences, not a lending decision." footer={nav}>
          {choice("monthly_budget", BUDGETS, false)}
          <details className="mt-6"><summary className="cursor-pointer text-sm font-semibold">Down payment & trade-in (optional)</summary>
            <p className="mb-3 mt-4 text-sm font-medium">Estimated down payment</p>{choice("down_payment", DOWN_PAYMENTS, false)}
            <p className="mb-3 mt-5 text-sm font-medium">Do you have a trade-in?</p>{choice("has_trade_in", TRADE_IN, false)}
          </details>
          <Helper>No wrong answer — we use this to match you with the right vehicles, not to approve or decline you.</Helper>
        </StepShell>
      );

    case "employment_status":
      return (
        <StepShell title="What is your main income source?" description="Every situation is welcome — this helps the advisor review your financing inquiry." footer={nav}>
          {choice("employment_status", EMPLOYMENT)}
          <Helper>Why we ask: lenders need this to match you. It's never shared without your consent.</Helper>
        </StepShell>
      );


    case "industry":
      return (
        <StepShell title="What kind of work do you do?" description="Just the closest match — no typing needed.">
          {choice("industry", INDUSTRIES)}
          <Helper>We only ask so lenders can match your file to the right program.</Helper>
          {backRow}
        </StepShell>
      );

    case "employment_details":
      return (
        <StepShell title="Tell us where you work" description="Optional — it can speed up verification." footer={nav}>
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
        <StepShell title="What is your income?" description="Before tax — a range is all we need." footer={nav}>
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
          footer={data.additional_income === "yes" ? nav : undefined}
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
          {data.additional_income !== "yes" && backRow}
        </StepShell>
      );

    case "employment_length":
      return (
        <StepShell title="How long have you had this work or business?" footer={nav}>
          {choice("employment_length", TIME_LENGTHS)}
          <Helper>This helps the advisor understand the stability of your income.</Helper>
        </StepShell>
      );


    case "address_details":
      return (
        <StepShell title="Where and when are you looking to buy?" description="We'll fill in your province. We serve drivers in Western Canada — BC, Alberta, Saskatchewan, Manitoba, Yukon, the Northwest Territories and Nunavut." footer={nav}>
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
                {PROVINCES.filter((p) => !BLOCKED_PROVINCES.includes(p.value)).map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
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
        <StepShell title="What is your mailing address?" description="Lenders require a complete mailing address to match financing programs." footer={nav}>
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
        <StepShell title="What is your date of birth?" description="Lenders use your date of birth to match you with the right financing programs." footer={nav}>
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
        <Button asChild variant="hero" size="lg"><Link to="/">Return to homepage<ArrowRight className="h-4 w-4" /></Link></Button>
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
  return <StepShell title="How can an advisor reach you?" description="An advisor will contact you to review your vehicle financing inquiry.">
    <form noValidate onSubmit={(e) => { e.preventDefault(); if (!result.success) { setShowErrors(true); const key = result.error.issues[0]?.path[0]; if (typeof key === "string") document.getElementById(key)?.focus(); return; } onSubmit(result.data); }}>
      <div className="grid gap-4">
        {([['first_name', 'First name', 'given-name'], ['last_name', 'Last name', 'family-name'], ['phone', 'Canadian phone number', 'tel'], ['email', 'Email address', 'email']] as const).map(([key, label, complete]) => <Field key={key} label={label} required fieldKey={key} error={showErrors && !!errors[key]} errorMessage={errors[key]}>
          {key === 'first_name' || key === 'last_name' ? <NameInput value={data[key] || ''} onChange={(e) => update({ [key]: e.target.value })} autoComplete={complete} /> : <Input value={data[key] || ''} onChange={(e) => update({ [key]: key === 'phone' ? formatPhoneInput(e.target.value) : e.target.value })} type={key === 'phone' ? 'tel' : 'email'} autoComplete={complete} maxLength={key === 'email' ? 255 : 16} />}
        </Field>)}
        <Field label="Preferred contact method" optional fieldKey="preferred_contact"><select className="h-11 w-full rounded-md border border-input bg-background px-3" value={data.preferred_contact || ''} onChange={(e) => update({ preferred_contact: e.target.value })}><option value="">No preference</option><option value="phone">Phone</option><option value="email">Email</option></select></Field>
      </div>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" />Back</Button><Button type="submit" variant="hero" size="lg" disabled={submitting}>Review my inquiry<ArrowRight className="h-4 w-4" /></Button></div>
    </form>
  </StepShell>;
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
  const child = React.Children.only(children) as React.ReactElement<{ id?: string; "aria-required"?: boolean; "aria-invalid"?: boolean; "aria-describedby"?: string; onBlur?: (e: React.FocusEvent<unknown>) => void }>;
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

interface Validation { valid: boolean; missingKeys: string[]; missingLabels: string[]; hintLabel?: string; messages: Record<string, string>; }
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
    vehicle_type: VehicleSchema, monthly_budget: BudgetSchema,
    employment_status: EmploymentSchema, income: IncomeSchema, contact: ContactSchema,
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
