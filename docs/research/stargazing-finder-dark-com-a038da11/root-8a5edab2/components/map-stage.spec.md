# MapStage Specification

## Overview

- Target file: `src/components/sites/stargazing-finder-dark-com-a038da11/root-8a5edab2/FinderMap.tsx`
- Interaction model: pan/zoom plus click-driven marker selection

## Structure

- `MapContainer` fills the space below the fixed header.
- Dark Carto basemap provides the attribution-safe base; a restrained blue-black overlay and grid/contour texture evokes the reference's VIIRS dark-sky raster without copying its third-party raster.
- A representative set of project-owned stargazing locations renders as colored markers with labels.
- Upper-left legend and upper-right status are absolutely positioned overlays; map controls stay clear of both.

## Behavior

- Marker color encodes the demo Bortle class: cyan/green for darker skies, amber for transition zones, red for brighter skies.
- Clicking a marker sets the selected location and opens the bottom detail sheet.
- Search/filter changes marker visibility without changing the map center.
- Selecting the map layer toggle switches between a dark-sky texture and a neutral dark base state; the legend explains the active layer.

## Responsive behavior

- Desktop: full-height map workspace under a 64px header.
- Narrow view: map remains the primary surface; the legend and status panels shrink and detail uses a bottom drawer.
- No page-level horizontal overflow; the internal detail sheet may scroll vertically.
