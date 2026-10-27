# AccessRelay: Architecture & Product Strategy Brief

---

## 1. The Core Insight ("Why AccessRelay Matters")

### A step-free entrance is not a step-free visit

Picture a wheelchair user planning a trip to the college administration office. The building's front door has a ramp. Wheelmap says "accessible." Google Maps shows a pin. The user arrives — and the ramp is fine. But the corridor past the ramp has a 4 cm lip where a temporary partition was installed last week. Or the lift to the second-floor counter is out of service. Or the service counter itself is 110 cm high with no lowered section.

The entrance was accessible. The *visit* was not.

This is the hidden trap: **accessibility is a property of a journey, not a point.** A journey is a chain of segments — gate → path → ramp → door → corridor → lift → counter → staff interaction. A single broken segment breaks the entire chain. The user doesn't experience "90% accessible." They experience "I could not complete my task."

Analogy: think of it like a bridge made of 15 planks. Fourteen are solid. One is rotten. You don't have a 93%-safe bridge. You have a bridge you cannot cross.

### Why static maps fail — and why "stale" and "unknown" matter as much as "verified"

Static maps (Wheelmap, RampMyCity) record a *rating at a moment in time* and then let it fossilize. A green pin from 2019 tells you nothing about whether the lift works today. Worse, it projects **unsafe confidence**: the user trusts the green pin, commits to the trip, and discovers the failure only after arrival — which for a wheelchair user can mean a stranded trip, a missed appointment, or a dangerous improvised detour.

Project Sidewalk is better — it crowdsources *where* problems are — but it's still a complaint/annotation layer, not a journey-verification layer. It tells you a sidewalk has a problem; it doesn't tell you whether *your specific route to the library counter* is passable *right now*.

AccessRelay's core move is to treat every segment as having an **observation age** and one of three states:

| State | Meaning | What the user should do |
|---|---|---|
| **Verified** | Observed passable within its freshness window | Proceed with confidence |
| **Stale** | Last observation older than the freshness window | Proceed with caution; expect to verify on arrival |
| **Unknown** | Never observed, or explicitly flagged failed | Do not assume passable; seek alternative or assistance |

The critical insight: **"unknown" is not "bad" — but it must never be silently rendered as "good."** The life-safety failure mode of every accessibility map is false confidence. A stale green pin is more dangerous than a grey "unverified" pin, because it stops the user from planning a fallback. AccessRelay's entire data model is built to make confidence *earned, dated, and revocable*.

That's why the graph is **directed** (a ramp may be passable uphill but unsafe downhill; a one-way corridor may have a barrier on the return leg) and **time-decaying** (every segment's status is a function of its last observation timestamp and a per-segment TTL). The product isn't a map. It's a **freshness-aware routing engine for service journeys**, backed by an accountability loop that keeps observations fresh.

---

## 2. Data & Graph Architecture Deep-Dive

### The graph model

The MVP scopes three service journeys (library, administration office, student-service desk) across 12–20 observed route segments. Model this as a **directed graph** in a single JSON document, persisted in IndexedDB.

```json
{
  "meta": { "siteId": "campus-main", "schemaVersion": 1, "generatedAt": "2026-10-27T10:00:00Z" },
  "segments": [
    {
      "id": "seg-gate-to-path-a",
      "from": "node-main-gate",
      "to": "node-path-junction",
      "kind": "outdoor_path",
      "lengthM": 40,
      "barrierClass": "surface",
      "ttlHours": 168,
      "lastObservedAt": "2026-10-20T09:00:00Z",
      "observedState": "passable",
      "observedBy": "staff:ramesh",
      "evidenceRef": "photo:seg-gate-to-path-a-20261020",
      "notes": "Paved, 1.2m clear width"
    },
    {
      "id": "seg-lift-admin-2f",
      "from": "node-admin-ground",
      "to": "node-admin-2f",
      "kind": "vertical_lift",
      "ttlHours": 24,
      "lastObservedAt": "2026-10-25T14:00:00Z",
      "observedState": "passable",
      "observedBy": "staff:priya",
      "notes": "Lift operational; call button at 90cm"
    }
  ],
  "journeys": [
    {
      "id": "journey-admin-office",
      "label": "Administration Office (fee counter, 2F)",
      "serviceNode": "node-admin-counter-2f",
      "candidatePaths": [
        ["seg-gate-to-path-a", "seg-path-to-admin-ramp", "seg-admin-ramp", "seg-admin-door", "seg-lift-admin-2f", "seg-admin-counter"]
      ]
    }
  ],
  "staff": [
    { "id": "staff:ramesh", "role": "facilities", "ownsBarrierClasses": ["surface", "door"] },
    { "id": "staff:priya", "role": "admin", "ownsBarrierClasses": ["vertical_lift", "counter"] }
  ]
}