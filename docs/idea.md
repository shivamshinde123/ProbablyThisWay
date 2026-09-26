# ProbablyThisWay — MVP Project Plan

## 1. Project Goal

Build a simple hiking decision-support application that combines:

- 3D terrain visualization
- real hiking trails
- route alternatives
- current weather and daylight information
- Jev-based decision making

The main idea is:

> Show the user a hiking route in 3D, generate a few valid route options, and let Jev decide which route currently makes the most sense.

The first version should focus only on the core experience. Advanced personalization, wearables, group hiking, offline mode, and complex safety intelligence can be added later.

---

## 2. Core User Experience

The MVP should support this flow:

1. User opens the application.
2. User selects a hiking trail.
3. The trail appears on a 3D terrain map.
4. The system shows basic trail information.
5. The routing system generates valid route alternatives.
6. The application collects current conditions.
7. Jev evaluates the available routes.
8. The recommended route is highlighted on the 3D map.
9. Jev re-evaluates the options when current conditions change.
10. The recommended route updates visually.

This route change is the main demonstration of the project.

---

## 3. MVP Scope

The MVP should include only five major capabilities.

### 3.1 3D Terrain Map

The application should display a realistic 3D terrain view.

Recommended stack:

- Next.js
- TypeScript
- CesiumJS
- Google Maps Platform Photorealistic 3D Tiles

The user should be able to:

- zoom
- rotate
- tilt the camera
- inspect the mountain or hiking area
- see the selected hiking trail
- see route alternatives

---

### 3.2 Trail Selection

For the MVP, support a small number of predefined trails rather than building a complete trail-search platform.

Each trail should contain:

- trail name
- route geometry
- trailhead
- distance
- elevation gain
- estimated duration
- difficulty
- route type

Example:

```text
Trail: Franconia Ridge Loop
Distance: 8.6 miles
Elevation gain: 3,900 ft
Estimated duration: 6 hours
Difficulty: Hard
```

Starting with only one or a few well-defined trails will keep development manageable.

---

### 3.3 Route Alternatives

The system should generate or load two to three valid route options.

Example:

```text
Route A — Continue to summit
Route B — Take alternate descent
Route C — Return to trailhead
```

Each route should contain:

```text
distance
elevation gain
elevation loss
estimated duration
route geometry
difficulty
```

Important rule:

> Jev should never invent the route.

The routing or GIS layer determines which paths physically exist.

Jev only evaluates the valid alternatives.

---

### 3.4 Environmental Context

For the MVP, use only a few environmental signals.

Required:

- current time
- sunset time
- temperature
- wind speed
- precipitation or rain probability

Optional for later:

- visibility
- humidity
- cloud cover
- trail surface condition
- storm probability

Example state:

```text
Current time: 3:40 PM
Sunset: 6:05 PM
Temperature: 54 F
Wind: 24 mph
Rain probability: 30%
```

---

### 3.5 Jev Decision Layer

Jev receives the current hiking state and valid route options.

Example input:

```text
USER

Experience:
Intermediate

Goal:
Reach summit if reasonable


CURRENT STATE

Time:
3:40 PM

Sunset:
6:05 PM

Current pace:
1.6 mph

Expected pace:
2.0 mph

Fatigue:
Moderate


WEATHER

Temperature:
54 F

Wind:
24 mph

Rain probability:
30%


ROUTES

Route A:
Continue to summit
Distance: 2.3 mi
Elevation gain: 1,400 ft
Estimated duration: 1h 50m

Route B:
Alternate descent
Distance: 3.0 mi
Elevation gain: 300 ft
Estimated duration: 1h 20m

Route C:
Return
Distance: 2.1 mi
Estimated duration: 55 min
```

Jev can answer bounded questions such as:

```text
Is Route A appropriate given the current state?

Is Route B appropriate given the current state?

Is Route C appropriate given the current state?

Is continuing toward the summit justified?

Would switching routes meaningfully improve the outcome?

Is the current plan likely to finish before sunset?
```

Example output:

```text
Route A suitability: 0.36
Route B suitability: 0.84
Route C suitability: 0.61

Finish before sunset on Route A: 0.42
Rerouting justified: 0.81
```

The application then applies a deterministic policy.

Example:

```python
if route_b_score > route_a_score and route_b_score > 0.75:
    recommended_route = route_b
```

---

## 4. Main UI

Keep the MVP interface simple.

### Main Screen

The main screen should contain:

#### Left / Main Area

3D terrain map.

Show:

- selected trail
- current location
- planned route
- alternative routes
- recommended route

Suggested visualization:

```text
Blue   = original route
Green  = recommended route
Yellow = alternative
Red    = discouraged route
```

---

### Side Panel

Display only essential information.

Example:

```text
Franconia Ridge Loop

Current position:
3.2 / 8.6 mi

Sunset:
2h 25m

Current pace:
1.6 mph

Wind:
24 mph


Jev Recommendation

Take Alternate Descent

Route suitability:
84%
```

Include a short explanation such as:

```text
Your pace is slower than expected and the summit route requires
significantly more elevation before sunset.
```

---

## 5. Live Re-Evaluation

The application refreshes current conditions automatically and runs Jev again when a relevant value changes.

Example:

Before:

```text
Route A — Summit
Suitability: 78%

Route B — Descent
Suitability: 62%
```

After a live condition change:

```text
Route A — Summit
Suitability: 33%

Route B — Descent
Suitability: 87%
```

The map changes the highlighted route.

This is the core Jev demonstration.

---

## 6. Architecture

```text
                    Trail Data
                        |
                        v
                 Route Generator
                        |
               Route A / B / C
                        |
        +---------------+---------------+
        |               |               |
        v               v               v
     Weather         Daylight      Current State
        |               |               |
        +---------------+---------------+
                        |
                        v
                       Jev
                        |
                 Route Scores
                        |
                        v
               Decision Policy
                        |
                        v
               Recommended Route
                        |
                        v
                  3D Map UI
```

---

## 7. Responsibilities of Each Component

### GIS / Routing Layer

Responsible for:

- valid trail geometry
- intersections
- route alternatives
- distance
- elevation
- route geometry

It answers:

> Where can the user physically go?

---

### Jev

Responsible for:

- contextual judgment
- comparing route suitability
- assessing whether rerouting is justified
- assessing whether current conditions still support the original plan

It answers:

> Which valid option makes the most sense right now?

---

### Application Policy

Responsible for:

- thresholds
- selecting the displayed recommendation
- deciding when confidence is too low
- presenting multiple options when no route clearly dominates

It answers:

> What should the application show the user?

---

### 3D UI

Responsible for:

- terrain visualization
- route overlays
- current location
- highlighted recommendation
- route details

It answers:

> How does the user understand the decision spatially?

---

## 8. Technical Stack

### Frontend

```text
Next.js
TypeScript
CesiumJS
```

### 3D Terrain

```text
Google Maps Platform
Photorealistic 3D Tiles
```

### Backend

```text
Python
FastAPI
```

### Decision Layer

```text
Jev
```

### Database

For MVP:

```text
PostgreSQL
```

Later:

```text
PostGIS
```

PostGIS is useful once spatial queries become more important.

---

## 9. MVP Data Model

### Trail

```text
id
name
distance
elevation_gain
difficulty
estimated_duration
geometry
```

### Route

```text
id
trail_id
name
distance
elevation_gain
elevation_loss
estimated_duration
geometry
```

### HikingState

```text
current_time
sunset_time
current_distance
current_pace
fatigue
temperature
wind_speed
rain_probability
```

### JevDecision

```text
route_id
suitability_score
completion_probability
reroute_score
timestamp
```

---

## 10. User Inputs

Keep user input minimal.

For the MVP:

```text
Experience level

Beginner
Intermediate
Advanced
```

```text
Today's goal

Relaxed
Scenic
Challenge
Summit
```

```text
Fatigue

Low
Moderate
High
```

Everything else should come from trail or environmental data.

---

## 11. Main Jev Questions

Start with only a small number of questions.

### Route Suitability

```text
Is this route appropriate given the user's current state?
```

### Daylight

```text
Is the user likely to complete this route before sunset?
```

### Rerouting

```text
Would switching from the current route to this alternative
meaningfully improve the expected outcome?
```

### Continue

```text
Is continuing on the current route justified?
```

That is enough for the first version.

Do not create dozens of Jev decisions initially.

---

## 12. Safety Boundary

The project should clearly communicate that it is a decision-support prototype.

It should not say:

```text
This route is safe.
```

Prefer:

```text
Based on the available information, Route B currently appears
more appropriate than Route A.
```

The application should not:

- invent trails
- override official trail closures
- invent weather data
- guarantee route safety
- act as an emergency navigation system
- imply that Jev replaces human judgment

Official restrictions and closures should always override Jev decisions.

---

## 13. First Demo Scenario

Use one predefined hiking area.

Example scenario:

### Initial State

```text
Time:
1:00 PM

Weather:
Good

User:
Intermediate

Route A:
Summit route

Route B:
Alternate descent
```

Jev output:

```text
Route A suitability: 0.81
Route B suitability: 0.58
```

Map highlights Route A.

---

This initial recommendation should be the primary portfolio demo.

---

## 14. Development Order

### Phase 1 — 3D Map

Get a real mountain or hiking area rendering correctly.

Do not add AI yet.

---

### Phase 2 — Trail Overlay

Display a real trail on the terrain.

---

### Phase 3 — Route Alternatives

Display two or three valid alternatives.

---

### Phase 4 — Static Hiking State

Create structured sample data for:

```text
weather
time
pace
fatigue
```

---

### Phase 5 — Jev

Send:

```text
current state
+
route alternatives
```

to Jev.

Return route suitability scores.

---

### Phase 6 — Route Highlighting

Highlight the highest-ranked route.

---

### Phase 7 — Polish

Add:

- better camera movement
- clean route cards
- loading states
- short decision explanations
- responsive layout

---

## 15. What Is Not in the MVP

Do not build these initially:

- live GPS tracking
- wearable integration
- automatic fatigue detection
- group hiking
- offline maps
- full trail search
- user-generated trail reviews
- social features
- advanced hiking history
- long-term personalization
- machine-learning-based hiking pace prediction
- voice assistant
- emergency response functionality
- route sharing
- automatic trail-condition detection

These can be future additions.

---

## 16. Future Features

Once the main experience works, possible extensions include:

### Live GPS

Update the hiking state using actual user position.

### Personalized Pace

Learn the user's typical pace based on terrain and elevation.

### Hiking History

Use previous hikes to improve Jev decisions.

### Personalized Difficulty

Instead of:

```text
Official difficulty: Hard
```

show:

```text
Estimated difficulty for you: Moderate-Hard
```

### Wearable Data

Potential signals:

```text
heart rate
pace
activity
elevation
```

### Group Hiking

Evaluate whether a route fits the whole group.

### Offline Mode

Cache:

- route geometry
- terrain information
- essential trail data

### Trail Discovery

Eventually allow:

> Find a hike that matches what I want to do today.

---

## 17. Core Engineering Principle

The project should follow this rule:

> Deterministic systems establish facts and valid possibilities. Jev judges between those possibilities.

Example:

```text
GIS:
These three trails exist.

Weather API:
Wind is currently 24 mph.

Elevation data:
Route A climbs another 1,400 ft.

Routing engine:
Route B reaches the trailhead in approximately 80 minutes.

Jev:
Given the current state, Route B is more appropriate.
```

This makes the architecture clear and technically defensible.

---

## 18. MVP Success Criteria

The MVP is successful when a user can:

1. Open a real 3D hiking area.
2. See a real trail.
3. See multiple valid route choices.
4. View current hiking conditions.
5. Run a Jev evaluation.
6. See one route highlighted as the current recommendation.
7. See Jev re-evaluate when live conditions change.
8. Visually see the recommended route change.

If these eight steps work smoothly, the core concept is proven.

---

## 19. One-Sentence Product Description

> A 3D hiking decision-support app that uses Jev to evaluate valid route options as conditions change.

---

## 20. Short Portfolio Description

ProbablyThisWay is an experimental 3D hiking decision application that combines real trail geometry, environmental context, route alternatives, and Jev-based probabilistic decisions. Instead of generating paths, the system uses GIS to establish valid routes and Jev to judge which option best fits the current hiking state. As conditions such as weather, daylight, pace, or fatigue change, the recommended route updates directly on the 3D terrain.


---

# 21. Updated Real-Time Intelligence Architecture

The MVP should use a two-model architecture:

- an LLM for deciding **what needs to be evaluated**
- Jev for repeatedly evaluating those questions in near real time

The LLM should not sit inside the critical live loop on every state update.

The preferred architecture is:

```text
                    SESSION START
                         |
                         v
             APPROVED QUESTION CATALOG
                  optional LLM subset
                         |
                         v
                   QUESTION SET
                         |
                         v
WEATHER / TIME / USER STATE
              |
              v
         STATE UPDATE
              |
              v
      CHANGE / EVENT DETECTOR
              |
              v
                 JEV EVALUATION
              |
              v
          PROBABILITIES
              |
              v
       DETERMINISTIC POLICY
              |
              v
        ROUTE RECOMMENDATION
              |
        +-----+-----+
        |           |
        v           v
     3D MAP      LIVE HUD
```

The application should follow this principle:

> LLM decides what needs to be judged. Jev performs the fast judgment. Code decides what action to take.

---

# 22. LLM Role

When enabled, the optional LLM integration operates outside the fast decision loop.

Its main responsibilities are:

## 22.1 Session Initialization

When the user starts a hike, the question service loads an approved default question set. If the optional LLM integration is enabled, it receives:

```text
selected trail
route alternatives
available weather variables
user experience
user goal
available hiking-state fields
```

The LLM may choose a bounded subset of approved Jev questions. Missing, unavailable, or invalid LLM output falls back to the default set.

Example:

```text
Is continuing on the summit route appropriate?

Is the alternate descent preferable?

Is there sufficient remaining daylight?

Is the current pace materially below the expected pace?

Does the current state justify rerouting?
```

These questions are cached for repeated Jev evaluation.

---

## 22.2 Question Selection

Prefer maintaining a predefined question library.

Example:

```text
route_suitability
daylight_sufficiency
weather_fit
pace_deviation
reroute_need
turnaround_need
fatigue_fit
```

The LLM can select the appropriate subset for the current hike.

Example:

```text
Available:
Q1 route_suitability
Q2 daylight_sufficiency
Q3 weather_fit
Q4 pace_deviation
Q5 reroute_need
Q6 turnaround_need
Q7 fatigue_fit

Selected:
Q1
Q2
Q4
Q5
```

This is preferred over letting the LLM continuously invent arbitrary questions.

---

## 22.3 New Question Generation

If the current scenario cannot be represented by the existing library, the optional LLM integration can propose a new bounded Jev question for validation.

This should happen rarely.

Example trigger:

```text
unexpected trail closure
new route branch
user changes hiking objective
new environmental condition becomes relevant
```

Only a proposal that passes the deterministic question schema and application safety rules is added to the active session question set. Otherwise the approved defaults remain active.

---

## 22.4 Explanation Generation

After Jev makes a decision, the LLM can create a concise human-readable explanation.

Example Jev output:

```text
reroute_needed = 0.87
daylight_sufficient = 0.31
summit_route_fit = 0.38
alternate_route_fit = 0.86
```

The LLM may generate:

```text
Your current pace puts the summit route beyond the expected daylight window.
The alternate descent reduces both remaining elevation and estimated duration.
```

This explanation does not block the actual route update.

The map can update immediately from Jev while the explanation arrives slightly later.

---

# 23. Real-Time Jev Loop

Jev should handle the repeated, low-latency decision process.

The MVP continuously updates state from supported sources:

```text
weather
time
pace
fatigue
```

GPS position and route progress join this loop only in the post-MVP live-GPS feature.

The live loop is:

```text
state change
     |
     v
change detector
     |
     v
Jev evaluates active questions
     |
     v
probabilities returned
     |
     v
policy evaluates scores
     |
     v
route recommendation updates
     |
     v
3D map + HUD update
```

Jev should not necessarily be called every second.

The application should trigger evaluation only when meaningful changes occur.

---

# 24. Event and Threshold Triggers

Possible re-evaluation triggers:

```text
user reaches a trail junction
pace changes by more than 15%
ETA changes by more than 10 minutes
wind changes by more than a configured threshold
rain probability crosses a threshold
fatigue level changes
sunset margin crosses a threshold
route availability changes
user changes goal
fixed re-evaluation interval passes
```

Example:

```text
PACE
Expected: 2.0 mph
Current: 1.6 mph

Deviation: 20%

Threshold exceeded
→ Trigger Jev evaluation
```

This makes the app feel real-time without unnecessary model calls.

---

# 25. Live Decision Feed

The left side of the 3D map should display a live white-text decision feed.

It should show explicit application events, metrics, and Jev outputs.

It should not display hidden model reasoning or chain-of-thought.

Example:

```text
JEV LIVE

18:42:03  State updated
18:42:03  Current pace: 1.6 mph
18:42:04  Expected pace: 2.0 mph
18:42:04  Summit ETA exceeds sunset
18:42:05  Ridge wind: 24 mph
18:42:05  Evaluating 3 valid routes
18:42:06  Summit route: 36%
18:42:06  Alternate descent: 84%
18:42:06  Return route: 61%
18:42:07  Recommended -> Alternate descent
```

The feed should be generated from structured application events.

---

# 26. Structured Event Model

The backend should emit structured events.

Example pace event:

```json
{
  "type": "pace_change",
  "timestamp": "18:42:04",
  "value": 1.6,
  "expected": 2.0
}
```

Example Jev event:

```json
{
  "type": "jev_evaluation",
  "routes": {
    "summit": 0.36,
    "descent": 0.84,
    "return": 0.61
  }
}
```

Example recommendation event:

```json
{
  "type": "recommendation_changed",
  "from": "summit",
  "to": "descent"
}
```

The frontend converts these events into readable lines.

Example:

```text
18:42:04 Pace dropped below expected
18:42:06 Alternate descent suitability: 84%
18:42:07 Route changed -> Alternate descent
```

---

# 27. Map-First UI

The 3D map should become the primary interface.

Avoid a traditional dashboard layout.

The main composition should be:

```text
+---------------------------------------------------------------+
| JEV LIVE                                                      |
| 18:42:03 State updated                                        |
| 18:42:04 Pace below expected                                  |
| 18:42:05 Evaluating routes...                                 |
| 18:42:06 Alternate descent: 84%                               |
| 18:42:07 -> Alternate descent                                 |
|                                                               |
|                         3D TERRAIN                            |
|                              ^                                |
|                        summit route                           |
|                            /                                  |
|                         USER                                  |
|                           \                                   |
|                            \---- recommended route             |
|                                                               |
| TEMP 54 F   WIND 24 mph   SUNSET 1h39m                       |
| PACE 1.6    REMAINING 3.0 mi   +300 ft                       |
+---------------------------------------------------------------+
```

All essential information should appear directly over the map.

---

# 28. HUD Information

The bottom HUD should show concise real-time information.

Recommended MVP fields:

```text
temperature
wind
rain probability
sunset countdown
current pace, when available
```

Distance remaining, elevation remaining, estimated completion time, and route progress require a real position source and are post-MVP fields.

Example:

```text
54 F      WIND 24 mph      RAIN 30%
SUNSET 1h 39m

PACE 1.6 mph
```

These values should be programmatically derived from APIs and application state.

---

# 29. Real-Time Data Flow

Example weather flow:

```text
Weather API
     |
     v
application state
     |
     v
HUD update
     |
     +----> threshold detector
               |
               v
          Jev re-evaluation
```

Post-MVP route progress flow:

```text
GPS
     |
     v
current position
     |
     v
route progress
     |
     v
distance remaining
     |
     v
HUD update
```

---

# 30. On-Map Route Labels

Route information should appear spatially when useful.

Example:

```text
                 SUMMIT
                 2.3 mi
                 +1,400 ft
                 36%
                    ^
                   /
                  /
             USER
               \
                \
                 \  ALT DESCENT
                    3.0 mi
                    +300 ft
                    84%
```

This allows the user to understand the Jev decision directly in geographic context.

---

# 31. Visual Language

Most informational text should be white.

Use route colors only to communicate route state.

Recommended convention:

```text
Green   current recommendation
Red     currently discouraged
Yellow  viable alternative
Blue    original planned route
White   neutral information
```

Use translucent dark backgrounds or text shadows behind white text for readability over terrain.

---

# 32. Updated MVP Interaction Model

The simplified MVP should now focus on three user actions:

## 1. Choose Hike

The user selects one of the predefined trails.

## 2. Start Session

The question service loads the approved default Jev question set. If enabled, an optional LLM may select a bounded subset and must fall back to the defaults.

The map displays:

```text
trail
route options
weather
time
user state
```

## 3. Watch the Decision Change

The system receives live state changes.

Jev re-evaluates.

The highlighted route changes.

The decision feed records what happened.

This should be the primary demo experience.

---

# 33. Updated Demo Scenario

## Initial State

```text
Time:
1:00 PM

Wind:
8 mph

Pace:
2.1 mph

Fatigue:
Low
```

Jev:

```text
Summit route: 0.82
Alternate descent: 0.55
Return route: 0.22
```

Decision feed:

```text
13:00:02 Session initialized
13:00:03 Evaluating route options
13:00:04 Summit route suitability: 82%
13:00:04 Recommended -> Summit route
```

The summit route is highlighted green.

---

## State Change

Live conditions change:

```text
Time:
3:40 PM

Wind:
24 mph

Pace:
1.6 mph

Fatigue:
Moderate
```

Decision feed:

```text
15:40:01 State updated
15:40:01 Pace dropped below expected
15:40:02 Remaining daylight reduced
15:40:02 Ridge wind increased
15:40:03 Evaluating route options
15:40:04 Summit route: 34%
15:40:04 Alternate descent: 86%
15:40:05 Recommended -> Alternate descent
```

The highlighted route switches from the summit route to the alternate descent.

The optional LLM explanation may then appear:

```text
Your current pace puts the summit route beyond the expected daylight window,
while the alternate descent reduces remaining elevation and time.
```

---

# 34. Revised Core Prototype

The first version only needs to prove:

```text
3D mountain
+
real trail
+
multiple valid routes
+
live state
+
approved Jev questions with optional LLM selection
+
real-time Jev evaluation
+
deterministic route policy
+
live decision feed
+
HUD
+
visible route change
```

This is the complete technical thesis of the MVP.

---

# 35. Updated Engineering Principle

The full project should follow four layers:

```text
LLM
Determines what needs to be evaluated

Jev
Performs fast probabilistic judgments

Deterministic application code
Applies rules and chooses actions

GIS / 3D frontend
Shows the result spatially
```

In short:

> LLM asks the right questions. Jev evaluates them quickly. Code decides what to do. The map shows the result.
