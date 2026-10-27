from pathlib import Path

content = r'''# AccessRelay — Verified Step-Free Service Journeys

## 1. The Core Insight — Why AccessRelay Matters

The fundamental idea behind AccessRelay is that **accessibility is not a property of a building. It is a property of a complete journey through that building.**

A campus library can truthfully say, “We have a wheelchair-accessible entrance,” while still being practically unusable because:

- the ramp is blocked,
- the lift is temporarily out of service,
- the corridor near the lift has furniture in it,
- the accessible door is locked,
- the service counter is unreachable,
- or the only step-free route ends before the actual service point.

That distinction is the conceptual heart of AccessRelay.

### Accessibility behaves like a chain

Imagine the journey:

> Campus Gate → Ramp → Entrance Door → Lobby → Lift → First-Floor Corridor → Library Desk

For a wheelchair user, this is not seven independent accessibility ratings.

It is one **service chain**.

Mathematically, if each segment has a binary step-free condition:

\[
J = S_1 \land S_2 \land S_3 \land \dots \land S_n
\]

Then the journey is usable only when **every required segment is usable**.

If six segments work and one fails:

\[
1 \land 1 \land 1 \land 0 \land 1 \land 1 \land 1 = 0
\]

The whole journey fails.

This is why a conventional rating such as:

> Library: ♿ Accessible

can create dangerous confidence.

The building may be “accessible” in a general sense while **today's actual journey is not**.

### The more important insight: accessibility is also time-dependent

Physical accessibility changes.

A ramp that was verified last semester may now have:

- construction material stored on it,
- a broken handrail,
- temporary barricades,
- parked vehicles,
- water accumulation,
- maintenance work.

A lift can go from functional to unusable within hours.

Therefore an accessibility observation should never mean:

> “This segment is accessible.”

It should mean:

> “This segment was observed to meet our defined criteria at a particular time.”

That is a radically safer statement.

AccessRelay therefore treats each observation as **perishable evidence**.

### Why `unknown` and `stale` are first-class states

A common design mistake is thinking there are only two useful states:

- Accessible
- Inaccessible

For safety-critical accessibility information, that is insufficient.

AccessRelay needs at least:

| State | Meaning |
|---|---|
| **Verified** | Recently observed and currently considered usable |
| **Blocked** | A confirmed barrier exists |
| **Stale** | Previously checked, but the evidence is too old to trust |
| **Unknown** | No sufficient observation exists |

The crucial philosophy is:

> **Absence of evidence must never be converted into evidence of accessibility.**

If a lift was accessible 60 days ago but your verification policy expires after 14 days, the correct answer is not:

> “Accessible.”

It is:

> “Last checked 60 days ago — current condition unknown.”

That difference prevents **unsafe confidence**.

### A useful analogy: aviation status, not restaurant ratings

A restaurant rating can tolerate stale information.

If someone rated a restaurant five stars six months ago, the consequences of outdated information are limited.

Accessibility information behaves more like:

- elevator operational status,
- railway platform changes,
- road closures,
- or equipment inspection records.

It is operational data.

That is why AccessRelay is better understood as:

> **an accessibility operations system**

rather than merely:

> **an accessibility map.**

The product question changes from:

> “Is this building accessible?”

to:

> **“Can a wheelchair user complete this specific service journey, through these specific segments, based on sufficiently recent evidence?”**

That is the defensible systems insight behind the entire project.

---

## 2. Data & Graph Architecture Deep-Dive

For a 48-hour MVP, the architecture should remain deliberately small.

You do **not** need GIS infrastructure, machine learning, routing APIs, or a complex backend.

A graph containing approximately **12–20 meaningful segments** is enough to prove the concept.

### 2.1 Model the campus as a directed graph

Conceptually:

\[
G=(V,E)
\]

Where:

- `V` = physical locations or transition points
- `E` = traversable route segments

Example nodes:

```text
MAIN_GATE
QUAD
LIBRARY_RAMP
LIBRARY_ENTRANCE
LIBRARY_LOBBY
LIBRARY_LIFT
LIBRARY_DESK

ADMIN_RAMP
ADMIN_ENTRANCE
ADMIN_CORRIDOR
ADMIN_DESK

STUDENT_SERVICE_ENTRANCE
STUDENT_SERVICE_CORRIDOR
STUDENT_SERVICE_DESK
```

A route segment becomes an edge:

```text
LIBRARY_RAMP → LIBRARY_ENTRANCE
```

The graph should be **directed** because physical accessibility is not always symmetrical.

For example:

```text
Parking → Ramp
```

may be usable while:

```text
Ramp → Parking
```

is problematic because of:

- slope,
- door mechanics,
- one-way gates,
- crowd control,
- security arrangements.

Directed edges let you model reality instead of assuming both directions are equivalent.

### 2.2 Example JSON model

A compact MVP structure could look like this:

```json
{
  "nodes": [
    {
      "id": "campus_gate",
      "label": "Main Campus Gate"
    },
    {
      "id": "library_ramp",
      "label": "Library Ramp"
    },
    {
      "id": "library_entrance",
      "label": "Library Accessible Entrance"
    },
    {
      "id": "library_desk",
      "label": "Library Service Desk"
    }
  ],

  "segments": [
    {
      "id": "seg_gate_ramp",
      "from": "campus_gate",
      "to": "library_ramp",
      "label": "Gate to Library Ramp",
      "status": "verified",
      "observedAt": "2026-10-25T09:30:00Z",
      "expiresAfterHours": 336,
      "verifiedBy": "observer_01"
    },

    {
      "id": "seg_ramp_entrance",
      "from": "library_ramp",
      "to": "library_entrance",
      "label": "Library Ramp",
      "status": "verified",
      "observedAt": "2026-10-25T09:35:00Z",
      "expiresAfterHours": 336,
      "verifiedBy": "observer_01"
    }
  ],

  "services": [
    {
      "id": "library_service",
      "name": "Library Service Desk",
      "destinationNode": "library_desk"
    }
  ]
}
```

Do not overengineer the schema.

For the demo, each segment needs only enough information to answer:

1. Where does it start?
2. Where does it end?
3. What is its current state?
4. When was it last observed?
5. Who observed it?
6. When should that evidence expire?

### 2.3 Observation age should be calculated, not manually entered

Suppose:

```text
observedAt = 10 October
expiry period = 14 days
today = 27 October
```

Then:

\[
Age = CurrentTime - ObservedAt
\]

If:

\[
Age > ExpiryThreshold
\]

the effective state becomes:

```text
STALE
```

even if the stored observation originally said:

```text
VERIFIED
```

That distinction is useful.

You can retain:

```typescript
reportedStatus: "verified"
```

while calculating:

```typescript
effectiveStatus: "stale"
```

at runtime.

Example:

```typescript
function getEffectiveStatus(segment: Segment): SegmentStatus {
  if (segment.status === "blocked") {
    return "blocked";
  }

  if (!segment.observedAt) {
    return "unknown";
  }

  const observed = new Date(segment.observedAt).getTime();
  const now = Date.now();

  const ageHours =
    (now - observed) / (1000 * 60 * 60);

  if (ageHours > segment.expiresAfterHours) {
    return "stale";
  }

  return segment.status;
}
```

This is a very strong architectural choice because **time automatically degrades confidence**.

Nobody has to remember to manually mark records stale.

### 2.4 Graph traversal determines whether a service is reachable

Suppose the library has two possible routes.

```text
                    ┌── Lift A ─────┐
Gate → Entrance ────┤               ├── Library Desk
                    └── Ramp B ─────┘
```

If Lift A is blocked but Ramp B remains verified, the library may still be reachable.

This is why AccessRelay should evaluate the **graph**, rather than store something simplistic like:

```json
{
  "library": "accessible"
}
```

A simple BFS or DFS is enough for the MVP.

Conceptually:

```typescript
function findVerifiedPath(
  graph,
  startNode,
  destinationNode
) {
  // Traverse only edges whose
  // effective state is VERIFIED.
}
```

The algorithm asks:

> Is there **at least one complete path** from the starting node to the service destination where every required edge is currently verified?

Formally:

\[
\exists P(s,d)
\]

such that:

\[
\forall e \in P,\ status(e)=VERIFIED
\]

If yes:

```text
VERIFIED STEP-FREE JOURNEY
```

If every route contains a confirmed blocked segment:

```text
BLOCKED
```

If the only possible paths contain stale or unknown evidence:

```text
NOT CURRENTLY VERIFIED
```

Notice the wording.

You should avoid saying:

> “Not accessible”

when the system simply lacks evidence.

Instead say:

> **“No currently verified step-free journey.”**

That is both technically and ethically more precise.

### 2.5 Suggested journey display

Instead of:

```text
Library
♿ Accessible
```

show:

```text
LIBRARY SERVICE DESK

Current status:
✓ Verified step-free journey

Last complete verification:
2 days ago

Route:
✓ Main Gate → Quad
  checked 2 days ago

✓ Quad → Library Ramp
  checked 2 days ago

✓ Library Ramp → Accessible Door
  checked 2 days ago

✓ Accessible Door → Lift
  checked 1 day ago

✓ Lift → Library Service Desk
  checked 1 day ago
```

Or:

```text
LIBRARY SERVICE DESK

⚠ No currently verified step-free journey

Reason:
Library lift record expired 18 days ago.

Last known status:
Operational

Action:
Recheck required.
```

Now the user understands **why** the system reached its conclusion.

That explainability is particularly important because your route certification is deterministic.

### 2.6 IndexedDB fits the prototype well

For the MVP:

```text
React UI
     ↓
TypeScript domain logic
     ↓
IndexedDB
     ↓
JSON graph + observations
```

Possible stores:

```text
segments
observations
incidents
users
services
rechecks
```

You could simplify further:

```text
graph
incidents
```

for the first implementation.

IndexedDB gives you:

- persistence,
- offline support,
- realistic PWA behaviour,
- no dependency on a working backend during judging.

The service worker can cache:

```text
app shell
graph data
latest observations
incident submissions
```

so losing internet does not destroy the demonstration.

---

## 3. The Accountability Loop & Risk Mitigation

AccessRelay becomes significantly more interesting when it stops being:

> **Observe → Display**

and becomes:

> **Observe → Detect → Assign → Repair → Independently Verify → Restore Trust**

That is the closed loop judges should remember.

### The complete lifecycle

```text
1. USER SELECTS SERVICE
              ↓
2. SYSTEM COMPUTES JOURNEY
              ↓
3. EVERY SEGMENT + AGE IS DISPLAYED
              ↓
4. BARRIER IS REPORTED
              ↓
5. SEGMENT BECOMES BLOCKED
              ↓
6. STAFF OWNER IS ASSIGNED
              ↓
7. STAFF REPORTS RESOLUTION
              ↓
8. ROUTE REMAINS UNVERIFIED
              ↓
9. INDEPENDENT PERSON RECHECKS
              ↓
10. VERIFIED OBSERVATION CREATED
              ↓
11. GRAPH RECALCULATES JOURNEY
```

Step 8 is particularly important.

### A repair claim is not the same as verification

Suppose facilities staff reports:

> “Ramp obstruction removed.”

AccessRelay should **not immediately restore the segment to verified**.

Instead:

```text
BLOCKED
↓
REPAIR REPORTED
↓
AWAITING INDEPENDENT RECHECK
↓
VERIFIED
```

The same person should ideally not be allowed to both:

1. claim the fix, and
2. certify the fix.

That gives you an accountability mechanism similar to:

- code review,
- quality assurance,
- safety inspection,
- dual-control verification.

### Risk 1 — Unsafe confidence

This is your highest-priority risk.

Mitigations:

- deterministic graph traversal,
- visible observation timestamps,
- stale-state expiry,
- unknown-state preservation,
- no AI route certification,
- segment-by-segment explanation,
- explicit language such as:

> “No currently verified journey”

rather than making unsupported accessibility claims.

One good principle for your team:

> **The system is allowed to become uncertain.**

In fact, uncertainty is preferable to a false green checkmark.

### Risk 2 — The accessibility application itself is inaccessible

An accessibility platform failing basic UI accessibility would undermine the project immediately.

Do not rely solely on a map.

Your primary interaction should work as an **accessible list**.

For example:

```text
Library Journey

1. Main gate to quad
   Verified — observed yesterday

2. Quad to ramp
   Verified — observed yesterday

3. Library ramp
   Blocked — obstruction reported today

4. Accessible entrance
   Verified — observed yesterday
```

Important implementation considerations:

- semantic HTML,
- keyboard navigation,
- visible focus states,
- sensible tab order,
- sufficient contrast,
- text labels in addition to colour,
- screen-reader-friendly status announcements,
- large click/tap areas.

A red map edge alone is inadequate.

Display:

```text
⛔ BLOCKED
```

as text.

### Printed accessibility summary

This is a surprisingly strong hackathon feature because it demonstrates that you understand the environment beyond your app.

Generate a simple printable page:

```text
ACCESSRELAY JOURNEY SUMMARY

Destination:
Library Service Desk

Current Status:
NO CURRENTLY VERIFIED STEP-FREE JOURNEY

Problem:
Library lift unavailable

Reported:
27 Oct 2026, 09:20

Assigned to:
Campus Facilities

Alternative verified route:
None currently known

Last full route verification:
25 Oct 2026
```

Why it matters:

- works for help desks,
- works during connectivity issues,
- can be handed to security staff,
- accommodates users uncomfortable with apps,
- creates an audit trail.

It also communicates that accessibility information is an **institutional responsibility**, not merely a consumer-app feature.

### Risk 3 — Nobody owns the problem

A complaint system without ownership often degenerates into:

```text
Complaint submitted.
Ticket #1948.
```

And nothing happens.

AccessRelay should require:

```text
Barrier → Named operational owner
```

For example:

| Barrier | Owner |
|---|---|
| Lift failure | Facilities |
| Ramp obstruction | Security / Facilities |
| Locked accessible entrance | Building administration |
| Furniture blocking corridor | Department staff |

The system should always be able to answer:

> **Who currently owns resolution of this barrier?**

A simple state machine works well:

```text
OPEN
 ↓
ASSIGNED
 ↓
FIX REPORTED
 ↓
AWAITING RECHECK
 ↓
VERIFIED CLOSED
```

Avoid a generic:

```text
RESOLVED
```

unless independent evidence exists.

---

## 4. Three High-Impact Creative Expansions

These additions are realistic within your guardrails and could materially improve the demo.

### Expansion 1 — QR Segment Checkpoints

Place simulated QR codes at key locations:

```text
LIBRARY RAMP
LIFT
ADMIN ENTRANCE
STUDENT SERVICE CORRIDOR
```

Scanning the code opens:

```text
Segment: Library Ramp

Last verified:
2 days ago

Current status:
Verified

Quick observation:
[ Still usable ]
[ Barrier found ]
[ Unable to verify ]
```

#### Why this is powerful

It converts verification from:

> someone updating a central database

into:

> evidence being generated at the physical point where the condition exists.

It also reduces data-entry errors because the QR code determines:

```text
segment_id
```

automatically.

#### Judge demo moment

Put a QR code physically on the presentation table.

Scan it.

Report:

```text
Ramp blocked.
```

The library journey immediately switches:

```text
VERIFIED
→
NO VERIFIED STEP-FREE JOURNEY
```

That creates a visible physical-to-digital interaction.

### Expansion 2 — Offline Verification Queue

Your service worker can turn offline-first behaviour into part of the story rather than merely an implementation detail.

Imagine a campus basement or concrete corridor with weak connectivity.

An observer scans a checkpoint and reports:

```text
Lift operational
```

while offline.

The PWA stores:

```text
Observation
Timestamp
Segment ID
Observer ID
Sync state
```

inside IndexedDB.

Display:

```text
Saved on this device
Awaiting sync
```

When connectivity returns:

```text
✓ Synced
```

#### Why judges may care

Because field-data systems frequently fail exactly where infrastructure is weakest.

Your message becomes:

> **Accessibility verification should not stop because Wi-Fi does.**

That is far stronger than saying:

> “Our app is a PWA.”

The technology exists to solve a concrete operational problem.

### Expansion 3 — Staleness Operations Dashboard

Staleness can become a management signal.

Instead of waiting for users to discover expired routes, show staff:

```text
ACCESSIBILITY HEALTH

Verified journeys          2 / 3

Segments verified          14
Segments stale              3
Segments unknown            1
Segments blocked            2

Highest priority rechecks

1. Student Service Lift
   expired 2 days ago

2. Admin Entrance
   expires tomorrow

3. Library Corridor
   expires in 3 days
```

You can then add lightweight SLA logic.

For example:

```text
T-48h
Recheck due soon

T+0h
Record becomes stale

T+24h
Staff reminder

T+72h
Escalate to accessibility coordinator
```

No AI required.

Just deterministic rules.

### Why this expansion matters strategically

You are moving accessibility from:

> **complaint management**

toward:

> **preventive accessibility maintenance.**

That is an important distinction.

Most systems react when something fails.

AccessRelay can tell an institution:

> “Three critical accessibility observations will expire tomorrow. Verify them before users lose confidence in those journeys.”

That creates a credible path toward institutional adoption.

---

## 5. The Judge-Winning Pitch & Demo Script

Below is how I would structure the approximately two-minute demonstration.

### 0:00–0:20 — Establish the problem

> “Imagine a wheelchair user needs to submit a form at the administration office.
>
> The campus website says the building has an accessible entrance.
>
> But accessibility is not an entrance.
>
> It is a chain: the path, ramp, door, corridor, lift and actual service desk.
>
> If just one of those fails, the entire visit fails.”

Show:

```text
Gate
 ↓
Ramp
 ↓
Door
 ↓
Lift
 ↓
Administration Desk
```

Then break the lift.

```text
Gate ✓
Ramp ✓
Door ✓
Lift ✕
Desk ✓
```

Say:

> “Five accessible components do not create an accessible journey if the sixth is unusable.”

### 0:20–0:40 — Establish the category difference

> “Existing tools such as Wheelmap, Project Sidewalk and accessibility-reporting platforms help document places and barriers.
>
> AccessRelay attacks a different problem: **Can this specific service journey be completed right now based on sufficiently recent evidence?**
>
> We model accessibility as an expiring directed graph, not a permanent property of a location.”

Show three service destinations:

```text
Library
Administration
Student Services
```

with route states.

### 0:40–1:00 — Reveal the safety mechanism

Open the library journey.

Show:

```text
✓ Gate → Quad
  verified 1 day ago

✓ Quad → Ramp
  verified 1 day ago

⚠ Lift
  last checked 19 days ago
  verification expired

✓ Lift → Library desk
  verified 2 days ago
```

Then say:

> “The lift was working when it was checked. But that evidence is now too old.
>
> AccessRelay doesn't silently assume it is still accessible.
>
> It deliberately returns:
>
> **No currently verified step-free journey.**
>
> In accessibility systems, uncertainty is safer than false confidence.”

That sentence is worth emphasizing.

### 1:00–1:25 — Perform the live failure

Scan your QR code or click:

```text
Report barrier
```

Select:

```text
Lift unavailable
```

Immediately show:

```text
LIBRARY SERVICE JOURNEY

⛔ BLOCKED
```

Then switch to the staff view:

```text
Incident #A014

Segment:
Library Lift

Status:
OPEN

Owner:
Facilities Team
```

Assign it.

Then simulate:

```text
Repair completed
```

Do **not** turn the journey green.

Instead show:

```text
AWAITING INDEPENDENT RECHECK
```

Say:

> “A staff member saying ‘fixed’ does not restore trust.”

### 1:25–1:45 — Complete the accountability loop

Switch observer identity.

Perform:

```text
Independent recheck
```

Mark:

```text
Lift operational
```

Now:

```text
Library Journey

✓ VERIFIED STEP-FREE JOURNEY
```

Say:

> “Only after independent verification does the graph restore the route.”

That is your strongest demo moment.

### 1:45–2:00 — End with measurable impact

Finish on a dashboard containing three KPIs.

#### KPI 1 — Visit-task completion

\[
\frac{\text{successful service visits}}
{\text{attempted service visits}}
\]

This is the human outcome.

Not downloads.

Not number of pins.

Not reports filed.

Can the person actually complete the task?

#### KPI 2 — Stale-record share

\[
\frac{\text{stale segments}}
{\text{total monitored segments}}
\]

This measures information quality.

A growing stale-record share means institutional confidence is degrading.

#### KPI 3 — Independently verified fixes

\[
\frac{\text{barriers independently reverified}}
{\text{barriers reported as fixed}}
\]

This measures whether the closed loop is genuinely functioning.

Then close with:

> **“Most accessibility systems tell you what a place was like when somebody reviewed it. AccessRelay tells you whether a complete service journey is currently supported by enough evidence to trust — and gives the institution a workflow to restore that trust when it breaks.”**

---

## The architecture judges should leave remembering

Do not let the project be described as:

> “an accessibility mapping app.”

Your better framing is:

```text
Physical campus
      ↓
Directed accessibility graph
      ↓
Time-bounded observations
      ↓
Deterministic journey verification
      ↓
Barrier detection
      ↓
Named institutional owner
      ↓
Repair
      ↓
Independent verification
      ↓
Trust restored
```

And the single strongest design principle behind the project is:

> **AccessRelay does not try to prove that a building is accessible. It continuously maintains evidence about whether a specific person can complete a specific service journey through a sequence of currently verified segments.**

That distinction is what turns the project from a map with accessibility icons into a credible **accessibility reliability and accountability system**.
'''

path = Path("/mnt/data/AccessRelay_Architecture_and_Pitch.md")
path.write_text(content, encoding="utf-8")
print(path)
