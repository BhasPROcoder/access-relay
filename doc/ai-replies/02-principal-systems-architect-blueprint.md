# AccessRelay: Principal Systems Architect & Product Strategy Blueprint

## 1. The Core Insight ("Why AccessRelay Matters")

Accessibility is not a property of a building; it is a fragile, time-sensitive property of an **end-to-end service journey**. 

Existing platforms fail wheelchair users because they model accessibility as a **static pin on a map**. If a campus library has a concrete ramp at its front entrance, tools like Wheelmap mark the building "Green / Accessible." When a student rolls up that ramp, enters the lobby, and discovers the internal elevator to the 2nd-floor circulation desk is out of service for maintenance—or that a security guard has chained one leaf of a double door shut, reducing the clearance to 650 mm—the trip fails completely. 

### The "Series Circuit" & "Cold Chain" Analogies
To understand why AccessRelay models accessibility as a directed graph of expiring segments, consider two real-world systems:

1. **The Series Electrical Circuit (Spatial Continuity):** A wheelchair journey from the Campus Main Gate to the Student-Service Desk is not an average of its parts; it is an **AND-gate chain**. If 9 out of 10 route segments are 100% compliant with Harmonised Guidelines (Sugamya Bharat), and 1 segment has a single 15 cm un-ramped curb or a locked fire door, the accessibility of the entire journey is **0%**. You cannot average out a physical barrier.
2. **The Vaccine Cold Chain (Temporal Decay):** Static accessibility ratings assume that once a ramp is built, the route stays open forever. In reality, accessibility rots over time. Janitorial staff park cleaning carts in accessible corridors, seasonal monsoon barricades block curb cuts, and elevators blow fuses. Treating a 6-month-old accessibility check as "Verified" is as dangerous as trusting a temperature log from last week for a biological shipment.

### Why `STALE` and `UNKNOWN` States Save Users from "Unsafe Confidence"
In assistive technology, **a false positive is infinitely worse than a missing record**. When an app tells a wheelchair user a route is "Verified Step-Free" based on outdated or hallucinated data, it creates **Unsafe Confidence**. The user invests physical energy, battery life, and time traveling into a physical cul-de-sac where they may become stranded without a safe turning radius or assistance.

By elevating `STALE` (observation age has exceeded its safe time-to-live) and `UNKNOWN` (unobserved) to first-class citizens alongside `VERIFIED` and `BARRIER`, AccessRelay shifts the paradigm from *"Was this place accessible once?"* to *"Can I complete my task at the Administration Office right now, and how fresh is the proof?"*

---

## 2. Data & Graph Architecture Deep-Dive

To build a bulletproof 48-hour MVP across 12–20 segments covering the **Library**, **Administration Office**, and **Student-Service Desk**, we model the campus as a **Time-Decaying Directed Multigraph** $G = (V, E, \tau)$ stored locally in **IndexedDB**.

### Why a *Directed* Graph?
Physical barriers are frequently asymmetric:
* An automatic door opener push-button may work on the outside of the Administration Office corridor (`Node A -> Node B`), while the interior button is blocked by a newly placed notice board (`Node B -> Node A`).
* A steep temporary ramp might be manageable rolling down with assistance, but unsafe or impossible to ascend independently.
* Security gates often separate entry pathways from exit pathways.

### TypeScript Schema (IndexedDB Object Stores)
Drop this directly into your `src/types/graph.ts` file. Notice how every edge carries an intrinsic `volatilityTTLHours`—because a poured concrete ramp decays over weeks, whereas a mechanical elevator or movable security barrier can fail in hours.

```typescript
export type SegmentState = 'VERIFIED' | 'STALE' | 'BARRIER' | 'UNKNOWN';

export type SegmentCategory = 
  | 'PATHWAY_CORRIDOR' 
  | 'RAMP_CURBCUT' 
  | 'DOOR_THRESHOLD' 
  | 'ELEVATOR_LIFT' 
  | 'SERVICE_COUNTER';

export interface CampusNode {
  id: string;                 // e.g., "NODE_MAIN_GATE", "NODE_LIB_DESK"
  label: string;              // Human-readable landmark
  building: 'OUTDOOR' | 'LIBRARY' | 'ADMIN_BLOCK' | 'STUDENT_CENTER';
  floor: number;
}

export interface RouteSegmentEdge {
  id: string;                 // e.g., "SEG_04_LIB_ELEVATOR"
  fromNodeId: string;
  toNodeId: string;
  label: string;              // e.g., "Library Main Lobby to 2nd Floor via Lift A"
  category: SegmentCategory;
  minClearWidthCm: number;    // Sugamya Bharat standard >= 90cm for doors, >= 150cm corridors
  maxGradientRatio?: number;  // e.g., 12 for 1:12 ramp
  
  // Temporal & Verification Metadata
  rawStatus: 'PASS' | 'FAIL' | 'UNOBSERVED';
  lastObservedAt: string | null; // ISO-8601 timestamp
  lastObservedByRole: 'USER' | 'STAFF' | 'INDEPENDENT_VERIFIER' | null;
  volatilityTTLHours: number;    // e.g., 24h for Elevator, 168h (7d) for Concrete Ramp
  
  // Accountability & Ticket Reference
  assignedStaffOwnerId: string;  // e.g., "STAFF_FACILITIES_LIFT_LEAD"
  activeBarrierTicketId?: string;
}

export interface BarrierTicket {
  id: string;
  segmentId: string;
  reportedAt: string;
  reportedBy: string;
  issueType: 'LOCKED_DOOR' | 'LIFT_DOWN' | 'OBSTRUCTION' | 'SURFACE_DAMAGE';
  description: string;
  assignedStaffId: string;
  status: 'OPEN' | 'STAFF_MARKED_FIXED' | 'INDEPENDENTLY_VERIFIED';
  staffResolvedAt?: string;
  independentVerifierId?: string;
  verifiedAt?: string;
}