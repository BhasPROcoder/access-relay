# AccessRelay: A Time-Decaying, End-to-End Accessibility System

AccessRelay matters because wheelchair users do not need to know that a building “is accessible”; they need to know whether the specific path from campus entry to a desk, counter, or service point is usable **today**. One blocked ramp, locked lift, or moved barrier invalidates the entire journey, so AccessRelay models accessibility as a directed graph whose edges expire unless independently rechecked. Existing tools such as Wheelmap collect place-level accessibility ratings, Project Sidewalk labels street-level barriers at scale, and RampMyCity focuses on audits and physical accessibility improvements—but none of these alone provides an institutionally owned, expiring, segment-by-segment service-journey guarantee.

## 1. The Core Insight: Why AccessRelay Matters

### A journey is only as accessible as its weakest segment

Think of a wheelchair journey like a flight itinerary: a first-class seat does not help if the connecting flight is cancelled. Likewise, a user may reach a library’s main door through an accessible entrance, but the visit fails if the interior route contains a step, a narrow corridor, a broken lift, or an inaccessible service counter.

AccessRelay therefore treats each campus journey as a chain of **directed segments**:

\[
\text{Campus Gate} \rightarrow \text{Pathway} \rightarrow \text{Ramp} \rightarrow \text{Lobby} \rightarrow \text{Lift} \rightarrow \text{Library Desk}
\]

A route is usable only if **every required segment** is currently usable. Formally:

\[
\text{Journey usable} = \bigwedge_{s \in \text{route}} \text{segment}_s \text{ is usable}
\]

This is the central safety insight: accessibility is not an average score. A route with nine good segments and one blocked segment is not “90% accessible”; for the user, it is **unusable**.

### Static maps answer the wrong question

Wheelmap-style tools are valuable for broad discovery, but a static “wheelchair accessible” badge can create false confidence. Project Sidewalk demonstrates the value of granular, crowdsourced barrier data—users label issues such as missing curb ramps, obstacles, and surface problems—but its primary unit is a mapped accessibility issue rather than an institutionally accountable, time-bound service journey.

AccessRelay changes the question from:

> “Is this place accessible?”

to:

> “Can I complete this specific task, through this specific route, right now—and who is accountable if the answer changes?”

### Stale and unknown are safety states

A segment with no recent observation is not automatically accessible. It is **unknown**, and unknown must be treated as a risk state.

For example:

- A ramp was verified two months ago, but construction equipment now blocks it.
- A lift was usable last week, but is under maintenance today.
- A corridor was clear during a morning audit, but is obstructed by an event setup in the afternoon.

AccessRelay therefore uses three first-class states:

| State | Meaning | User-facing implication |
|---|---|---|
| `verified` | A recent, independent observation confirms the segment is usable | May be included in a step-free route |
| `stale` | Previously usable, but the observation is too old to trust | Route is degraded or unavailable until rechecked |
| `unknown` | No reliable observation exists | Never presented as safely usable |
| `blocked` | A recent observation reports a barrier | Excluded from step-free routing |

The system should never infer “probably fine” from old data. Deterministic rules—not AI certification—decide whether a segment may support a route.

## 2. Data & Graph Architecture Deep-Dive

### Model the campus as a directed graph

For the 48-hour MVP, represent the campus as roughly 12–20 directed segments across three journeys:

1. **Library visit**
2. **Administration office visit**
3. **Student-service desk visit**

Each segment is an edge between two nodes. Direction matters because a ramp may be usable upward but unsafe downward, or an exit route may differ from the entry route.

A compact JSON graph could look like this:

```json
{
  "nodes": [
    { "id": "gate", "label": "Main Campus Gate" },
    { "id": "plaza", "label": "Central Plaza" },
    { "id": "library-entrance", "label": "Library Step-Free Entrance" },
    { "id": "library-desk", "label": "Library Service Desk" }
  ],
  "edges": [
    {
      "id": "seg-001",
      "from": "gate",
      "to": "plaza",
      "journeys": ["library", "admin", "student-services"],
      "surface": "paved",
      "hasStep": false,
      "minWidthCm": 120,
      "slopePercent": 3,
      "status": "verified",
      "lastVerifiedAt": "2026-10-27T08:30:00Z",
      "verifiedBy": "staff-audit-01",
      "barrier": null
    },
    {
      "id": "seg-002",
      "from": "plaza",
      "to": "library-entrance",
      "journeys": ["library"],
      "surface": "paved",
      "hasStep": true,
      "minWidthCm": 85,
      "slopePercent": 12,
      "status": "blocked",
      "lastVerifiedAt": "2026-10-27T09:10:00Z",
      "verifiedBy": "student-report-07",
      "barrier": {
        "type": "portable-step",
        "description": "Temporary step installed near entrance",
        "reportedAt": "2026-10-27T09:10:00Z"
      }
    }
  ]
}
```

### Store the graph in IndexedDB

IndexedDB is the right MVP storage layer because it is browser-native, structured, and works offline. Use three object stores:

| Store | Purpose | Example key |
|---|---|---|
| `segments` | Directed accessibility edges | `seg-001` |
| `observations` | Immutable history of checks and reports | `obs-2026-10-27-001` |
| `tasks` | Barrier flags, owners, SLAs, and rechecks | `task-001` |

Keep `segments` as the current operational state and `observations` as the append-only evidence trail. This separation is important: the current status can change, but the audit history should not be silently overwritten.

### Deterministic traversal

The router should use a simple breadth-first or Dijkstra-style traversal, but with a strict accessibility filter:

```ts
type SegmentStatus = "verified" | "stale" | "unknown" | "blocked";

function isRoutable(segment: Segment): boolean {
  return segment.status === "verified";
}

function findStepFreeRoutes(
  graph: Graph,
  destination: string
): Route[] {
  // Traverse only edges where:
  // 1. hasStep === false
  // 2. minWidthCm >= configured threshold
  // 3. slopePercent <= configured threshold
  // 4. status === "verified"
}
```

Do not rank routes by “accessibility score.” Return either:

- **A verified step-free route**, or
- **No safe route**, with the exact failing segment and reason.

That binary, evidence-based outcome is safer and more honest than a confidence percentage.

### Automatic staleness

Every segment has a `lastVerifiedAt` timestamp. At app startup, before rendering a route, run a deterministic freshness rule:

```ts
const STALE_AFTER_HOURS = 48;

function computeStatus(segment: Segment): SegmentStatus {
  const ageHours =
    (Date.now() - new Date(segment.lastVerifiedAt).getTime()) / 3_600_000;

  if (segment.status === "blocked") return "blocked";
  if (!segment.lastVerifiedAt) return "unknown";
  if (ageHours > STALE_AFTER_HOURS) return "stale";
  return "verified";
}
```

For the demo, expose a “simulate time” control so judges can watch a verified segment become stale without waiting two days. This makes the time-decay model visible rather than abstract.

## 3. The Accountability Loop & Risk Mitigation

AccessRelay is not merely a reporting app. Its differentiator is a closed loop: **observe → flag → assign → repair → independently recheck → restore or keep blocked**.

### The workflow

1. **User selects a service journey**  
   Example: “I need to visit the library desk.”

2. **System inspects every segment**  
   It shows the full route as a readable list, not only a map pin: gate → plaza → ramp → lobby → lift → desk.

3. **User sees observation age**  
   Each segment displays: “Verified 3 hours ago,” “Stale—last checked 3 days ago,” or “No verified observation.”

4. **User or staff flags a barrier**  
   A barrier report records the segment, barrier type, description, timestamp, photo if available, and reporter role.

5. **System assigns a staff owner**  
   The report cannot remain anonymous and unowned. It is assigned to facilities, library operations, accessibility services, or another responsible team.

6. **Repair is recorded**  
   The owner marks the corrective action: ramp cleared, lift restored, obstacle removed, temporary route opened.

7. **Independent recheck is required**  
   The person who reported or repaired the issue cannot alone restore the segment to `verified`. A second person must confirm it.

8. **Route status updates deterministically**  
   Only after the independent recheck does the segment return to `verified`. Until then, it remains `blocked`, `stale`, or `unknown`.

### Risk 1: Unsafe confidence

**Mitigation:** Never certify a route from a single report, inferred data, or AI output. Use deterministic graph traversal, explicit freshness windows, and independent recheck requirements.

The interface should say:

> “No currently verified step-free route to the Library Service Desk. Segment ‘Plaza → Library Entrance’ is blocked: temporary step near entrance.”

It should not say:

> “Route is 80% accessible.”

### Risk 2: Inaccessible UI

**Mitigation:** Build the primary experience as an accessible list, not a map-only interface.

Include:

- Semantic headings and landmarks.
- Keyboard-operable controls.
- Visible focus states.
- Sufficient color contrast.
- Text labels alongside color and icons.
- `aria-live` announcements for route-status changes.
- A printed or downloadable plain-text summary for users who cannot reliably use a phone at the moment of need.

A map is useful context, but the list is the safety-critical interface. It lets a user understand exactly where the journey fails and what alternative exists.

### Risk 3: Lack of a staff owner

**Mitigation:** Every barrier creates an accountable task with an owner, due time, and recheck requirement.

The task record should include:

```json
{
  "taskId": "task-001",
  "segmentId": "seg-002",
  "journey": "library",
  "barrierType": "temporary-step",
  "reportedBy": "student-report-07",
  "owner": "facilities-desk",
  "status": "assigned",
  "dueAt": "2026-10-27T13:00:00Z",
  "repairAction": null,
  "independentRecheck": null,
  "routeRestored": false
}
```

This turns accessibility from a complaint into an operational commitment.

## 4. Three High-Impact Creative Expansions

### 1. QR-based segment check-ins

Place small QR codes at critical segments: campus gate, ramp base, lift lobby, library entrance, and service desks.

A staff member scans the QR code, sees the exact segment, and completes a 15-second check:

- Step-free?
- Clear width adequate?
- Lift operational?
- Barrier present?

The scan writes a timestamped observation to IndexedDB and queues it for sync. This makes verification physically anchored to the real location, reducing vague or mistaken reports.

For the hackathon, print three QR codes and simulate scans from different “staff” accounts.

### 2. Offline-first PWA sync with conflict-safe observations

Use the service worker to cache the app shell, graph, and latest route state. Staff can perform checks in a basement, lift lobby, or area with weak Wi-Fi.

When connectivity returns, the app syncs queued observations. Use an append-only observation model so offline reports are never lost:

```ts
{
  "observationId": "obs-009",
  "segmentId": "seg-004",
  "observedAt": "2026-10-27T10:20:00Z",
  "result": "blocked",
  "note": "Lift out of service",
  "synced": false
}
```

The demo moment is powerful: turn off the network, flag a lift failure, restore the network, and show the observation sync while the route immediately becomes unavailable.

### 3. Staleness SLA escalation

Give each segment a verification cadence based on risk:

| Segment type | Suggested recheck cadence |
|---|---|
| Main entrance ramp | Daily |
| Lift | Daily or before opening |
| Interior corridor | Weekly |
| Temporary event route | Before each event |

When a segment becomes stale, AccessRelay creates an escalation task. If it remains stale past its SLA, it escalates to a supervisor or accessibility focal point.

For the MVP, simulate this with a dashboard:

- “3 of 18 segments are stale.”
- “1 blocked segment has no assigned owner.”
- “2 repairs await independent recheck.”
- “Library journey currently unavailable.”

This reframes accessibility as measurable institutional operations, not a one-time audit.

## 5. The Judge-Winning Pitch & Demo Script

### Two-minute stage narrative

> “When a wheelchair user visits a college campus, the question is not whether the library has an accessible entrance. The question is whether they can actually get from the gate to the library desk today.
>
> Existing tools help discovery. Wheelmap offers crowdsourced place accessibility. Project Sidewalk has shown how crowdsourcing can surface street-level barriers at scale. RampMyCity works on audits and physical accessibility improvements. But a static rating cannot tell you that a ramp was clear this morning and blocked by event equipment this afternoon.
>
> AccessRelay models a campus as a directed graph of route segments. Every segment has a status: verified, stale, unknown, or blocked. A journey is step-free only if every required segment is currently verified. One blocked segment makes the entire journey unavailable—not 90% accessible, not probably fine—unavailable.
>
> In our demo, a student selects the Library journey. The app shows every segment and its observation age. We simulate a barrier: a temporary step appears at the library entrance. AccessRelay immediately marks that segment blocked, removes the library route, and creates a task assigned to Facilities.
>
> Facilities records the repair. But the route does not magically become verified. A second, independent staff member must recheck the segment. Only then does AccessRelay restore the route.
>
> We track three KPIs: visit-task completion, the share of stale records, and independently verified fixes. Our goal is not to gamify disability or ask beneficiaries to pay for access information. Our goal is to make accessibility a live, accountable service.
>
> AccessRelay does not claim to know everything. It tells the truth about what is verified, what is stale, what is unknown, and who is responsible for fixing it.”

### Live demo sequence

1. **Open the Library journey.**  
   Show the full segment list and observation ages.

2. **Show a verified route.**  
   “Campus Gate → Plaza → Ramp → Library Entrance → Library Desk: verified step-free.”

3. **Simulate a barrier.**  
   Mark “Plaza → Library Entrance” as blocked due to a temporary step.

4. **Show the safety response.**  
   The Library journey becomes unavailable. The UI says exactly which segment failed and why.

5. **Create the accountability task.**  
   Assign it to Facilities with a due time.

6. **Record the repair.**  
   Facilities marks “temporary step removed.”

7. **Require independent recheck.**  
   A second staff account verifies the segment.

8. **Restore the route.**  
   The Library journey becomes available again, with a fresh verification timestamp.

9. **Show the KPI dashboard.**  
   Highlight visit-task completion, stale-record share, and independently verified fixes.

### Judge-ready one-liner

> **AccessRelay turns accessibility from a static place rating into an expiring, independently verified, institutionally accountable service journey.**
