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
- **Error:** provider refresh failures appear as an orange `Refresh failed` HUD signal with `showing last valid observation`; the observational UI contains no manual retry control.
- **No viable route:** neutral route styling and explicit guidance to stop/reassess; never invent a recommendation.

## Responsive Behavior

Above `900px`, the map and mission panel use the desktop split layout. At `900px` and below, content stacks and the map occupies approximately 58% of the small viewport height before the decision panel. At `560px` and below, evidence fields collapse to one column and compact spacing/type rules apply. The panel remains normal document flow rather than a modal surface.

## Accessibility

All controls require labels, keyboard access, visible focus, adequate contrast, text equivalents for route colors, and reduced-motion support. Cesium interactions need non-map alternatives for essential information.

## Implemented Recommendation State

After session evaluation, the highest-ranked valid route changes to signal green on both the map and route list. The original pre-session choice remains orange when different, and other routes remain moss. A compact recommendation panel shows route name, suitability, policy version, and a reminder to compare against official guidance and actual field conditions.

## Phase 7 Responsive and Motion Details

- Evaluation displays a compact map-overlay instrument with explicit status text; it is also announced as a live status.
- Recommendation evidence uses three columns on wide screens and one column below `560px`.
- Below `900px`, the map occupies approximately 58% of the small viewport height before the decision panel.
- The camera frames a recommendation over 1.6 seconds unless reduced motion is requested.
- Error text provides a retry path through the unchanged session-start action.

## Decision Signal Feed

After session start, a compact field-log panel appears below the recommendation. It shows connection state, newest-first event sequence, decision type, recommended route, material triggers, and local time. It is an observational surface only: it contains no refresh, evaluation, or simulation control. On narrow screens it remains in normal document flow beneath the recommendation.

## Trail Provenance State

The selected-hike card links to the Massachusetts DCR geometry source and displays its dataset date. Route cards show `unknown` rather than inferring exposure or access. Known hard exclusions disable the route, replace its score with an Excluded label, and list reasons in a no-route alert when every option is blocked. Persistent safety copy tells users to check current DCR notices and posted closures because the checked-in geometry is not a live advisory feed.
## Supported Trail Search

A prominent field-index search sits before the selected-hike card. On submit it combines immediate reviewed-route matches with named linear trail results from the OpenStreetMap internet index. Each result identifies whether it is reviewed or an internet preview and shows location and mapped distance. Selecting an internet result camera-frames its geometry, updates the selected card, links to the source object, and explicitly disables field-session start because arbitrary results do not yet have reviewed alternatives. The control locks while a session is active, shows searching/error/empty states, and displays OpenStreetMap attribution.

## Active Session Control

While a field session is active, the start action is replaced by a full-width outlined End field session button. During the request it reads Ending field session… and cannot be pressed twice. Success removes the live HUD, recommendation, and decision feed while preserving the selected trail; search and route selection become available immediately.

## Readable Typography Scale

Operational labels and metadata use an 11 px minimum, compact controls use 12-15 px, body copy uses 14-17 px, and display headings retain the larger editorial scale. Search input text and route metadata are at least 13 px on desktop and mobile. Layouts may grow vertically rather than compressing essential text below this floor.

## Terrain Status and Attribution

The map status explicitly reads Global elevation terrain for the keyless default or Cesium World Terrain for the token-based source. Initialization and failure states remain visible. Elevation-provider credits stay on the map and cannot be hidden by the application chrome. Trail lines, endpoint markers, and labels follow the terrain surface.
