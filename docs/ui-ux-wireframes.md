# UI/UX Wireframes

## Experience Principles

The 3D map is primary. Conditions and recommendations must be glanceable, route alternatives comparable, and uncertainty/staleness visible. There is no simulation button.

## Main Screen

```text
┌──────────────────────────────────────────────────────────────────────┐
│ ProbablyThisWay    [Choose hike ▾]              Session status       │
├───────────────────────────────────────────────┬──────────────────────┤
│                                               │ CURRENT CONDITIONS   │
│              3D TERRAIN MAP                   │ Weather / Wind       │
│                                               │ Time / Daylight      │
│       trail ─────────────                     │ Pace / Fatigue       │
│             ╲ route A (recommended)           ├──────────────────────┤
│              ╲ route B                        │ ROUTES               │
│                                               │ ● Summit       82%   │
│  [map controls]                               │ ○ Descent      55%   │
│                                               ├──────────────────────┤
│                                               │ WHY THIS ROUTE       │
│                                               │ concise factors      │
├───────────────────────────────────────────────┴──────────────────────┤
│ DECISION FEED: time · state/evaluation event · outcome               │
└──────────────────────────────────────────────────────────────────────┘
```

## States

- **Choose hike:** map placeholder and supported-hike picker.
- **Loading:** terrain skeleton/progress and non-blocking panel placeholders.
- **Ready:** all alternatives visible; recommendation has color plus pattern/weight, not color alone.
- **Updating:** retain the last valid route and show evaluation progress.
- **Stale/offline:** display data age and affected inputs.
- **Error:** actionable retry and provider-specific failure summary.
- **No viable route:** neutral route styling and explicit guidance to stop/reassess; never invent a recommendation.

## Responsive Behavior

Desktop uses map plus side panel. On narrow screens, the map remains dominant and details move into an accessible bottom sheet. Exact breakpoints are TBD.

## Accessibility

All controls require labels, keyboard access, visible focus, adequate contrast, text equivalents for route colors, and reduced-motion support. Cesium interactions need non-map alternatives for essential information.
