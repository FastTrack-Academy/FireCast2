# FireCast design direction

Concept assets were generated with the built-in Image Gen tool and used as implementation references, not as application screenshots or scientific imagery.

- Primary concept: `overview-concept.png`
- Model detail concept: `hmm-concept.png`

## Generation brief

A full, production-implementable FireCast wildfire research dashboard: a charcoal navigation rail, true-white analysis canvas, ember-orange accent, restrained borders, clean sans-serif typography, and a map-first primary workflow. Preserve year/fire selection, observed boundary progression, playback, weather, a five-state Gaussian HMM, transition and initial probabilities, emission features, decoded timeline, observed transitions, and the five original terrain views. The primary screen places the map beside a state outlook, with a shared playback strip and weather/interpretation below. The HMM screen uses a probability heatmap, initial distribution, timeline, transition graph and emission table. All UI is native HTML/CSS/SVG/canvas; imagery must never substitute for scientific data. No unrelated product sections or invented risk/containment metrics.

## Implementation tokens

- Canvas / surfaces: #ffffff
- Sidebar: #181e22
- Text: #1b222b; muted text #7b818c
- Borders: #e8eaee
- Ember action: #ef693e; hover #dc572c
- States: #6b9c96, #709bc4, #9a87b8, #e6ae51, #ed6a45
- Typography: self-hosted Inter Variable, 34px desktop main title, 17px panel headings, deliberate 10–13px analytical UI. Mobile uses a compact navigation strip and stacked analysis panels.
- Geometry: 216px sidebar, 26px main gutters, 14px panel spacing, 8px panel radii. Single-purpose analytical panels, not a marketing-page card grid.
- Motion: subtle control/state transitions; reduced-motion support.

## Deliberate refinements of illustrative concepts

The generated concepts contain illustrative values and some incorrect scientific labels. Production uses actual source values, dates and geometry throughout. The default fire has six observations, not the concept's invented 28-day sequence. The date control is an observation cutoff. There are no forecast polygons or speculative area curves: forecasts show state probabilities only. Correct state IDs replace invented concept labels; original-feature emissions replace invented concept feature names. Map imagery comes from actual attributed map tiles, and boundaries come from the original dataset. The state interpretation highlights the selected state, with the complete five-state guide in HMM explorer. Terrain/data views extend the same visual system. A compact CSV import/result workflow is included for running new observation sequences.
