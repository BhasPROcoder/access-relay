import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createState, segmentStatus, journeyStatus, applyAction, journeysAffectedBy, campusPriority, isOverdue } from '../src/domain.js';
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
test('repairing one barrier does not verify a journey with an unknown checkpoint', () => {
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  const repaired = applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'reviewer', passed: true }, now);
  assert.equal(segmentStatus(repaired.segments['library-ramp'], now), 'clear');
  assert.equal(segmentStatus(repaired.segments['library-desk'], now), 'unknown');
  assert.equal(journeyStatus(data.journeys[0], repaired, now), 'unknown');
});
test('a completed recheck can restore a journey when every other checkpoint is current', () => {
  const journey = { segments: ['library-ramp'] };
  const claimed = applyAction(createState(data, now), { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.equal(journeyStatus(journey, claimed, now), 'pending');
  const repaired = applyAction(claimed, { type: 'recheck', segmentId: 'library-ramp', actor: 'reviewer', passed: true }, now);
  assert.equal(journeyStatus(journey, repaired, now), 'clear');
});
test('stale and pending checkpoints prevent a journey from being current', () => {
  const state = createState(data, now);
  assert.equal(journeyStatus({ segments: ['admin-path'] }, state, now), 'stale');
  const claimed = applyAction(state, { type: 'claim', segmentId: 'library-ramp', actor: 'staff' }, now);
  assert.equal(journeyStatus({ segments: ['library-ramp'] }, claimed, now), 'pending');
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
  for (const action of [{ type: 'report', segmentId: 'missing', actor: 'reporter' }, { type: 'report', segmentId: 'gate', actor: 'admin' }, { type: 'report', segmentId: 'gate', actor: 'staff' }, { type: 'delete', segmentId: 'gate', actor: 'staff' }, { type: 'claim', segmentId: 'gate', actor: 'staff' }]) assert.throws(() => applyAction(state, action, now));
});
