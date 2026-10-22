# Responsive layout verification — 22 October 2026

Scope: the active Next.js public website, shared customer controls and financing intake.

## Changes

- Flexible button/input heights, wrapping choices and badges, font-aware form grids, bounded logos and contact text.
- Phone/tablet/desktop spacing, readable legal/blog layouts, locally scrolling tables/code, and viewport-bounded calendars/dialogs/sheets.
- Customer-carousel arrows stay inside the page at tablet/laptop widths. Pagination adapts to its available width and retains one row. Existing swipe, arrow and dot navigation remains available.
- Mobile headings remain centered and descriptive copy justified. Browser font-size preferences are respected.
- Homepage hero text and vehicle tiles are visible in the server-rendered first frame.

## Browser checks

- 126 public-page checks: 21 routes at 320×568, 390×844, 768×1024, 1024×768, 1440×900 and 844×390.
- 55 intake checks across 11 question/review states at five widths/heights. Fictional answers stayed in memory; no application was submitted. Step-heading focus and the disabled unacknowledged submission action were checked.
- Homepage checks covered 13 sizes from 320 to 2560 CSS pixels, including tablet, laptop and short landscape. No document overflow or offscreen primary controls remained; dots stayed in one row.
- Additional 280px check confirmed pagination reduces its visible dot window and restores it after widening.
- Cookie dialog checked at five sizes, including a 390px-high landscape viewport. Full-row preference toggling worked; the test choice was restored without saving.
- Mobile menu stayed reachable in landscape; Escape closed it and returned focus to the menu button. DOB calendar stayed inside the 320px viewport.

TypeScript and production builds passed. Detailed viewport results and phone/tablet/desktop screenshots are saved in `scratch/mobile-qa/`.

## Verification limits

These are Chromium viewport checks, not physical-device, screen-reader or actual virtual-keyboard testing. Published blog article content was unavailable in the local preview; the article template was inspected and compiled. Existing production analytics, lead delivery and application submission were not exercised.
