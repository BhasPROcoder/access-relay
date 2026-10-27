# AccessRelay: The Why, the How, and the Pitch

## 1. The Core Insight: Why AccessRelay Matters

**A journey is a chain, and chains break at their weakest link.**

Think of a relay race. Four runners can be world-class, but if the baton is dropped at one handoff, the team doesn't finish. A campus visit works the same way: gate → ramp → corridor → lift → counter. A wheelchair user only completes the *task* ("submit my form at the admin office") if every segment works. A perfect ramp at the entrance is irrelevant if the lift to the first floor is out of service or the counter is raised.

This is the hidden trap: **building-level accessibility labels ("wheelchair accessible ✓") answer the wrong question.** The user doesn't ask "is this building accessible?" They ask "can I get my thing done today, and get back out?"

**Why stale and unknown matter as much as verified.** Think of a restaurant hygiene sticker from 2022. Nobody would trust it today, yet static maps present a 2022 observation with the same confidence as one from this morning. For a wheelchair user, the failure mode is being stranded at a barrier, possibly far from help. So AccessRelay uses three honest states:

| State | Meaning | What the user sees |
|---|---|---|
| **Verified** | Observed recently, within the freshness window | "Checked 2 days ago" |
| **Stale** | Was fine, but the observation is too old to trust | "Last seen OK 41 days ago. Confirm before travelling" |
| **Unknown / Blocked** | Never observed, or a barrier is flagged | Journey cannot be marked step-free |

The design principle: **absence of evidence is never displayed as safety.** That single rule is what separates this from a ratings map, and it is your strongest defence against "why not just use Google Maps?"

---

## 2. Data & Graph Architecture Deep-Dive

### Model

Nodes are physical points (gate, ramp top, lift lobby, counter). **Directed edges are segments**, because direction matters (a slope can be fine downhill and unusable uphill; a lift may be one-way during maintenance). Each segment carries its own observation record.

```ts
type SegmentStatus = "ok" | "barrier";            // what the last observer saw
type Segment = {
  id: string;                  // "seg-lib-lift-01"
  from: string; to: string;    // node ids
  kind: "path" | "ramp" | "lift" | "door" | "counter";
  stepFree: boolean;           // structural fact: no steps at all
  lastObservedAt: number | null; // epoch ms; null = never observed
  observedStatus: SegmentStatus;
  freshnessDays: number;       // e.g. lift: 7, path: 30
  synthetic: boolean;          // label clearly in the UI
  owner?: string;              // staff owner when flagged
  ticket?: { openedAt: number; recheckBy?: string; recheckedAt?: number };
};
type Journey = { id: string; service: "library"|"admin"|"student-desk"; start: string; goal: string };
```

**Storage:** IndexedDB with two object stores, `segments` (keyPath `id`) and `observations` (append-only log: segment, time, observer, result, note). Keep the log append-only. You never overwrite history, which gives you a free audit trail and your KPIs.

### Computing status: derived, never stored

Don't store "stale". **Compute it at read time** from age, so it can't silently go out of date:

```ts
function effectiveState(s: Segment, now = Date.now()) {
  if (s.lastObservedAt === null) return "unknown";
  if (s.observedStatus === "barrier") return "blocked";
  const ageDays = (now - s.lastObservedAt) / 864e5;
  if (ageDays > s.freshnessDays) return "stale";
  return s.stepFree ? "verified" : "blocked"; // a step is a barrier regardless of freshness
}
```

Using different `freshnessDays` per kind is a nice touch: lifts fail often, so they expire in days; a paved corridor can last weeks.

### Traversal

Run BFS/DFS from the journey start to the goal **using only edges whose effective state is not blocked**, and track the *worst state* along the path:

- Path exists and all edges `verified` → **Verified step-free**
- Path exists but includes `stale` or `unknown` edges → **Unconfirmed** (lists exactly which segments need a recheck)
- No path avoiding `blocked` edges → **Not currently usable**

Treat it as a "weakest link wins" rule. Because it's pure functions over JSON, you can unit-test it in minutes, and that determinism is exactly your "no AI certification" argument. Also run the traversal in both directions: the user must be able to **get out** too.

### Offline

The service worker caches the app shell; IndexedDB holds the graph. The page still opens with no network, and it shows ages relative to the device clock, which is exactly when users need it most.

---

## 3. The Accountability Loop & Risk Mitigation

**The loop:** choose service → see every segment with its age → flag barrier → *assign a named staff owner* → owner fixes → **a different person rechecks** → status updates → observation logged.

| Risk | Mitigation |
|---|---|
| **Unsafe confidence** | Three-state model; stale/unknown are never green; the verdict names the weakest segment; deterministic rules only; no AI sign-off; synthetic data labeled as synthetic. |
| **Inaccessible UI** | A plain, semantic **list view** (not map-only) readable by screen readers; large touch targets; status shown by text + icon, never colour alone; keyboard-operable; high contrast; a **printable one-page summary** the user can carry or hand to a companion. |
| **No staff owner** | A flag cannot be saved without an owner field. A ticket with no owner is rejected by the form, not just discouraged. |

**Independent recheck protocol:** the person who reports the fix cannot be the person who verifies it (enforce `recheckedBy !== fixedBy`). A segment returns to "verified" only after the second observation, and that event counts toward your "independently verified fixes" KPI. Until then it shows "Fix reported, awaiting recheck", which is a state honest tools rarely have.

---

## 4. Three Creative Expansions (Within Guardrails)

1. **QR check-ins at segments.** Print a QR at each lift or ramp. Scanning opens a two-tap form: "Works / Blocked" + optional note. It makes observations cheap, which directly lowers your stale-record share. *Effort:* one route and a form. Keep the independent-recheck rule: a scan alone from the owner doesn't close a ticket.

2. **Freshness SLA with visible escalation.** Each segment has a recheck deadline; when it passes, the segment turns stale *and* appears in a "Needs recheck" queue for its owner; if untouched for N days, it escalates to a named supervisor row. No AI involved. It's a timer, a queue and a clearly labeled escalation. It gives you the "institutional accountability" story.

3. **Journey Passport (printable + offline).** One page per journey: verdict, weakest segment, each segment's age, and a QR linking back to the live status. Pair it with the offline PWA, so the person can show it to a guard or desk when the network is down. It reinforces the accessible-UI mitigation and makes a tangible demo prop.

*Possible stretch for multi-site expansion:* add a `siteId` to every record now, so a second campus is only a new JSON file.

---

## 5. Judge-Winning Pitch & Demo Script (~2 minutes)

**[0:00-0:20, the problem]**
"Wheelmap tells you a building has a ramp. Project Sidewalk maps sidewalk problems. RampMyCity lets you file a complaint. They are all about *places*. But nobody visits a place. They visit a *service*. And one broken lift between the gate and the counter means the whole visit fails. On our campus, nobody has measured how often that happens."

**[0:20-0:40, our idea]**
"AccessRelay treats accessibility as an expiring service journey. Every segment has an age. If it's old, it turns stale. If it's unknown, we say unknown. We never show confidence we haven't earned, and no AI certifies a route. It's deterministic graph traversal you can audit."

**[0:40-1:25, live demo]**
1. Pick **Library**. Verdict: *Verified step-free*, 6 segments, all fresh.
2. Fast-forward the clock (a demo-only control, clearly labeled): the lift segment turns **Stale**; the verdict drops to *Unconfirmed*, naming the lift.
3. Flag the lift as **Blocked**. Verdict: *Not usable*. Assign an owner, "Facilities, Mr. X."
4. Show the owner marking it fixed. Verdict stays *awaiting recheck*. Then a **different** user rechecks. The journey turns green again.
5. Turn on airplane mode and reload to show it still works. Print the Journey Passport.

**[1:25-1:45, impact]**
"We track three KPIs: **visit-task completion** (can the person finish the service), **stale-record share** (how much of our data we can't currently trust), and **independently verified fixes**. These are measurable on day one, and they make accessibility an accountable service rather than a sticker."

**[1:45-2:00, close]**
"Free to the people who need it, aligned with Sugamya Bharat and SDGs 10 and 11, and ready to add a second campus by adding one file. AccessRelay: not 'is it accessible?' but 'can I finish my visit today, and how do we know?'"

### Defending your choices (likely judge questions)

- *"Why not AI?"* A false "accessible" can strand someone. Deterministic rules are explainable and testable.
- *"Is your data real?"* Say plainly: X segments observed, Y synthetic, and the UI labels both.
- *"Who maintains it?"* The owner field, the SLA queue and the recheck rule *are* the answer.