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
  if (!Number.isFinite(now)) throw new Error('Invalid observation time.');
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
      if (segment.claim) throw new Error('A repair claim is pending recheck. Resolve that before reporting again.');
      segment.status = 'blocked';
      break;
    case 'claim':
      if (action.actor !== 'staff') throw new Error('Only the staff demo actor can claim a repair.');
      if (segment.claim) throw new Error('This repair is already claimed and awaiting recheck.');
      if (segment.status !== 'blocked') throw new Error('Report a barrier before claiming its repair.');
      segment.claim = { actor: action.actor, at: now };
      break;
    case 'recheck':
      if (action.actor !== 'reviewer') throw new Error('Use the independent reviewer demo actor to recheck a repair.');
      if (!segment.claim) throw new Error('There is no repair claim to recheck.');
      if (action.actor === segment.claim.actor) throw new Error('A different reviewer must check the repair.');
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
// Fixing it once restores every journey that depends on it; this surfaces that shared risk.
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
  if (!segment?.claim) return false;
  if (!Number.isFinite(now)) throw new Error('Invalid observation time.');
  return now - segment.claim.at > OVERDUE_HOURS * 3600000;
}

const SMS_COMMANDS = { BLOCKED: 'report', CLEAR: 'observe' };
export function parseSmsReport(text, segments) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const command = SMS_COMMANDS[words[0]?.toUpperCase()];
  if (!command) throw new Error("Don't understand that. Try: BLOCKED <place> or CLEAR <place>.");
  const name = words.slice(1).join(' ').toLowerCase();
  const segment = name && (segments.find(s => s.name.toLowerCase() === name)
    ?? segments.find(s => s.name.toLowerCase().includes(name)));
  if (!name || !segment) throw new Error(`Couldn't find a place matching "${name}".`);
  return { type: command, segmentId: segment.id, actor: 'reporter' };
}

export function isSelfRecheckAttempt(state, action) {
  if (action.type !== 'recheck') return false;
  const segment = state.segments[action.segmentId];
  return Boolean(segment?.claim) && segment.claim.actor === action.actor;
}

// Every event here already passed the relay rule at the moment it was recorded
// (applyAction rejects a self-recheck before it reaches state.events), so this
// trail is proof the rule held, not just a display of what happened.
export function auditTrail(state) {
  const bySegment = {};
  for (const event of state.events) (bySegment[event.segmentId] ??= []).push(event);
  return Object.entries(state.segments)
    .filter(([id]) => bySegment[id]?.length)
    .map(([id, segment]) => ({ id, name: segment.name, events: bySegment[id].slice().sort((a, b) => a.at - b.at) }));
}

export function draftEscalationMessage(segment, journeys, now = Date.now()) {
  if (!isOverdue(segment, now)) return null;
  const hours = Math.floor((now - segment.claim.at) / 3600000);
  const affected = journeysAffectedBy(journeys, segment.id).map(j => j.name).join(', ');
  return `Subject: ${segment.name} needs a recheck\n\n${segment.name} was claimed fixed by ${segment.claim.actor} ${hours}h ago, and nobody has rechecked it since.\nThis affects: ${affected}.\nPlease get an independent reviewer to recheck it.`;
}
