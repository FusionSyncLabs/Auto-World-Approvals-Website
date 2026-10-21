# Project rules

- Personal-name fields use shared name-validation schemas and NameInput controls at browser and submission boundaries; business names and existing source attribution are not rewritten. Why: keep accepted characters consistent and prevent bypass through alternate write paths.

- Shared customer controls use wrapping labels, visible focus and minimum primary tap targets; mobile intake headers stay in document flow and step changes focus the question heading. Why: keyboard/zoom/short-screen users must retain access to questions and actions.
- Homepage vehicle cutouts use compressed transparent WebP derivatives of normalized source canvases. Why: reduce downloads without losing alignment or transparency.

- Lead email completion labels use shared intake completion checks, not imported submission timestamps or admin-copy detail level. Why: Facebook form fills remain partial after routing.

- All lead delivery templates use a shared confirmed-assignment lookup and ownership block; notifications follow automatic assignment, while manual shares never change ownership. Why: admin and informational copies must name the actual assigned client.

- Read the assigned delivery recipient from `lead_distribution_assignments` and its contact relationship, separately from first-contact fields; this preserves confirmed ownership rather than inferring it from informational email copies.- Meta conversion = one `Lead` event per saved application (browser + CAPI share `lead_<id>`), no invented value/currency; SubmitApplication is retired. Why: duplicate/invalid conversions skewed ad reporting.
- Ad/analytics tags and real lead delivery run only on production hosts (`src/lib/prod-host.ts`); other hosts set `leads.is_test`. Why: keep preview traffic out of live reports.
- GA funnel events carry only step_number/step_name/form_variant/error_code. Why: no applicant data in analytics.
- Vehicle landing pages live at /financing/$vehicle (truck|suv|car|ev) and deep-link to /apply?vt=<type>; ev maps to the ev_hybrid funnel value. Why: one dynamic route keeps the four spec pages in sync.
- Every lead email send (admin notification, applicant confirmation, client delivery, admin copy) writes a row to public.notification_log with status sent/failed. Why: the marketing spec requires an auditable delivery log; retries never count as conversions.
- Advertising eligibility is fail-closed in ad-policy.ts until dataset restrictions are documented; never enable it to improve a score. Why: financing application context may itself be restricted.
- Store append-only advertising choice evidence separately from contact/email consents; outbound events check event-time and current consent and use a unique audit event key and saved submission timestamp. Why: withdrawal and retries must not create unauthorized or duplicate conversions.
- Claim draft submission with an atomic submitted_at-is-null update; losing concurrent requests return the saved result without delivery. Why: frontend locks alone do not prevent duplicate side effects.
- Vehicle-selection image assets use a shared canvas and normalized wheel baseline; render the complete canvas with object-contain. Why: consistent scale and alignment prevent uneven or cropped category photos.
- Initial financing intake uses in-memory answers and a random session retry key, with a shared client/server validation schema and one final insert keyed by resume_token. Why: no premature draft capture or duplicate lead side effects.
- Intake consent evidence is inserted by a submission trigger in the same transaction; success receipts require the application's HttpOnly receipt cookie. Why: failures cannot produce unrecorded consent or false success screens.
- Legal fallbacks and editor defaults share legal-defaults.ts; published admin overrides remain supported. Why: intake disclosures must not diverge across surfaces.
- Analytics loads only after consent, uses bounded event values and sanitized page paths; application content is replay-masked and exception reports/provider failures use fixed safe metadata. Why: confidential answers and reference identifiers must not leak through telemetry.
- Delivered lead emails use a generic padded preheader and explicit recipient field allowlists; retain authorized detail delivery and assignment. Why: protect notification previews without changing existing routing.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
