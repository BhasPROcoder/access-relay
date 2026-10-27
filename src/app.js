import { createState, segmentStatus, journeyStatus, applyAction, LABELS } from './domain.js';

const $ = selector => document.querySelector(selector);
const key = 'accessrelay-demo-events-v1';
let dataset, state, selected;
let storageAvailable = true;
let previewHours = 0;
const date = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const simNow = () => Date.now() + previewHours * 3600000;
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
      $('#feedback').textContent = storageAvailable ? 'Demo updated. See the new status and activity below.' : 'Demo updated in memory only; browser storage is unavailable.';
      $('#journey').focus();
    } catch (error) { $('#feedback').textContent = error.message; }
  });
  return node;
}
function render() {
  const now = simNow();
  const journey = dataset.journeys.find(j => j.id === selected);
  $('#timeReadout').textContent = previewHours === 0 ? 'now' : `${date(now)} (+${previewHours}h)`;
  $('#journeys').replaceChildren(...dataset.journeys.map(j => {
    const node = element('button', undefined, 'journey-option');
    node.append(element('strong', j.name), element('span', LABELS[journeyStatus(j, state, now)], 'small'));
    node.setAttribute('aria-pressed', String(selected === j.id));
    node.addEventListener('click', () => { selected = j.id; $('#feedback').textContent = ''; render(); });
    return node;
  }));
  const status = journeyStatus(journey, state, now);
  const badge = element('span', status === 'clear' ? 'No known obstruction in current observations' : LABELS[status], `badge ${status}`);
  $('#summary').replaceChildren(element('p', 'YOUR SERVICE JOURNEY', 'eyebrow'), element('h2', journey.name), element('p', journey.purpose), badge, element('p', `Owner: ${journey.owner}`, 'small'));
  $('#segments').replaceChildren(...journey.segments.map((id, index) => {
    const segment = state.segments[id], status = segmentStatus(segment, now);
    const item = element('li', undefined, 'segment');
    item.style.setProperty('--i', index);
    const heading = element('div', undefined, 'segment-heading');
    heading.append(element('span', String(index + 1).padStart(2, '0'), 'step'), element('h3', segment.name), element('span', LABELS[status], `badge ${status}`));
    const actions = element('div', undefined, 'actions');
    actions.append(button('Report barrier', { type: 'report', segmentId: id }));
    if (status === 'blocked') actions.append(button('Claim repair', { type: 'claim', segmentId: id }));
    if (status === 'pending') {
      actions.append(button('Recheck: resolved', { type: 'recheck', segmentId: id, passed: true }), button('Recheck: still blocked', { type: 'recheck', segmentId: id, passed: false }));
    }
    if (['clear', 'unknown', 'stale'].includes(status)) actions.append(button('Record a clear observation', { type: 'observe', segmentId: id }));
    item.append(heading, element('p', segment.detail), element('p', `Fixture context above is fixed. Latest workflow status: ${LABELS[status]}.`, 'small'), element('p', segment.status === 'unknown' ? 'No observation recorded.' : `Observed ${date(segment.observedAt)} · Review due ${date(segment.expiresAt)}`, 'small'), actions);
    return item;
  }));
  $('#events').replaceChildren(...(state.events.length ? state.events.slice(-15).reverse().map(event => element('li', `${date(event.at)} — ${state.segments[event.segmentId].name}: ${event.type}${event.type === 'recheck' ? (event.passed ? ' passed' : ' failed') : ''} (${event.actor})`)) : [element('li', 'No changes yet. Try reporting a barrier or rechecking a repair.')]));
}
function fresh() {
  const now = Date.now();
  state = { ...createState(dataset, now), startedAt: now, actions: [] };
}
function speakSummary() {
  if (!('speechSynthesis' in window)) { $('#feedback').textContent = 'Speech playback is not supported in this browser.'; return; }
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
  } catch { fresh(); $('#feedback').textContent = 'Saved demo could not be restored. A fresh sample is shown.'; }
  $('#actor').addEventListener('change', () => { $('#feedback').textContent = `Demo actor changed to ${$('#actor').selectedOptions[0].textContent}.`; });
  $('#reset').addEventListener('click', () => { fresh(); resetPreview(); save(); render(); $('#feedback').textContent = 'Synthetic demo reset.'; });
  $('#print').addEventListener('click', () => window.print());
  $('#speak').addEventListener('click', speakSummary);
  $('#timeScrub').addEventListener('input', () => { previewHours = Number($('#timeScrub').value); render(); });
  $('#timeReset').addEventListener('click', () => { resetPreview(); render(); $('#feedback').textContent = 'Preview time reset to now.'; });
  const connection = () => { $('#connection').textContent = navigator.onLine ? 'Online · local demo' : 'Offline · cached observations'; };
  window.addEventListener('online', connection); window.addEventListener('offline', connection); connection();
  render();
  setInterval(render, 60000);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => { $('#connection').textContent += ' · offline cache unavailable'; });
}
init().catch(error => { $('#feedback').textContent = error.message; });
