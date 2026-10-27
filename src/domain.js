export const LABELS = Object.freeze({
  clear: 'Current observation', blocked: 'Barrier reported', unknown: 'Not checked',
  stale: 'Needs a fresh check', pending: 'Repair awaiting recheck'
});

export function createState(dataset, now = Date.now()) {
  return {
    version: 1,
    segments: Object.fromEntries(dataset.segments.map(s => [s.id, {
      ...s, observedAt: now - s.ageHours * 3600000,
      expiresAt: now + (s.validHours - s.ageHours) * 3600000, claim: null
    }])),
    events: []
  };
}

export function segmentStatus(segment, now = Date.now()) {
  if (!segment) return 'unknown';
  // A known obstruction never disappears merely because its observation ages.
  if (segment.claim) return 'pending';
  if (segment.status === 'blocked') return 'blocked';
  if (segment.status !== 'clear') return 'unknown';
  if (!Number.isFinite(segment.expiresAt) || now >= segment.expiresAt) return 'stale';
  return 'clear';
}

export function journeyStatus(journey, state, now = Date.now()) {
  if (!journey.segments.length) return 'unknown';
  const statuses = journey.segments.map(id => segmentStatus(state.segments[id], now));
  return ['blocked', 'pending', 'unknown', 'stale'].find(s => statuses.includes(s)) ?? 'clear';
}

export function applyAction(state, action, now = Date.now()) {
  if (!Number.isFinite(now)) throw new Error('Invalid observation time.');
  const current = state.segments[action.segmentId];
  if (!current) throw new Error('Unknown segment.');
  if (!['reporter', 'staff', 'reviewer'].includes(action.actor)) throw new Error('Unknown demo actor.');
  const next = structuredClone(state);
  const segment = next.segments[action.segmentId];
  switch (action.type) {
    case 'report':
      if (action.actor !== 'reporter') throw new Error('Only the visitor / reporter demo actor can report a barrier.');
      segment.status = 'blocked';
      segment.claim = null;
      break;
    case 'claim':
      if (action.actor !== 'staff') throw new Error('Only the staff demo actor can claim a repair.');
      if (segment.status !== 'blocked' || segment.claim) throw new Error('Report a barrier before claiming its repair.');
      segment.claim = { actor: action.actor, at: now };
      break;
    case 'recheck':
      if (!segment.claim) throw new Error('There is no repair claim to recheck.');
      if (action.actor === segment.claim.actor || action.actor !== 'reviewer') throw new Error('A different reviewer must check the repair.');
      if (typeof action.passed !== 'boolean') throw new Error('Recheck result must be explicit.');
      segment.status = action.passed ? 'clear' : 'blocked';
      segment.claim = null;
      break;
    case 'observe':
      if (action.actor !== 'reviewer') throw new Error('Use the reviewer demo actor for an observation.');
      if (segment.status === 'blocked' || segment.claim) throw new Error('A reported barrier needs the repair and recheck workflow.');
      segment.status = 'clear';
      break;
    default: throw new Error('Unknown action.');
  }
  if (action.type !== 'claim') {
    segment.observedAt = now;
    segment.expiresAt = now + segment.validHours * 3600000;
  }
  next.events.push({ segmentId: action.segmentId, type: action.type, actor: action.actor,
    passed: action.type === 'recheck' ? action.passed : null, at: now });
  return next;
}

// A segment can sit on more than one service journey (the campus gate is on all three).
// This reports dependency and impact; it does not claim that fixing one segment restores a journey.
export function journeysAffectedBy(journeys, segmentId) {
  return journeys.filter(j => j.segments.includes(segmentId));
}

export function campusPriority(journeys, state, now = Date.now()) {
  const blocked = Object.keys(state.segments).filter(id => segmentStatus(state.segments[id], now) === 'blocked');
  if (!blocked.length) return null;
  return blocked
    .map(id => ({ id, journeys: journeysAffectedBy(journeys, id) }))
    .sort((a, b) => b.journeys.length - a.journeys.length || a.id.localeCompare(b.id))[0];
}

export const OVERDUE_HOURS = 4;
export function isOverdue(segment, now = Date.now()) {
  return Boolean(segment.claim) && now - segment.claim.at > OVERDUE_HOURS * 3600000;
}

// Export accepted local events in chronological order, grouped by checkpoint.
// This is a convenient prototype history, not a tamper-proof production audit log.
export function auditTrail(state) {
  const bySegment = {};
  for (const event of state.events) (bySegment[event.segmentId] ??= []).push(event);
  return Object.entries(state.segments)
    .filter(([id]) => bySegment[id]?.length)
    .map(([id, segment]) => ({ id, name: segment.name, events: bySegment[id].slice().sort((a, b) => a.at - b.at) }));
}
