import { createState, segmentStatus, journeyStatus, applyAction, LABELS, journeysAffectedBy, campusPriority, isOverdue, auditTrail } from './domain.js';

const $ = selector => document.querySelector(selector);
const key = 'accessrelay-demo-events-v1';
let dataset, state, selected;
let storageAvailable = true;
let previewHours = 0;
const date = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const simNow = () => Date.now() + previewHours * 3600000;
const VERDICTS = Object.freeze({
  clear: 'Currently verified service journey',
  blocked: 'No currently verified service journey',
  pending: 'No currently verified service journey',
  unknown: 'No currently verified service journey',
  stale: 'No currently verified service journey'
});
const ACTORS = Object.freeze({ reporter: 'Visitor / reporter', staff: 'Facilities staff', reviewer: 'Independent reviewer' });
function resetPreview() {
  previewHours = 0;
  const scrub = $('#timeScrub');
  if (scrub) scrub.value = '0';
}

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function save() {
  try { localStorage.setItem(key, JSON.stringify({ startedAt: state.startedAt, actions: state.actions })); }
  catch { storageAvailable = false; }
}
function button(label, action) {
  const node = element('button', label);
  node.addEventListener('click', () => {
    try {
      const at = Date.now();
      const event = { ...action, actor: $('#actor').value };
      state = { ...applyAction(state, event, at), startedAt: state.startedAt, actions: [...state.actions, { action: event, at }] };
      resetPreview();
      save(); render();
      $('#feedback').textContent = storageAvailable ? 'Demo updated. See the new status and activity below.' : "Demo updated in memory only. Your browser won't save it this time.";
      $('#journey').focus();
    } catch (error) { $('#feedback').textContent = error.message; }
  });
  return node;
}
function nextAction(status) {
  if (status === 'blocked') return 'Facilities staff claims the repair; an independent reviewer then rechecks it.';
  if (status === 'pending') return 'An independent reviewer checks whether the claimed repair resolved the barrier.';
  if (status === 'unknown') return 'An independent reviewer records the first observation.';
  if (status === 'stale') return 'An independent reviewer records a fresh observation.';
  return 'No action is required before the current evidence expires.';
}
function eventDescription(event) {
  const labels = { report: 'Barrier reported', claim: 'Repair claimed', observe: 'Clear observation recorded' };
  const action = event.type === 'recheck'
    ? `Independent recheck ${event.passed ? 'passed' : 'failed'}`
    : labels[event.type] ?? event.type;
  return `${action} — ${state.segments[event.segmentId].name} — ${ACTORS[event.actor]} — ${date(event.at)}`;
}
function render() {
  const now = simNow();
  const journey = dataset.journeys.find(j => j.id === selected);
  $('#timeReadout').textContent = previewHours === 0 ? 'Now' : `${date(now)} (+${previewHours}h)`;
  const priority = campusPriority(dataset.journeys, state, now);
  const priorityBox = $('#priority');
  if (priority) {
    const segment = state.segments[priority.id];
    const names = priority.journeys.map(j => j.name).join(', ');
    priorityBox.hidden = false;
    priorityBox.replaceChildren(
      element('p', 'CAMPUS PRIORITY', 'eyebrow'),
      element('p', `Current barrier: ${segment.name}`),
      element('p', `This barrier affects ${priority.journeys.length} service journey${priority.journeys.length > 1 ? 's' : ''}.`),
      element('p', `Affects: ${names}`, 'small')
    );
  } else {
    priorityBox.hidden = true;
    priorityBox.replaceChildren();
  }
  $('#journeys').replaceChildren(...dataset.journeys.map(j => {
    const node = element('button', undefined, 'journey-option');
    node.append(element('strong', j.name), element('span', LABELS[journeyStatus(j, state, now)], 'small'));
    node.setAttribute('aria-pressed', String(selected === j.id));
    node.addEventListener('click', () => { selected = j.id; $('#feedback').textContent = ''; render(); });
    return node;
  }));
  const status = journeyStatus(journey, state, now);
  const issues = journey.segments.map(id => ({ segment: state.segments[id], status: segmentStatus(state.segments[id], now) })).filter(item => item.status !== 'clear');
  const reasons = element('ul');
  if (issues.length) reasons.append(...issues.map(item => element('li', `${item.segment.name} — ${LABELS[item.status]}`)));
  else reasons.append(element('li', 'Every checkpoint has a current observation.'));
  const actions = element('ul');
  const uniqueActions = [...new Set((issues.length ? issues : [{ status: 'clear' }]).map(item => nextAction(item.status)))];
  actions.append(...uniqueActions.map(action => element('li', action)));
  const verdict = element('div', undefined, `verdict-card verdict-${status}`);
  verdict.append(element('p', 'JOURNEY STATUS', 'summary-label'), element('h3', VERDICTS[status]), element('span', status === 'clear' ? 'All checkpoints current' : LABELS[status], `badge ${status}`));
  const why = element('div', undefined, 'summary-panel');
  why.append(element('h3', 'Why'), reasons);
  const next = element('div', undefined, 'summary-panel');
  next.append(element('h3', 'Next action'), actions);
  const detail = element('div', undefined, 'summary-details');
  detail.append(why, next);
  $('#summary').replaceChildren(element('p', 'YOUR SERVICE JOURNEY', 'eyebrow'), element('h2', journey.name), element('p', journey.purpose, 'journey-purpose'), verdict, detail, element('p', `Responsible owner: ${journey.owner}`, 'owner-line'));
  const actor = $('#actor').value;
  $('#segments').replaceChildren(...journey.segments.map((id, index) => {
    const segment = state.segments[id], status = segmentStatus(segment, now);
    const item = element('li', undefined, 'segment');
    item.style.setProperty('--i', index);
    const heading = element('div', undefined, 'segment-heading');
    heading.append(element('span', String(index + 1).padStart(2, '0'), 'step'), element('h3', segment.name), element('span', LABELS[status], `badge ${status}`));
    const actions = element('div', undefined, 'actions');
    if (actor === 'reporter' && !['blocked', 'pending'].includes(status)) actions.append(button('Report a barrier', { type: 'report', segmentId: id }));
    if (actor === 'staff' && status === 'blocked') actions.append(button('Claim repair', { type: 'claim', segmentId: id }));
    if (actor === 'reviewer' && status === 'pending') actions.append(button('Recheck: resolved', { type: 'recheck', segmentId: id, passed: true }), button('Recheck: still blocked', { type: 'recheck', segmentId: id, passed: false }));
    if (actor === 'reviewer' && ['clear', 'unknown', 'stale'].includes(status)) actions.append(button('Record a clear observation', { type: 'observe', segmentId: id }));
    item.append(heading, element('p', segment.detail), element('p', `Fixture context above is fixed. Latest workflow status: ${LABELS[status]}.`, 'small'), element('p', segment.status === 'unknown' ? 'No observation recorded.' : `Observed ${date(segment.observedAt)} · Review due ${date(segment.expiresAt)}`, 'small'));
    if (status === 'blocked') {
      const shared = journeysAffectedBy(dataset.journeys, id).filter(j => j.id !== journey.id);
      if (shared.length) item.append(element('p', `Also required for: ${shared.map(j => j.name).join(', ')}`, 'small overdue'));
    }
    if (status === 'pending' && isOverdue(segment, now)) {
      const hours = Math.floor((now - segment.claim.at) / 3600000);
      item.append(element('p', `Recheck overdue: the repair claim has waited ${hours} hours.`, 'small overdue'));
    }
    if (actions.childElementCount) item.append(actions);
    return item;
  }));
  const activity = $('#activity');
  activity.hidden = state.events.length === 0;
  $('#activityCount').textContent = state.events.length ? `(${state.events.length})` : '';
  $('#events').replaceChildren(...state.events.slice(-15).reverse().map(event => element('li', eventDescription(event))));
}
function fresh() {
  const now = Date.now();
  state = { ...createState(dataset, now), startedAt: now, actions: [] };
}
function speakSummary() {
  if (!('speechSynthesis' in window)) { $('#feedback').textContent = "This browser can't read text aloud."; return; }
  const journey = dataset.journeys.find(j => j.id === selected);
  const now = simNow();
  const lines = journey.segments.map(id => {
    const segment = state.segments[id];
    return `${segment.name}: ${LABELS[segmentStatus(segment, now)]}`;
  });
  const utterance = new SpeechSynthesisUtterance(`${journey.name}. ${lines.join('. ')}.`);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
  $('#feedback').textContent = 'Reading the current journey status aloud.';
}
function downloadAuditTrail() {
  const trail = auditTrail(state);
  if (!trail.length) {
    $('#feedback').textContent = 'No accepted actions have been recorded yet.';
    return;
  }
  const report = {
    generatedAt: new Date().toISOString(),
    notice: 'Browser-local synthetic demo history. Identities are simulated and this file is not tamper-proof.',
    checkpoints: trail
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'access-relay-verification-history.json';
  link.click();
  URL.revokeObjectURL(url);
  $('#feedback').textContent = 'Browser-local verification history downloaded.';
}
async function init() {
  const response = await fetch('./data/journeys.json');
  if (!response.ok) throw new Error('Sample journeys could not be loaded.');
  dataset = await response.json();
  selected = dataset.journeys[0].id;
  fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    if (saved) {
      if (!Number.isFinite(saved.startedAt) || !Array.isArray(saved.actions) || saved.actions.length > 1000) throw new Error('Invalid local data');
      let replay = createState(dataset, saved.startedAt);
      for (const item of saved.actions) replay = applyAction(replay, item.action, item.at);
      state = { ...replay, startedAt: saved.startedAt, actions: saved.actions };
    }
  } catch { fresh(); $('#feedback').textContent = "Couldn't restore your saved demo, so here's a fresh one."; }
  $('#actor').addEventListener('change', () => { $('#feedback').textContent = `Demo actor changed to ${$('#actor').selectedOptions[0].textContent}. Available checkpoint actions have been updated.`; render(); });
  $('#reset').addEventListener('click', () => { fresh(); resetPreview(); save(); render(); $('#feedback').textContent = 'Synthetic demo reset.'; });
  $('#print').addEventListener('click', () => window.print());
  $('#speak').addEventListener('click', speakSummary);
  $('#auditTrail').addEventListener('click', downloadAuditTrail);
  $('#timeScrub').addEventListener('input', () => { previewHours = Number($('#timeScrub').value); render(); });
  $('#timeReset').addEventListener('click', () => { resetPreview(); render(); $('#feedback').textContent = 'Preview time reset to now.'; });
  const comfortKey = 'accessrelay-comfort';
  const applyComfort = enabled => {
    document.documentElement.classList.toggle('comfort', enabled);
    $('#comfort').setAttribute('aria-pressed', String(enabled));
    $('#comfort').textContent = enabled ? 'Comfort mode: on' : 'Comfort mode';
  };
  let comfortEnabled = false;
  try { comfortEnabled = localStorage.getItem(comfortKey) === '1'; } catch { /* keep the default */ }
  applyComfort(comfortEnabled);
  $('#comfort').addEventListener('click', () => {
    comfortEnabled = !comfortEnabled;
    applyComfort(comfortEnabled);
    try { localStorage.setItem(comfortKey, comfortEnabled ? '1' : '0'); } catch { /* preference remains session-only */ }
  });
  const connection = () => { $('#connection').textContent = navigator.onLine ? 'Online · local demo' : 'Offline · cached observations'; };
  window.addEventListener('online', connection); window.addEventListener('offline', connection); connection();
  render();
  setInterval(render, 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { $('#connection').textContent += ' · offline cache unavailable'; });
}
init().catch(error => { $('#feedback').textContent = error.message; });
