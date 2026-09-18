const $ = (selector) => document.querySelector(selector);
let state;
let actionPending = false;
let refreshing = false;
let toastTimer;
let animationTimer;
let lastDecisionAt;
let pendingPath;
let speedEditing = false;
const demoSpeeds = [1, 60, 600, 3600, 7200, 21600, 86400];
const demoSpeedLabels = ['Real time', '1 minute / sec', '10 minutes / sec', '1 hour / sec', '2 hours / sec', '6 hours / sec', '24 hours / sec'];
const actions = { feed: 'i-food', play: 'i-play', clean: 'i-clean', sleep: 'i-moon', wake: 'i-sun', heal: 'i-heart', wait: 'i-clock' };

function toast(message, error = false) {
  $('#toast').textContent = message;
  $('#toast').classList.toggle('error', error);
  $('#toast').classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), error ? 6500 : 3500);
}

async function api(path, body) {
  const response = await fetch(path, body === undefined ? { cache: 'no-store' } : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({ error: 'The server returned an unreadable response.' }));
  if (!response.ok || data.error) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function formatAge(seconds) {
  const age = Math.max(0, Math.floor(Number(seconds) || 0));
  const day = Math.floor(age / 86400) + 1;
  const hour = String(Math.floor(age / 3600) % 24).padStart(2, '0');
  const minute = String(Math.floor(age / 60) % 60).padStart(2, '0');
  return `Day ${day} · ${hour}:${minute}`;
}

function timeAgo(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function icon(symbol) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#${symbol}`);
  svg.setAttribute('aria-hidden', 'true');
  svg.append(use);
  return svg;
}

function renderEvents(events) {
  const list = $('#event-list');
  const scrollTop = list.scrollTop;
  const previousHeight = list.scrollHeight;
  const previousFirst = list.dataset.latest;
  list.replaceChildren();
  const ordered = events.filter(event => /^(jev|agent|ai)$/i.test(event.actor || '') || (event.actor === 'system' && event.action === 'error')).sort((a, b) => new Date(b.at) - new Date(a.at));
  list.dataset.latest = String(ordered[0]?.id || ordered[0]?.at || '');
  if (!ordered.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-state';
    empty.textContent = 'Jev’s decisions will appear here. Take a turn or enable autopilot.';
    list.append(empty);
  }
  for (const event of ordered) {
    const row = document.createElement('li');
    row.className = 'event';
    const badge = document.createElement('span');
    badge.className = 'event-icon jev';
    badge.append(icon(actions[event.action] || 'i-spark'));
    const copy = document.createElement('div');
    copy.className = 'event-copy';
    const title = document.createElement('strong');
    title.textContent = event.action === 'error' ? 'Jev’s check-in failed' : `Jev chose ${String(event.action || 'wait').replace(/^./, letter => letter.toUpperCase())}`;
    const message = document.createElement('p');
    message.textContent = event.message || 'Care action completed.';
    const metadata = document.createElement('small');
    const time = document.createElement('time');
    if (event.at) { time.dateTime = String(event.at); time.title = new Date(event.at).toLocaleString(); }
    time.textContent = `${new Date(event.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · ${timeAgo(event.at)}`;
    metadata.append(time);
    if (Number.isFinite(event.gameAge)) {
      metadata.append(document.createElement('br'), document.createTextNode(`${formatAge(event.gameAge)} game time`));
    }
    const decision = event.decision || {};
    const details = [Number.isFinite(decision.latencyMs) ? `${decision.latencyMs} ms` : '', Number.isFinite(decision.confidence) ? `${Math.round(decision.confidence * 100)}% model confidence` : ''].filter(Boolean).join(' · ');
    if (details) metadata.append(document.createTextNode(` · ${details}`));
    copy.append(title, message, metadata);
    row.append(badge, copy);
    list.append(row);
  }
  list.scrollTop = scrollTop > 0 && previousFirst && previousFirst !== list.dataset.latest ? scrollTop + Math.max(0, list.scrollHeight - previousHeight) : scrollTop;
}

function render(data) {
  if (!data?.pet || !data?.agent) return;
  state = data;
  const { pet, agent } = data;
  const minNeed = Math.min(pet.hunger, pet.happiness, pet.energy, pet.cleanliness, pet.health);
  let mood = 'Happy to be here';
  let speech = 'A tiny friend. A whole lot of possibility.';
  if (pet.sleeping) { mood = 'Dreaming little dreams'; speech = 'Recharging my tiny batteries…'; }
  else if (pet.health < 35) { mood = 'Could use some care'; speech = 'A little help, please?'; }
  else if (pet.hunger < 40) { mood = 'A little hungry'; speech = 'Is it snack time yet?'; }
  else if (pet.energy < 35) { mood = 'Getting sleepy'; speech = 'That was a big day for a little me.'; }
  else if (pet.cleanliness < 40) { mood = 'A little messy'; speech = 'I may have found a dust bunny.'; }
  else if (pet.happiness < 40) { mood = 'Ready for some company'; speech = 'Got a little time to play?'; }
  else if (minNeed > 75) { mood = 'Feeling pretty wonderful'; speech = 'Small life. Big happy feelings.'; }
  $('#room-title').textContent = `${pet.name || 'Mochi'}’s room`;
  $('#pet-age').textContent = formatAge(pet.age);
  $('#pet-mood').textContent = mood;
  $('#pet-speech').textContent = speech;
  $('#pet-room').classList.toggle('sleeping', Boolean(pet.sleeping));
  for (const need of ['hunger', 'happiness', 'energy', 'cleanliness', 'health']) {
    const value = Math.max(0, Math.min(100, Math.round(Number(pet[need]) || 0)));
    $(`#${need}-value`).textContent = `${value}%`;
    const meter = $(`#${need}-meter`);
    meter.setAttribute('aria-valuenow', value);
    meter.firstElementChild.style.width = `${value}%`;
    meter.classList.toggle('low', value < 30);
  }
  const sleepButton = $('#sleep-button');
  sleepButton.dataset.action = pet.sleeping ? 'wake' : 'sleep';
  sleepButton.querySelector('span').textContent = pet.sleeping ? 'Wake' : 'Rest';
  sleepButton.querySelector('use').setAttribute('href', pet.sleeping ? '#i-sun' : '#i-moon');
  $('#autopilot-toggle').setAttribute('aria-checked', String(Boolean(agent.enabled)));
  $('#autopilot-toggle').setAttribute('aria-label', `${agent.enabled ? 'Disable' : 'Enable'} Jev autopilot`);
  $('#autopilot-toggle').disabled = actionPending;
  $('#autopilot-caption').textContent = agent.enabled ? 'A little care, on a regular rhythm' : 'Care, even between your visits';
  $('#agent-dot').classList.toggle('active', agent.configured && !agent.lastError);
  const thinking = agent.busy || pendingPath === '/api/agent/step';
  $('#agent-status').textContent = thinking ? 'Jev is checking in…' : agent.lastError ? 'Jev needs a little attention' : !agent.configured ? 'Ready when you are' : agent.enabled ? 'Autopilot is looking after things' : 'Connected · waiting for a turn';
  $('#agent-explanation').textContent = agent.lastError || (agent.busy ? 'Reading your pet’s needs and choosing the next care action through OpenRouter.' : !agent.configured ? 'Connect your OpenRouter key to let Jev check in, choose an action, and care for your pet.' : agent.enabled ? `Jev checks your pet’s needs every ${agent.intervalSeconds} seconds and decides how to help. You can still jump in anytime.` : 'Jev is connected. Turn on autopilot for regular check-ins, or ask for one little moment of care.');
  $('#connect-button').firstChild.textContent = agent.configured ? 'Connection settings ' : 'Connect Jev ';
  $('#connect-button').hidden = Boolean(agent.configured);
  $('#agent-explanation').hidden = Boolean(agent.configured && !agent.lastError);
  $('#step-button').disabled = !agent.configured || agent.busy || actionPending;
  $('#step-button').lastChild.textContent = thinking ? ' Jev is thinking…' : ' Let Jev take a turn';
  $('#autopilot-caption').textContent = agent.enabled ? `Checking every ${agent.intervalSeconds || 60} seconds` : 'Off · take a turn manually';
  if (!speedEditing) {
    const speedIndex = Math.max(0, demoSpeeds.indexOf(data.simulation?.speed || 1));
    $('#demo-speed').value = speedIndex;
    $('#demo-speed').setAttribute('aria-valuetext', demoSpeedLabels[speedIndex]);
    $('#demo-speed-value').textContent = demoSpeedLabels[speedIndex];
  }
  const cadence = String(agent.intervalSeconds || 60);
  if (![...$('#care-cadence').options].some(option => option.value === cadence)) {
    const option = document.createElement('option');
    option.value = cadence; option.textContent = `${cadence} seconds`;
    $('#care-cadence').append(option);
  }
  $('#care-cadence').value = cadence;
  const decision = agent.lastDecision;
  if (decision?.at && lastDecisionAt && decision.at !== lastDecisionAt) {
    $('#pet-room').classList.remove('action');
    requestAnimationFrame(() => $('#pet-room').classList.add('action'));
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => $('#pet-room').classList.remove('action'), 1150);
  }
  lastDecisionAt = decision?.at || null;
  $('#decision-data').textContent = agent.lastDecision ? JSON.stringify(agent.lastDecision, null, 2) : 'No Jev decision yet. Connect a key and ask Jev to take a turn.';
  const engine = $('#engine-name');
  engine.replaceChildren();
  if (data.engine?.url && /^https?:\/\//.test(data.engine.url)) {
    const link = document.createElement('a');
    link.href = data.engine.url; link.target = '_blank'; link.rel = 'noreferrer'; link.textContent = data.engine.name || data.engine.url;
    engine.append(link);
  } else engine.textContent = data.engine?.name || 'Local virtual pet simulation';
  renderEvents(data.events || []);
  $('#connection-status').classList.remove('disconnected');
  $('#connection-status').lastChild.textContent = ' LIVE';
}

async function refresh() {
  if (refreshing || actionPending) return;
  refreshing = true;
  try { render(await api('/api/state')); }
  catch { $('#connection-status').classList.add('disconnected'); $('#connection-status').lastChild.textContent = ' OFFLINE'; }
  finally { refreshing = false; }
}

async function mutate(path, body, message) {
  if (actionPending) return;
  actionPending = true;
  pendingPath = path;
  document.querySelectorAll('[data-action]').forEach(button => button.disabled = true);
  if (state) render(state);
  try {
    const data = await api(path, body);
    render(data);
    if (message) toast(message);
    return data;
  } catch (error) { toast(error.message, true); throw error; }
  finally {
    actionPending = false;
    pendingPath = null;
    document.querySelectorAll('[data-action]').forEach(button => button.disabled = false);
    if (state) render(state);
  }
}

function openSettings() {
  $('#api-key').value = '';
  $('#api-key').placeholder = state?.agent.configured ? 'Connected · leave blank to keep your key' : 'sk-or-v1-…';
  $('#key-note').textContent = state?.agent.configured ? 'A key is already loaded on the server. Leave blank to keep it.' : 'Your key is sent to this server, never stored in browser storage.';
  $('#interval').value = String(state?.agent.intervalSeconds || 60);
  if (!$('#interval').value) {
    const option = document.createElement('option');
    option.value = String(state.agent.intervalSeconds);
    option.textContent = `Every ${state.agent.intervalSeconds} seconds`;
    $('#interval').append(option); $('#interval').value = option.value;
  }
  $('#settings-error').textContent = '';
  $('#settings-dialog').showModal();
}

document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', async () => {
  try {
    await mutate('/api/action', { action: button.dataset.action });
    $('#pet-room').classList.remove('action');
    requestAnimationFrame(() => $('#pet-room').classList.add('action'));
    clearTimeout(animationTimer);
    animationTimer = setTimeout(() => $('#pet-room').classList.remove('action'), 1150);
  } catch { /* The shared action handler displays the error. */ }
}));
$('#settings-top').addEventListener('click', openSettings);
$('#connect-button').addEventListener('click', openSettings);
$('#close-settings').addEventListener('click', () => $('#settings-dialog').close());
$('#settings-dialog').addEventListener('close', () => { $('#api-key').value = ''; });
$('#settings-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close(); } });
$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  const key = $('#api-key').value.trim();
  if (!key && !state?.agent.configured) { $('#settings-error').textContent = 'Add an OpenRouter API key to connect Jev.'; return; }
  const body = { intervalSeconds: Number($('#interval').value) };
  if (key) body.apiKey = key;
  const submit = $('#settings-form button[type=submit]');
  submit.disabled = true;
  $('#settings-error').textContent = '';
  try { await mutate('/api/agent', body, 'Connection saved. Jev is ready to take a turn.'); $('#settings-dialog').close(); }
  catch (error) { $('#settings-error').textContent = error.message; }
  finally { submit.disabled = false; }
});
$('#autopilot-toggle').addEventListener('click', async () => {
  if (!state?.agent.configured) { openSettings(); return; }
  try { await mutate('/api/agent', { enabled: !state.agent.enabled }); } catch { /* Error shown by mutate. */ }
});
$('#step-button').addEventListener('click', async () => {
  $('#step-button').lastChild.textContent = ' Jev is thinking…';
  try { await mutate('/api/agent/step', {}); } catch { /* Error shown by mutate. */ }
});
$('#demo-speed').addEventListener('input', event => {
  speedEditing = true;
  const label = demoSpeedLabels[Number(event.target.value)];
  $('#demo-speed-value').textContent = label;
  event.target.setAttribute('aria-valuetext', label);
});
$('#demo-speed').addEventListener('change', async event => {
  const slider = event.target;
  slider.disabled = true;
  try { await mutate('/api/simulation', { speed: demoSpeeds[Number(slider.value)] }); }
  catch { /* Error shown by mutate. */ }
  finally { speedEditing = false; slider.disabled = false; if (state) render(state); }
});
$('#care-cadence').addEventListener('change', async event => {
  const select = event.target;
  const intervalSeconds = Number(select.value);
  select.disabled = true;
  try { await mutate('/api/agent', { intervalSeconds }); }
  catch { /* Error shown by mutate. */ }
  finally { select.disabled = false; if (state) render(state); }
});
$('#reset-button').addEventListener('click', async () => {
  if (!confirm('Start a new life? This resets your pet and its care journal.')) return;
  try { await mutate('/api/reset', {}, 'A new little story begins.'); } catch { /* Error shown by mutate. */ }
});
refresh();
setInterval(refresh, 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
