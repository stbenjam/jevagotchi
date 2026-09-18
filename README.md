# Jevagotchi

A local virtual pet with an interactive browser habitat, manual care, and a Jev caretaker. Real decisions come from `~typesafe/jev-latest` on OpenRouter; no simulated AI fallback.

## Run

Requires Node.js 22 or newer. No runtime npm dependencies or installation step.

```sh
cp .env.example .env
# Set OPENROUTER_API_KEY in .env (or connect a key in the page's settings).
npm start
```

Open http://localhost:3000. Use the one-turn button for one decision or turn on autopilot. The server keeps caring while the browser is closed, provided the Node process remains running. Autopilot starts paused after a server restart. Check-in intervals range from 1 to 3600 real seconds (default 30); each turn makes one billable API request. Only one request runs at a time. Failures pause autopilot and appear in the UI. Manual changes made during an in-flight decision cause that stale decision to be discarded.

Pet state and recent activity are saved in `data/pet.json`. `.env` and `data/` are ignored by Git. Keys entered through the UI stay in server memory, are never returned to the browser, and disappear on restart. The server binds only to loopback and rejects cross-origin writes. This is a single-user local app, not a public multiuser service.

## Engine choice

The app reuses the standalone JavaScript core of [tamagotchi-mcp 1.0.0](https://www.npmjs.com/package/tamagotchi-mcp), declared MIT by its publisher. The upstream engine supplies meals, play, cleaning, medicine, sleep/wake, mood, sickness, and evolution. Its two runtime source files are vendored unchanged; no package install scripts or MCP server run. See [provenance](vendor/tamagotchi-mcp/NOTICE.md). The npm archive does not include its referenced LICENSE file; its original licensing declarations are preserved.

`engine.mjs` wraps the core with HTTP-server-owned persistence, fractional elapsed-time decay, and bounded stats. The Demo speed slider accelerates needs, age, and evolution together: real time, 60×, 600×, or 3600× (one game hour per real second). The pet header and action feed show game time. Jev’s check-in interval is independently set in real seconds, so simulation speed cannot silently multiply API calls. Demo speed resets to real time after a restart; offline time also passes at real speed. At normal speed, needs decay hourly and evolution takes days. All meters, including hunger/fullness, mean **higher is healthier**. Sleep/wake retain the upstream immediate energy boosts, with additional recovery while sleeping. This is a ROM-free virtual pet, not original Tamagotchi hardware emulation.

Other candidates researched:

- [Pygotchi](https://github.com/almarch/pygotchi): best match for a complete emulation server, FastAPI, browser UI and existing care bot. GPL-2.0; requires a user-supplied ROM and a heavier Linux/container setup.
- [Tama96](https://github.com/siegerts/tama96): MIT, Rust engine, desktop UI and MCP integration; desktop/TCP integration is heavier for this small local web app.
- [Tamagotchi-API](https://github.com/StefanBauwens/Tamagotchi-API): background emulator with state REST endpoints, but requires a ROM and does not expose high-level care actions.

## Jev integration

Jev is a structured decision model, not a chatbot. The [model page](https://openrouter.ai/~typesafe/jev-latest) describes the rolling latest alias. The [official OpenRouter Decisions API](https://openrouter.ai/docs/client-sdks/go/sdks/decisions/README.md) uses:

```text
POST https://openrouter.ai/api/alpha/decisions
{ model, state, questions: { action: { type: "choice", instructions, criteria } } }
```

The response's `answers.action.choice` must be one of `feed`, `play`, `sleep`, `wake`, `clean`, `heal`, or `wait`. The application validates this allowlist and applies exactly one action. It records the actual model, latency, and confidence when supplied. The activity descriptions come from the game engine, not generated Jev prose. Requests time out after 15 seconds. This endpoint is alpha and may change.

## Local API

- `GET /api/state` — pet, events, caretaker state, engine provenance.
- `POST /api/action` — `{ "action": "feed" }`.
- `POST /api/agent` — `{ "enabled": true, "intervalSeconds": 30 }`; optional `apiKey` updates the in-memory key.
- `POST /api/agent/step` — `{}`; ask Jev to choose and apply one action.
- `POST /api/simulation` — `{ "speed": 3600 }`; accepted speeds are 1, 60, 600, and 3600.
- `POST /api/reset` — `{}`; reset the pet and pause autopilot.

POST requests require `Content-Type: application/json`. No API returns the key.

```sh
npm test
```
