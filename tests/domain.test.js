import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState, segmentStatus, journeyStatus, applyAction, journeysAffectedBy, campusPriority, isOverdue, parseSmsReport, isSelfRecheckAttempt, draftEscalationMessage, auditTrail } from '../src/domain.js';
const data = JSON.parse(await readFile(new URL('../data/journeys.json', import.meta.url)));
const now = Date.UTC(2026, 9, 27);
test('fixtures yield blocked, stale and current journeys', () => {
  const state = createState(data, now);
  assert.deepEqual(data.journeys.map(j => journeyStatus(j, state, now)), ['blocked', 'stale', 'clear']);
});
test('clear evidence expires at the boundary; missing segments remain unknown', () => {
  const state = createState(data, now);
  assert.equal(segmentStatus(state.segments.gate, state.segments.gate.expiresAt), 'stale');
  assert.equal(journeyStatus({ segments: ['missing'] }, state, now), 'unknown');
  assert.equal(journeyStatus({ segments: [] }, state, now), 'unknown');
});
test('aging does not erase a known barrier', () => {
  assert.equal(segmentStatus(createState(data, now).segments['library-ramp'], now + 999999999), 'blocked');
});
test('repair claim does not close a barrier and claimant cannot verify', () => {
  const original = createState(data, now);
  const claimed = applyAction(original, { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.equal(segmentStatus(claimed.segments['library-ramp'], now), 'pending');
  assert.equal(original.segments['library-ramp'].claim, null);
  assert.throws(() => applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'staff', passed: true }, now));
  assert.throws(() => applyAction(claimed, { type: 'observe', segmentId: 'library-ramp', actor: 'reviewer' }, now));
});
test('failed recheck reopens; successful recheck creates expiring observation', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  const failed = applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'reviewer', passed: false }, now);
  assert.equal(segmentStatus(failed.segments['library-ramp'], now), 'blocked');
  const passed = applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'reviewer', passed: true }, now);
  assert.equal(segmentStatus(passed.segments['library-ramp'], now), 'clear');
  assert.equal(segmentStatus(passed.segments['library-ramp'], now + 8 * 3600000), 'stale');
  assert.equal(journeyStatus(data.journeys[0], passed, now), 'unknown');
});
test('a segment shared by several journeys raises campus priority when it blocks', () => {
  const state = createState(data, now);
  assert.equal(journeysAffectedBy(data.journeys, 'gate').length, 3);
  assert.equal(campusPriority(data.journeys, state, now).id, 'library-ramp');
  const gateBlocked = applyAction(state, { type: 'report', segmentId: 'gate', actor: 'reporter' }, now);
  const priority = campusPriority(data.journeys, gateBlocked, now);
  assert.equal(priority.id, 'gate');
  assert.equal(priority.journeys.length, 3);
});
test('a repair claim becomes overdue only after the grace window', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  const segment = claimed.segments['library-ramp'];
  assert.equal(isOverdue(segment, now), false);
  assert.equal(isOverdue(segment, now + 3 * 3600000), false);
  assert.equal(isOverdue(segment, now + 5 * 3600000), true);
});
test('invalid actors, segments and actions are rejected', () => {
  const state = createState(data, now);
  for (const action of [{ type: 'report', segmentId: 'missing', actor: 'reporter' }, { type: 'report', segmentId: 'gate', actor: 'admin' }, { type: 'delete', segmentId: 'gate', actor: 'staff' }, { type: 'claim', segmentId: 'gate', actor: 'staff' }]) assert.throws(() => applyAction(state, action, now));
});
test('an SMS-style report maps a plain-text command to a real action', () => {
  assert.deepEqual(parseSmsReport('BLOCKED LIBRARY RAMP', data.segments), { type: 'report', segmentId: 'library-ramp', actor: 'reporter' });
  assert.deepEqual(parseSmsReport('clear library ramp', data.segments), { type: 'observe', segmentId: 'library-ramp', actor: 'reporter' });
  assert.throws(() => parseSmsReport('FOO LIBRARY RAMP', data.segments), /don't understand/i);
  assert.throws(() => parseSmsReport('BLOCKED NOWHERE', data.segments), /couldn't find/i);
  assert.throws(() => parseSmsReport('   ', data.segments), /don't understand/i);
});
test('a recheck attempt by the same actor who claimed the repair is flagged as a self-recheck', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.equal(isSelfRecheckAttempt(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'staff' }), true);
  assert.equal(isSelfRecheckAttempt(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'reviewer' }), false);
  assert.equal(isSelfRecheckAttempt(createState(data, now), { type: 'recheck', segmentId: 'library-ramp', actor: 'staff' }), false);
  assert.equal(isSelfRecheckAttempt(claimed, { type: 'report', segmentId: 'library-ramp', actor: 'staff' }), false);
});
test('a recheck rejection names the actual reason: wrong actor type versus same actor as claimant', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.throws(() => applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'reporter', passed: true }, now), /independent reviewer/i);
  assert.throws(() => applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'staff', passed: true }, now), /independent reviewer/i);
  assert.throws(() => applyAction(createState(data, now), { type: 'recheck', segmentId: 'library-ramp', actor: 'reviewer', passed: true }, now), /no repair claim/i);
});
test('isOverdue tolerates a missing segment instead of crashing', () => {
  assert.equal(isOverdue(null, now), false);
  assert.equal(isOverdue(undefined, now), false);
});
test('a non-finite preview time fails loudly instead of silently producing a wrong status', () => {
  const state = createState(data, now);
  assert.throws(() => segmentStatus(state.segments['admin-lift'], NaN), /invalid observation time/i);
  assert.throws(() => segmentStatus(state.segments['admin-lift'], Infinity), /invalid observation time/i);
  assert.equal(segmentStatus(state.segments['library-ramp'], NaN), 'blocked');
  const claimed = applyAction(state, { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.equal(segmentStatus(claimed.segments['library-ramp'], NaN), 'pending');
  assert.throws(() => isOverdue(claimed.segments['library-ramp'], NaN), /invalid observation time/i);
});
test('an overdue claim drafts a real escalation message naming who to chase and why', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.equal(draftEscalationMessage(claimed.segments['library-ramp'], data.journeys, now), null);
  const message = draftEscalationMessage(claimed.segments['library-ramp'], data.journeys, now + 5 * 3600000);
  assert.match(message, /Library ramp/);
  assert.match(message, /staff/);
  assert.match(message, /5h/);
  assert.match(message, /Visit the library/);
});
test('reporting a barrier again while its repair is pending recheck does not discard the claim', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.throws(() => applyAction(claimed, { type: 'report', segmentId: 'library-ramp', actor: 'reporter' }, now + 1000), /pending recheck/i);
  assert.equal(segmentStatus(claimed.segments['library-ramp'], now), 'pending');
});
test('claiming a repair gives a distinct message for "not reported" versus "already claimed"', () => {
  const state = createState(data, now);
  assert.throws(() => applyAction(state, { type: 'claim', segmentId: 'gate', actor: 'staff' }, now), /report a barrier before claiming/i);
  const claimed = applyAction(state, { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.throws(() => applyAction(claimed, { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now), /already claimed/i);
});
test('an SMS report prefers an exact segment name match over an earlier substring match', () => {
  const segments = [
    { id: 'a', name: 'Student support desk annex' },
    { id: 'b', name: 'Student support desk' }
  ];
  assert.deepEqual(parseSmsReport('CLEAR Student support desk', segments), { type: 'observe', segmentId: 'b', actor: 'reporter' });
});
test('the audit trail groups each segment\'s events chronologically and proves the relay rule held', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  const rechecked = applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'reviewer', passed: true }, now + 3600000);
  const trail = auditTrail(rechecked);
  const ramp = trail.find(entry => entry.id === 'library-ramp');
  assert.deepEqual(ramp.events.map(e => `${e.type}:${e.actor}`), ['claim:staff', 'recheck:reviewer']);
  assert.equal(trail.some(entry => entry.id === 'support-desk'), false);
  assert.equal(trail.every(entry => entry.events.every((event, i) => i === 0 || event.at >= entry.events[i - 1].at)), true);
});
