# TopFilterBar Specification

## Overview

- Target file: `src/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/TopFilterBar.tsx`
- Interaction model: click/input/select-driven
- Visual reference: `desktop-reference.png`, `mobile-reference.png`

## Structure

- Fixed horizontal `header` with a left brand block and a wrapping control group.
- Brand: circular astronomy mark, `h1`, author/version line, and subtitle.
- Controls: Bortle select, VIIRS layer toggle, label select, visitor badge, photography/visual mode buttons, search input, date select, export and refresh buttons.

## Exact reference values

- Desktop height: `64px`; horizontal padding: `0 24px`.
- Background: `linear-gradient(135deg, #0d1b3e 0%, #1a1f4e 100%)`.
- Text: `#e0e6ed`; heading `20px`, `700`; base font stack is the system CJK stack documented in `BEHAVIORS.md`.
- Select surface: `#1a2244`, `1px solid #3a4a7e`, `4px` radius, `15px` control font.
- Search field: `280px` wide, `40px` high, `2px solid #3a4a7e`, `22px` radius.
- Active VIIRS button: transparent dark surface, `1px solid #e91e63`, `6px` radius.

## Behavior

- All controls use real form/button elements and retain `44px` minimum touch targets in the clone.
- Mode buttons update legend wording and the status note.
- Search filters the visible local marker set and announces the match count.
- Date changes the displayed date label and selected detail context; it does not fabricate remote forecast values.
