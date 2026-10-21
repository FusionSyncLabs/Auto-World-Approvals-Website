/** Minimized, bounded technical metadata; never applicant answers. */
export function safePagePath(path: string): string {
  for (const prefix of ["/apply", "/thank-you", "/admin", "/crm"]) if (path.startsWith(prefix)) return prefix;
  if (path.startsWith("/blog/")) return "/blog/article";
  return path.split("?")[0].split("#")[0];
}
export function safeErrorReport() { return new Error("Website operation failed; confidential error details withheld"); }
export function safeFunnelParams(params: Record<string, unknown>) {
  const safe: Record<string, string | number> = {};
  if (Number.isInteger(params.step_number) && Number(params.step_number) >= 1 && Number(params.step_number) <= 30) safe.step_number = Number(params.step_number);
  const steps = new Set(["vehicle_type", "monthly_budget", "address_details", "employment_status", "income", "employment_length", "contact", "review"]);
  if (typeof params.step_name === "string" && steps.has(params.step_name)) safe.step_name = params.step_name;
  if (params.form_variant === "A" || params.form_variant === "B") safe.form_variant = params.form_variant;
  if (params.error_code === "submit_failed") safe.error_code = params.error_code;
  return safe;
}
export const LEAD_EMAIL_PREVIEW = "Confidential vehicle inquiry. Open this message securely to view the assigned recipient and details.";
export function emailProviderFailure(status: number): string { return `Email provider HTTP ${Number.isInteger(status) && status >= 100 && status <= 599 ? status : 500}`; }
