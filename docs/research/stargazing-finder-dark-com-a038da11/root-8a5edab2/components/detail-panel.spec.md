# DetailPanel Specification

## Overview

- Target file: `src/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/LocationDetail.tsx`
- Interaction model: marker-selection-driven, closeable bottom sheet

## Structure

- Panel header: selected place name, province, elevation, Bortle chip, and close button.
- Metric grid: sky class, cloud cover, rain probability, wind, and best observation window.
- Source note: clearly says demo values are local UI fixtures, not a live provider response.
- Action: link to the existing `/` route with the selected place encoded as a safe query state.

## Visual behavior

- Dark blue-black surface with a cyan top border and subtle backdrop blur.
- Desktop panel is bounded to about 420px height and internally scrollable.
- Mobile panel is full width, max-height `72vh`, with a visible grab handle and `44px` close target.
- Empty/unknown fields use `—` and an explanatory note rather than zero.
