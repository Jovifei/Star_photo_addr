# S3 mobile summary panel fix

Date: 2026-09-21

## User-visible defect

On portrait phones, the Tonight Summary drawer inherited the desktop-style
`88vw` side-panel geometry, leaving a map strip visible on the left. The fixed
`DetailRestore` control remained visible after the drawer opened and covered
summary content, including keyboard-focusable controls.

## Root cause and correction

- Portrait mobile used `width: min(88vw, 420px)` instead of a viewport-width
  sheet. It now uses the full available width; short landscape viewports retain
  the bounded side drawer.
- The drawer already has a close control, so the redundant fixed restore
  control is hidden while any mobile drawer is open.
- Close and tab controls now meet the 48 CSS pixel Material touch target, and
  the single scrolling body reserves safe-area scroll padding.

## Regression evidence

`tests/e2e/mobile-panel-dock.spec.ts` verifies at 375 x 812 that the summary
drawer matches the viewport width, has one vertical scroll container, hides
the restore overlay, and exposes a 48 x 48 close target. The existing 812 x 375
case continues to verify the bounded landscape drawer and horizontal fit.
