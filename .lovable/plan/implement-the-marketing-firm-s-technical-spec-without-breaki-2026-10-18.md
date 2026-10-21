# Implement the marketing firm's technical spec (without breaking lead delivery)

## Ground rules
- Lead distribution stays as is: one assigned paying client per lead, round-robin, geographic lists, informational copies, the sweep for missed deliveries, Google Sheet import, CRM and admin pages.
- Every change below is an addition or a cleanup. Existing lead records, attribution and the budget split test keep working.
- Items that need your sign-off or a legal review are listed at the end. I won't build those until you decide.

## Phase 1 — Must fix before you spend more on ads (P0)

**1. Report one conversion per real application, and only once**
- Your browser currently sends both `Lead` and `SubmitApplication`, and the server sends `SubmitApplication` too. This is why Meta shows about 1.4K SubmitApplication events but only 397 Leads.
- We keep **Lead** as the one main conversion (it's the event you already optimize on). Lead goes out from both the browser and the server with the same event ID, so Meta counts it once. SubmitApplication stops being sent as a second conversion.
- Remove the made-up `value: 1` and `currency` from every event. The spec says not to invent a value, and this is what causes the "invalid currency" warning. If you later choose a real lead value, it will be sent in CAD.
- The conversion fires only after the server confirms the application was saved. Reloading the thank-you page or tapping twice fires nothing new.

**2. Keep test traffic out of your real reports**
- Meta and Google Analytics tags load only on autoworldapprovals.com (and www). Preview and lovableproject.com addresses send nothing.
- Applications sent from the preview get marked as tests. They aren't sent to clients or counted as conversions.

**3. Stop double submissions**
- Every application attempt gets a stable ID. Retries on a weak connection or a double tap reuse it, so you get one lead, one client email and one conversion.
- The Submit button locks while sending and shows a clear "try again" message if the connection fails.

**4. Google Analytics funnel events**
- Add `application_start` (fires on the first answer, not when the page opens), `application_step_complete` (once per step, with only the step name and number and the A/B version), `application_error` (generic error type only), and `generate_lead` (once, after the save is confirmed).
- No answers, postal codes, income or contact details are ever sent to Google or Meta.

**5. Remove "Admin Login" from the public site**
- Take the Admin Login link out of the footer and check every header, menu and page for other staff links. The staff sign-in page keeps working at its private address.
- Review the database security rules on every table that holds applicant details, and fix anything that's too open.

**6. Thank-you screen**
- Show a short reference number and say what happens next ("an advisor will contact you"). It won't promise approval or a rate.

## Phase 2 — Next release (P1)

- **Lead statuses with history:** New, Contact Attempted, Contacted, Qualified, Not Proceeding, Closed. Each change saves who made it and when. Current CRM statuses get mapped onto these, so nothing is lost.
- **Consent records:** Save the consent wording version, the choice and the time for each application. Marketing opt-in starts unchecked and is kept separate from the required consent.
- **Notification log:** Record each lead email that was sent or failed, plus its retries. Retries never count as conversions.
- **Landing pages:** Separate pages for Truck, SUV, Car and EV, each linking to the same application with the vehicle already picked (for example `/apply?vehicle=truck`).
- **Progress indicator:** Replace the "About 2 min left" countdown with "Step 3 of 7 · Budget". The spec doesn't allow a countdown.
- **Simple report:** Starts, completed applications and contactable leads, broken down by source and province, for admins only.
- **Mobile checks:** Test every page and every application step at 320, 360, 390, 768, 1024, 1366 and 1920 px wide, in landscape and with the keyboard open. Fix any overflow and save screenshots for the agency.

## Phase 3 — Later (P2)
- Report CRM outcomes (contacted, qualified, sold) to ads, but only if approved.
- Alberta pages and more BC guides once you approve them.

## Decisions needed from you (not built until you confirm)
1. **Currency:** We set USD to match your Meta setup. The spec says to remove value and currency entirely, or use CAD. My plan removes them.
2. **Saving unfinished applications:** We currently save partial forms so we can recover leads. The spec says that needs a separate consent and retention plan. Keep it as is with a consent notice, or turn it off?
3. **Date of birth and income questions:** The spec advises against asking for a full birth date or detailed income up front. Keep them, change them to ranges or year only, or move them to advisor follow-up?
4. **Badges and claims:** "4.9 / 5 rating" needs a link to the real reviews. Confirm where it comes from.
5. **Service area:** The spec says launch in BC, but we now accept all of Western Canada. Keep Western Canada?
6. Legal counsel should approve the consent and data-sharing wording.

## Technical details
- Pixel: `src/routes/apply.tsx` (remove the second SubmitApplication track and value/currency), `src/lib/pixel.functions.ts` and `leads-notify.server.ts` (send CAPI `Lead` with the shared `event_id`, no value/currency). The hostname allowlist lives in `__root.tsx` plus a check on the server.
- Idempotency: add a `client_submission_id` uuid on `leads` with a unique partial index, and have `submitLead` / the draft submit return the existing row on conflict. The assignment RPC is already unique per lead, so delivery isn't touched.
- Test flag: add `is_test` on `leads`, set when the request host isn't production. `autoDeliverLead` and CAPI skip test rows. The sweep job also skips them.
- New tables: `lead_status_history`, `consent_records`, `notification_log` (GRANTs + RLS for admin/superadmin through `has_role`). All are additive, with no changes to existing columns.
- Footer: remove the `/auth` link in `SiteFooter.tsx`.
- Add a short note to AGENTS.md covering the one-conversion rule and the production-only tags.
