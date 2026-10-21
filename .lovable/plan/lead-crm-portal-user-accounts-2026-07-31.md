# Lead CRM portal + user accounts

A second, separate portal at `/crm` for sales users, plus account creation from the superadmin dashboard. Superadmin dashboard stays admin-only.

## 1. User accounts (superadmin dashboard)

In **Team**, add a "CRM users" panel where you:
- Create an account directly with an email + a starting password (no invite email needed), or send an invite.
- Assign the role `agent` (CRM only) or `admin`/`superadmin` (full dashboard).
- Reset a user's password, deactivate/remove access.

Users can change their own password from inside the CRM portal (profile menu → change password), and the existing "Forgot password" flow already works.

## 2. Access separation

- `agent` users sign in at the same `/auth` page and are routed to `/crm`.
- `/admin/*` remains blocked for agents (server checks already enforce this; the UI will also redirect them to `/crm`).
- Admins/superadmins can open both portals; a link is added between them.

## 3. The CRM dashboard (`/crm`)

New design, not a reskin of the admin leads table:
- **Pipeline board + table toggle.** Stages: New, Contacted, Qualified, Sent to dealer, Approved, Sold, Not qualified, Archived (existing lead statuses), drag/select to move.
- **Lead cards** show score chip with colour + emoji, name, phone, source badge (website app / trade-in / Meta lead ad / sheet), and time since arrival.
- **Lead detail drawer** with every captured field grouped (contact, vehicle, trade-in, employment, residence, consent), activity timeline, notes (add/edit/delete), owner assignment, follow-up date, and status/rating controls.
- **Filters and search** across all fields, date range, source, score band, owner, plus saved quick views ("Today", "Unworked", "Hot").
- **Performance view**: leads and conversion counts grouped by campaign / ad / source so you can see which ads perform best (uses the attribution fields already captured).

## 4. Lead scoring and rating

Single shared scoring function used by every intake path (website app, trade-in form, sheet webhook, manual entry):
- Name + phone only = **25** — orange, 🙁
- Fields fill in progressively (email, location, vehicle, budget, credit, employment, trade-in, consent, licence) raising the score
- ~75 = yellow, 🙂
- Completed full application = **100** — green, 😀

Colour bands: <50 orange, 50–89 yellow, 90+ green. Existing leads get rescored once by a backfill.

## 5. Capture everything typed on the site

Audit every public form (apply funnel, trade-in valuation, contact, hero vehicle picker) so that once the first box is accepted, each subsequent field is autosaved onto the same partial lead row — no data lost if they stop midway. Any field without a lead column is stored in the lead's `extra` payload and shown in the CRM detail drawer.

## 6. Desktop-first, then mobile optimized

The CRM is designed as a full desktop web portal first:
- Persistent left sidebar, dense multi-column pipeline board, and a full data table with sortable columns, inline status editing, and a side-by-side lead detail panel.
- Keyboard-friendly: search focus shortcut, arrow-key row navigation, multi-select with bulk actions.
- Wide performance dashboard with campaign/source charts and summary tiles.

The same screens are then adapted for comfortable phone use:
- Sidebar collapses into a drawer; pipeline columns become horizontally swipeable; the table becomes a stacked card list.
- Lead detail opens as a full-screen sheet with a sticky action bar (call, text, email, status, note).
- Tap-to-call and tap-to-text on phone numbers, tap-to-email on emails, 44px+ touch targets, sticky search header, and no horizontal page scrolling.

## 7. Send a lead by email (applicant info only)

From a lead's detail view:
- Enter one or more recipient emails, or quick-pick from a **contacts library** (saved name + email + company, editable).
- Email contains **only applicant information** — name, contact, location, vehicle interest, trade-in, employment, credit, notes. No campaign, ad, UTM, pixel, or internal marketing data.
- Each send is logged; the lead shows a "Sent to" list with recipient, who sent it, and when.

## Technical notes

- Migration: `crm_contacts` (shared email library), `lead_sends` (recipient log), `lead_notes` RLS extended to `agent`, `leads` SELECT/UPDATE policies for `agent`, plus a `public.compute_lead_score` backfill.
- All CRM data access goes through new `createServerFn` handlers in `src/lib/crm.functions.ts` with a `requireCrmUser` guard (agent/admin/superadmin).
- Account creation uses the Supabase Auth admin API from a superadmin-only server function.
- New routes under `src/routes/_authenticated/crm/` with a dedicated `CrmLayout` (distinct visual identity from the admin layout).
