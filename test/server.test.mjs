import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';

async function app(t, options = {}) {
  const server = createApp({ dataDir: null, apiKey: 'test', decideFn: async () => ({ action: 'feed', reason: 'Mochi needs lunch.' }), ...options });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return async (path, body, overrides = {}) => {
    const response = await fetch(`${base}${path}`, {
      ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
      ...overrides,
    });
    return { status: response.status, body: await response.json() };
  };
}

test('HTTP state and manual actions share one persistent in-memory pet', async t => {
  const request = await app(t);
  const initial = await request('/api/state');
  assert.equal(initial.status, 200);
  assert.equal(initial.body.pet.name, 'Mochi');
  assert.equal(initial.body.agent.configured, true);
  assert.equal(initial.body.agent.enabled, false);
  const fed = await request('/api/action', { action: 'feed' });
  assert.equal(fed.status, 200);
  assert.ok(fed.body.pet.hunger > initial.body.pet.hunger + 24);
  assert.equal(fed.body.events[0].actor, 'you');
  assert.equal(fed.body.events[0].action, 'feed');
  const reread = await request('/api/state');
  assert.ok(Math.abs(reread.body.pet.hunger - fed.body.pet.hunger) < 0.1);
});

test('invalid inputs reject without changing settings or allowing cross-origin writes', async t => {
  const request = await app(t);
  for (const action of ['explode', '__proto__', null, 1]) {
    assert.equal((await request('/api/action', { action })).status, 400);
  }
  for (const body of [{ enabled: 'yes' }, { apiKey: 7 }, ...[0, -1, 0.049, '0.05', null, true, 3600.01, 3601].map(intervalSeconds => ({ intervalSeconds }))]) {
    assert.equal((await request('/api/agent', body)).status, 400);
  }
  const invalidJson = await request('/api/action', {}, { body: '{' });
  assert.equal(invalidJson.status, 400);
  assert.equal((await request('/api/action', [], {})).status, 400);
  const foreign = await request('/api/action', { action: 'feed' }, { headers: { 'Content-Type': 'application/json', Origin: 'https://example.com' } });
  assert.equal(foreign.status, 403);
  const state = (await request('/api/state')).body;
  assert.equal(state.agent.intervalSeconds, 30);
  assert.equal(state.agent.enabled, false);
  assert.equal(state.events.length, 1);
});

test('fractional Jev intervals include the 50ms minimum and preserve simulation speed', async t => {
  const request = await app(t);
  await request('/api/simulation', { speed: 21600 });
  for (const intervalSeconds of [0.05, 0.1, 0.25, 0.5, 10.5, 3600]) {
    const result = await request('/api/agent', { intervalSeconds });
    assert.equal(result.status, 200);
    assert.equal(result.body.agent.intervalSeconds, intervalSeconds);
    assert.equal(result.body.simulation.speed, 21600);
  }
});

test('fast autopilot exceeds one check per second while using fresh state and one in-flight decision', async t => {
  let active = 0, maxActive = 0, completed = 0;
  const inputs = [], starts = [];
  const request = await app(t, { decideFn: async pet => {
    active++;
    maxActive = Math.max(maxActive, active);
    inputs.push(pet);
    starts.push(Date.now());
    await new Promise(resolve => setTimeout(resolve, 80));
    active--;
    completed++;
    return { action: 'feed', reason: 'A fresh meal.' };
  } });
  assert.equal((await request('/api/agent', { intervalSeconds: 0.05, enabled: true })).status, 200);
  const deadline = Date.now() + 3000;
  while (completed < 3 && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const running = (await request('/api/state')).body;
  await request('/api/agent', { enabled: false });
  while (active > 0) await new Promise(resolve => setTimeout(resolve, 10));
  assert.ok(completed >= 3, 'autopilot completes repeated decisions');
  assert.ok(starts[2] - starts[0] < 1000, 'at least three checks begin within one second');
  assert.equal(maxActive, 1, 'slow decisions never overlap despite the shorter interval');
  assert.ok(inputs[1].hunger > inputs[0].hunger + 24, 'the next decision sees the previous meal applied');
  assert.ok(running.agent.actualChecksPerSecond > 1, 'the reported rate reflects completed scheduling');
  assert.ok(running.events.filter(event => event.actor === 'jev').length >= 3);
});

test('keys stay server-side and a stubbed Jev decision performs the chosen action', async t => {
  const secret = 'sk-openrouter-secret-only-for-this-test';
  let decisionInput;
  const request = await app(t, { decideFn: async (pet, options) => {
    decisionInput = { pet, options };
    return { action: 'play', reason: 'Time for a game.' };
  } });
  const settings = await request('/api/agent', { apiKey: secret });
  assert.equal(settings.status, 200);
  assert.equal(settings.body.agent.configured, true);
  const result = await request('/api/agent/step', {});
  assert.equal(result.status, 200);
  assert.equal(decisionInput.options.apiKey, secret);
  assert.equal(decisionInput.pet.name, 'Mochi');
  assert.equal(result.body.agent.lastDecision.action, 'play');
  assert.equal(result.body.agent.busy, false);
  assert.equal(result.body.events[0].actor, 'jev');
  assert.ok(result.body.pet.happiness > 69);
  for (const value of [settings.body, result.body, (await request('/api/state')).body]) {
    assert.equal(JSON.stringify(value).includes(secret), false);
    assert.equal(JSON.stringify(value).includes('"apiKey"'), false);
  }
});

test('manual care invalidates a decision made using an older pet snapshot', async t => {
  let releaseDecision, notifyStarted;
  const started = new Promise(resolve => { notifyStarted = resolve; });
  const pendingDecision = new Promise(resolve => { releaseDecision = resolve; });
  const request = await app(t, { decideFn: async () => { notifyStarted(); return pendingDecision; } });
  const pending = request('/api/agent/step', {});
  await started;
  const busy = await request('/api/agent/step', {});
  assert.equal(busy.status, 409);
  const manual = await request('/api/action', { action: 'feed' });
  releaseDecision({ action: 'play', reason: 'Based on the old state.' });
  const result = await pending;
  assert.equal(result.status, 200);
  assert.equal(result.body.agent.lastDecision, null);
  assert.ok(Math.abs(result.body.pet.happiness - manual.body.pet.happiness) < 0.1);
  assert.equal(result.body.events.some(event => event.actor === 'jev'), false);
  assert.match(result.body.events[0].message, /changed while Jev was deciding/);
});

test('autopilot and one-off decisions require a key without calling the model', async t => {
  let calls = 0;
  const request = await app(t, { apiKey: '', decideFn: async () => { calls++; return { action: 'wait' }; } });
  assert.equal((await request('/api/agent', { enabled: true })).status, 400);
  assert.equal((await request('/api/agent/step', {})).status, 400);
  const state = (await request('/api/state')).body;
  assert.equal(state.agent.configured, false);
  assert.equal(state.agent.enabled, false);
  assert.equal(calls, 0);
});

test('simulation speed changes settle elapsed time at the previous speed', async t => {
  let now = 1_800_000_000_000;
  t.mock.method(Date, 'now', () => now);
  const request = await app(t);
  assert.equal((await request('/api/state')).body.simulation.speed, 1);
  now += 10_000;
  const accelerated = await request('/api/simulation', { speed: 600 });
  assert.equal(accelerated.status, 200);
  assert.equal(accelerated.body.pet.age, 10, 'the previous ten seconds are not accelerated retroactively');
  assert.equal(accelerated.body.simulation.speed, 600);
  now += 1000;
  const slowed = await request('/api/simulation', { speed: 60 });
  assert.equal(slowed.body.pet.age, 610, 'the pending second is settled at 600x before switching');
  now += 1000;
  assert.equal((await request('/api/state')).body.pet.age, 670);
});

test('invalid speeds preserve settings and one-second Jev cadence is independent', async t => {
  const request = await app(t);
  assert.equal((await request('/api/simulation', { speed: 600 })).status, 200);
  for (const speed of [0, -1, 2, 59, 3601, '60', null, true, [], {}]) {
    assert.equal((await request('/api/simulation', { speed })).status, 400);
    const state = (await request('/api/state')).body;
    assert.equal(state.simulation.speed, 600);
    assert.equal(state.agent.intervalSeconds, 30);
  }
  const cadence = await request('/api/agent', { intervalSeconds: 1 });
  assert.equal(cadence.status, 200);
  assert.equal(cadence.body.agent.intervalSeconds, 1);
  assert.equal(cadence.body.simulation.speed, 600);
  for (const speed of [1, 60, 600, 3600, 7200, 21600, 86400]) {
    const changed = await request('/api/simulation', { speed });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.simulation.speed, speed);
    assert.equal(changed.body.agent.intervalSeconds, 1);
    assert.equal(changed.body.agent.enabled, false);
  }
});
