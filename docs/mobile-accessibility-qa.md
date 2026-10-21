# Requirement 6 — mobile performance and accessibility

Date: 19 October 2026 (UTC). Environment: local preview, not the published production site.

## Implemented and verified
- Homepage transparent vehicle images reduced from 2,806,636 to 248,120 bytes total (91.2% smaller); complete normalized canvases and transparency preserved. Only the first vehicle receives high loading priority; other vehicle images can load lazily.
- Vehicle tiles become one column below 360 CSS pixels. Header/logo layout no longer pushes application Home offscreen at 320px; site header keeps a stable height instead of shrinking around a larger logo.
- Shared buttons wrap labels and provide visible focus plus minimum 44px targets. Shared inputs have larger heights and readable text. Choices expose selected state and reserve fixed indicator space.
- Step changes focus the question heading. Progress updates and validation errors are announced; required fields expose required state; invalid contact submission focuses the first invalid field. Back/edit preserve in-memory answers.
- Mobile/short-landscape intake header stays in document flow, not above focused fields. Safe-area padding added; no sticky bottom submission bar overlays inputs or consent.
- Cookie controls/dialog reflow, scrollable dialogs and close targets improved. Contact labels are associated with inputs; contact email wrapping/column sizing fixes 320/360px overflow.
- Removed global horizontal clipping so defects cannot be hidden. Fixed gutters and choice indicators preserve usable width when text size doubles.

## Browser evidence
461 recorded page/state checks across 17 viewports: 320x568, 360x740, 375x667, 390x844, 414x896, 430x932, 768x1024, 820x1180, 912x1368, 1024x768, 1280x800, 1366x768, 1440x900, 1536x864, 1920x1080, 2560x1440, 844x390 landscape.

Public pages checked: home, all four vehicle landing variants, BC/Alberta guides, FAQ, contact, privacy, terms, consent, cookies, legal, about, how-it-works, vehicles, sell/trade-in and blog index. Every active step of the employed application branch checked at all sizes. A 390px application was submitted and the server-confirmed receipt rendered; screenshots include the reference, not applicant answers from real customers. Preview test submissions are test records, not live conversions.

Keyboard checks exercised Space to select, Tab/Enter navigation, selected-state confirmation and next-heading focus. Back/contact edit retained entered test answers; required consent and unchecked optional marketing choice verified. Shortened viewport while email focused is a keyboard-height simulation, NOT an actual virtual keyboard.

Automated axe-core WCAG 2 A/AA and 2.1 AA checks returned zero violations on home, apply, contact, privacy, terms, consent and FAQ. This is not a screen-reader audit or accessibility certification. All 42 existing automated tests passed. All content routes contain their own title, description and social metadata. Latest preview build: OK.

Chromium full responsive checks; WebKit and Firefox initial application load spot checks passed. These are not real Safari/Edge devices. A 150ms-latency, 1.5MB/s download and 4x CPU simulation passed vehicle-to-budget interaction. The more restrictive 200KB/s development-module test did not finish hydration within the test timeout; no claim that production slow-network reliability is fully verified.

## Defect and retest log
| Defect | Evidence / result |
| --- | --- |
| Application Home outside 320px header | Baseline detected offscreen Home; retest no offscreen application elements. |
| Contact page 374px document on 320/360px screens | Recorded in results.json; fixed email wrapping and explicit single column. Retest widths 320/360/390 equal viewport. Historical failures retained, not deleted. |
| Choices visually selected only, no focus/announcement | Shared Button, aria-pressed and keyboard-selected-state check passed. |
| Small controls/unassociated contact labels | Larger shared targets/input heights; zero axe violations on checked pages. |
| Consent dialog action row and narrow content | 320px dialog client/scroll width both 282px, visible scrollable content and working close. |
| Doubled text consumed choice width with rem gutters | Final screenshot shows usable labels/indicators; choice text area 184px and budget interaction passed without horizontal overflow. |

## Still required — do not represent these as complete
- Published-site field p75 measurements: LCP <=2.5s, INP <=200ms, CLS <=0.1. Lab/preview screenshots do not establish these; agency needs eligible field data/measurement period.
- Real iOS Safari and Android Chrome complete submission with actual virtual keyboard open, notches, address-bar resizing and orientation changes; dated device recording.
- Actual Safari and Edge full journey, screen-reader spot checks (VoiceOver/TalkBack), native browser 200% and 400% zoom; 320px emulation/doubled-root-font testing are partial reflow evidence only.
- Exhaustive conditional income-source branches, all blog articles and dynamic published image overrides; this run covered active employed steps and a retired-income keyboard path, not every possible data combination.
- Production slow-connection full submission and failed-network/retry tests. No publication was requested or performed.

The evidence bundle retains dated screenshots, raw layout checks (including resolved historical defects), accessibility/test logs and this report. No applicant data from live customers was used.