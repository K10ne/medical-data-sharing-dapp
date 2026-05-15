# MedLedger DApp Design System

## Product Position

MedLedger is a healthcare privacy and audit workstation, not a marketing website. The interface should feel like a professional clinical operations tool: calm, precise, dense enough for repeated work, and explicit about risk.

## Visual Direction

- Style: refined clinical utility with audit-console discipline.
- Mood: trustworthy, controlled, modern, privacy-focused.
- Avoid: generic purple gradients, oversized hero marketing sections, decorative blobs, emoji icons, playful healthcare cliches.

## Color Tokens

- `--ink`: #10201c
- `--muted`: #66756f
- `--surface`: #ffffff
- `--surface-soft`: #f4f8f6
- `--surface-strong`: #e7efeb
- `--line`: #d8e3de
- `--primary`: #0d6b5f
- `--primary-strong`: #084c45
- `--accent`: #0b85a1
- `--success`: #147a4d
- `--warning`: #a86207
- `--danger`: #b42318
- `--chain`: #314158
- `--focus`: #147d8f

## Typography

- Use a calm humanist sans stack for UI text.
- Use a tabular numeric stack for hashes, addresses, counters and block numbers.
- Base body size is 16px with line-height 1.5.
- Dense table text may use 13px-14px, but never below 12px.
- Letter spacing stays at 0.

## Layout

- App starts at the dashboard, not a landing page.
- Use a left navigation rail on desktop and a compact top navigation on mobile.
- Cards are for individual functional panels only, with radius <= 8px.
- Avoid cards inside cards.
- Tables, timelines and forms should have stable dimensions and no hover-driven layout shifts.

## Interaction

- All buttons have visible focus states and disabled states.
- Icon-only buttons require aria-label and tooltip/title.
- Critical actions such as revoke grant need confirmation UI.
- Loading states must distinguish chain transaction, encryption, upload and indexing.

## Accessibility

- Contrast must meet WCAG AA.
- Forms use visible labels, helper text and inline errors.
- Information is never conveyed by color alone.
- Respect `prefers-reduced-motion`.

## Data Visualization

- Audit timelines use event type labels plus status marks.
- Charts are secondary and compact: avoid decorative analytics.
- Use tabular numerals for counts, gas estimates, expiry timers and block heights.
