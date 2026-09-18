import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createPet, tick, act, engineInfo } from './engine.mjs';
import { decide } from './jev.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const actions = new Set(['feed', 'play', 'sleep', 'wake', 'clean', 'heal', 'wait']);
export function createApp({ apiKey = process.env.OPENROUTER_API_KEY || '', dataDir = resolve(root, 'data'), decideFn = decide } = {}) {
  let pet = createPet(), events = [], revision = 0, nextTurn = 0;
  const agent = { enabled: false, configured: Boolean(apiKey), busy: false, intervalSeconds: 30, lastDecision: null, lastError: null, model: '~typesafe/jev-latest' };
  const simulation = { speed: 1 };
  const speeds = new Set([1, 60, 600, 3600]);
  const advance = () => tick(pet, Date.now(), simulation.speed);
  const saveFile = dataDir && resolve(dataDir, 'pet.json');
  if (saveFile && existsSync(saveFile)) {
    const saved = JSON.parse(readFileSync(saveFile, 'utf8'));
    if (!saved.pet || !Number.isFinite(saved.pet.updatedAt)) throw new Error('Invalid pet save. Restore data/pet.json or move it aside to start a new pet.');
    pet = saved.pet;
    tick(pet); // Time spent offline always passes at real-world speed.
    events = Array.isArray(saved.events) ? saved.events.slice(0, 60) : [];
  }
  function save() {
    if (!saveFile) return;
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(`${saveFile}.tmp`, JSON.stringify({ pet, events }), { mode: 0o600 });
    renameSync(`${saveFile}.tmp`, saveFile);
  }
  function event(actor, action, message, decision) {
    events.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), gameAge: pet.age, actor, action, message, ...(decision ? { decision } : {}) });
    events = events.slice(0, 60);
  }
  if (!events.length) event('system', 'welcome', `${pet.name} has arrived. A little care goes a long way.`);
  function snapshot() {
    advance();
    return { pet, events, simulation, agent: { ...agent, configured: Boolean(apiKey) }, engine: engineInfo };
  }
  async function step() {
    if (!apiKey) throw Object.assign(new Error('Add an OpenRouter API key in settings first.'), { status: 400 });
    if (agent.busy) throw Object.assign(new Error('Jev is already choosing an action.'), { status: 409 });
    agent.busy = true; agent.lastError = null;
    const startRevision = revision;
    const turnStartedAt = Date.now();
    try {
      advance();
      const choice = await decideFn(structuredClone(pet), { apiKey });
      if (!actions.has(choice.action)) throw new Error('Jev returned an unsupported care action.');
      if (startRevision !== revision) { event('system', 'wait', 'The pet changed while Jev was deciding. Its next turn will use the fresh state.'); return; }
      advance();
      const message = act(pet, choice.action);
      revision++;
      agent.lastDecision = { ...choice, at: new Date().toISOString() };
      event('jev', choice.action, message, agent.lastDecision);
      save();
    } catch (error) {
      agent.lastError = error.message;
      agent.enabled = false;
      event('system', 'error', `Jev paused: ${error.message}`);
      throw error;
    } finally { agent.busy = false; nextTurn = turnStartedAt + agent.intervalSeconds * 1000; }
  }
  const timer = setInterval(() => {
    advance();
    if (agent.enabled && !agent.busy && Date.now() >= nextTurn) step().catch(() => {});
  }, 1000);
  const saveTimer = setInterval(save, 15000);
  timer.unref(); saveTimer.unref();
  function json(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  }
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('Send application/json.'), { status: 415 });
    let content = '';
    for await (const chunk of req) {
      content += chunk;
      if (content.length > 8192) throw Object.assign(new Error('Request too large.'), { status: 413 });
    }
    try {
      const result = JSON.parse(content || '{}');
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error();
      return result;
    } catch { throw Object.assign(new Error('Invalid JSON object.'), { status: 400 }); }
  }
  const server = http.createServer(async (req, res) => {
    try {
      // This is a local, single-pet app. Block cross-site writes and DNS rebinding.
      const host = req.headers.host || '';
      if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return json(res, 403, { error: 'Use localhost to access this app.' });
      if (req.headers.origin && req.headers.origin !== `http://${host}`) return json(res, 403, { error: 'Cross-origin requests are not allowed.' });
      const path = new URL(req.url, 'http://localhost').pathname;
      if (req.method === 'GET' && path === '/api/state') return json(res, 200, snapshot());
      if (req.method === 'POST' && path.startsWith('/api/')) {
        const input = await body(req);
        if (path === '/api/action') {
          if (!actions.has(input.action)) return json(res, 400, { error: 'Unknown care action.' });
          advance(); const message = act(pet, input.action); revision++; event('you', input.action, message); save();
        } else if (path === '/api/agent') {
          if ('apiKey' in input && (typeof input.apiKey !== 'string' || input.apiKey.length > 512)) return json(res, 400, { error: 'Invalid API key.' });
          if ('enabled' in input && typeof input.enabled !== 'boolean') return json(res, 400, { error: 'enabled must be true or false.' });
          if ('intervalSeconds' in input && (!Number.isInteger(input.intervalSeconds) || input.intervalSeconds < 1 || input.intervalSeconds > 3600)) return json(res, 400, { error: 'Choose an interval between 1 and 3600 seconds.' });
          const candidateKey = 'apiKey' in input ? input.apiKey.trim() : apiKey;
          if (input.enabled && !candidateKey) return json(res, 400, { error: 'Add an OpenRouter API key first.' });
          if ('apiKey' in input) { apiKey = candidateKey; revision++; agent.lastError = null; if (!apiKey) agent.enabled = false; }
          if ('intervalSeconds' in input) { agent.intervalSeconds = input.intervalSeconds; nextTurn = Date.now() + agent.intervalSeconds * 1000; }
          if ('enabled' in input) { agent.enabled = input.enabled; nextTurn = Date.now(); if (!input.enabled) revision++; }
        } else if (path === '/api/simulation') {
          if (!speeds.has(input.speed)) return json(res, 400, { error: 'Choose a supported simulation speed.' });
          advance();
          simulation.speed = input.speed;
          nextTurn = Date.now(); revision++;
          save();
        } else if (path === '/api/agent/step') {
          await step();
        } else if (path === '/api/reset') {
          revision++; agent.enabled = false; agent.lastDecision = null; agent.lastError = null;
          pet = createPet(); events = []; event('system', 'welcome', 'A fresh start for Mochi.'); save();
        } else return json(res, 404, { error: 'Unknown endpoint.' });
        return json(res, 200, snapshot());
      }
      const files = { '/': ['index.html', 'text/html'], '/styles.css': ['styles.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'] };
      if (req.method === 'GET' && files[path]) {
        const [file, type] = files[path];
        res.writeHead(200, { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; script-src 'self'; connect-src 'self'; frame-ancestors 'none'" });
        return res.end(readFileSync(resolve(root, 'public', file)));
      }
      json(res, 404, { error: 'Not found.' });
    } catch (error) { json(res, error.status || 502, { error: error.message || 'Request failed.' }); }
  });
  server.on('close', () => { clearInterval(timer); clearInterval(saveTimer); save(); });
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createApp();
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '127.0.0.1', () => console.log(`Jevagotchi is ready at http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
}
