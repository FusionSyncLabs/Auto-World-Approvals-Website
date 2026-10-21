# Simplify the homepage hero and rebuild the application funnel

Goal: a lighter, one-question-per-screen experience like the reference site, but in Auto World Approvals branding (navy/electric, our logo, our type). Nothing about the visual identity changes — only the density, ordering, and amount asked per screen.

## Part 1 — Homepage hero, simplified

- Replace the current dense hero with a clean, centered block: headline, one short subline ("Start by picking a vehicle type"), and a row of 4 vehicle tiles (Van, Truck, SUV, Car).
- Vehicle art: real, recognizable branded vehicle **cutouts on transparent backgrounds** — no AI-generated vehicles, no photo backgrounds, no scene shots. Each tile is just the vehicle floating on our background with a soft contact shadow, exactly like the reference.
  - Sourcing: you upload (or point me to) the four cutout PNGs you want to use, or I pull them from the hero-image library if the right ones already live there. I will not generate them.
- Hover / focus animation on each tile: the vehicle lifts and scales slightly, its contact shadow spreads and softens, an electric-blue glow rises behind it, and the "Apply for a …" label + arrow slide right. Tap-friendly equivalent on mobile (press-in scale), and all of it respects reduced-motion.
- Each tile is a single tap that deep-links into the funnel with the vehicle type pre-filled (this already works via the `vt` param).
- Below the tiles: a slim trust strip (Google rating, "X Canadians financed") instead of the current large stat/benefit blocks.
- Keep the rest of the page (How it works, Happy Clients, footer) — just reduce spacing and remove duplicate CTAs so the hero breathes.


## Part 2 — New funnel order

One question per screen. Choice screens are one-click and auto-advance. No personal info until the very end.

```text
(vehicle type chosen on home page)
1   Monthly budget                  one-click
2   Canadian citizen / PR           one-click (Yes / No)
3   Employment status               one-click
4   Employment details              job title + employer -> Continue
5   What is your income             pay frequency (Weekly/Bi-weekly/Monthly) + amount
6   Additional income?              one-click (Yes -> source + amount)
7   Employment length               one-click (3 mo / 9 mo / 1 / 3 / 5 / 10 yrs)
8   Address details — find address  search or enter manually
9   Address details — confirm       street, city, province, postal -> Continue
10  "Searching for vehicles in <Province>" animated overlay (~2s)
11  CONGRATULATIONS — you qualify for pre-approval in <Province>
    consent disclaimer + Continue
12  Address details — rent or own   Rent / Own + monthly payment
13  Address details — how long      one-click (3 mo -> 10 yrs)
14  Confirm eligibility — date of birth (Month / Day / Year)
15  Almost done — first name + last name
16  Complete your application — email + phone -> submit
```

Consent copy on the congratulations screen (branded to us):

> By clicking the Continue button, I confirm my consent to Auto World Approvals' Privacy Policy and consent to Auto World Approvals, car dealers and lenders obtaining credit reports about me to facilitate my application for a car loan.

"Privacy Policy" links to `/privacy`.

## Part 3 — Screen design (ours, not a clone)

We borrow the *structure* — one question per screen, one-click choices, short helper line — and nothing else. The reference is a flat purple-on-white template; ours stays Auto World Approvals.

- Centered single column, max ~560px, our logo top-left, back arrow, thin progress bar.
- Our tokens throughout: navy surfaces, electric accent, our existing rounded-2xl cards, `shadow-3d` depth, and the subtle sheen/glow already in `ChoiceCard` and `StepShell`. No flat purple blocks, no borrowed type scale.
- Choice rows: full-width stacked options for readability, but keeping our card treatment — soft elevation, electric hover sheen, animated check on select — rather than the reference's plain outlined rectangles.
- Our own copy voice on every screen (headline + one supporting line), not the reference's wording.
- The searching and congratulations moments are our own: a branded card with the AWA mark, an electric progress sweep, and a check that draws in — not a plain magnifier and green tick.
- One short helper line with an info icon per screen, in muted foreground.
- Mobile-first: large tap targets, sticky Continue on input screens, reduced-motion respected.


## Technical notes

- `src/lib/funnel/schema.ts`: rewrite `StepId` and `getSteps()` for the order above; add `is_canadian_resident`, `pay_frequency`, `additional_income`/`additional_income_amount`, `employment_length`, `address_length`; drop steps we no longer ask (trade-in, credit rating, licence, down payment, preferred contact) from the default path.
- `src/routes/apply.tsx`: reorder `StepRenderer`, move contact/name/DOB to the end, add the searching overlay and congratulations screens.
- Lead capture timing changes: today a partial lead is created as soon as name + phone are submitted on step 1. With contact info at the end, a partial lead can only be created at step 15/16. Answers and attribution will still autosave from screen 1 as a draft so the CRM sees an in-progress application, but it will have no name/phone until the final screens.
- Lead scoring in `src/lib/lead-score.ts` updated for the new field names so scores stay accurate.
- Province for the searching/congrats screens is derived from the confirmed address, defaulting to BC.
- Drop-off tracking and the existing resume-token/draft plumbing stay as-is.
- Vehicle tiles use transparent PNG cutouts served as CDN assets; animation via Motion/Tailwind transitions already in the project.

## Confirmed

- Contact info stays at the very end of the funnel; anonymous drafts still autosave from screen 1 so in-progress applications appear in the CRM without name/phone.

