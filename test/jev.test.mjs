import test from 'node:test';
import assert from 'node:assert/strict';
import { decide } from '../jev.mjs';

const apiKey = 'test-only-secret-never-display';
const pet = Object.freeze({
  name: 'Mochi', hunger: 10, happiness: 80, energy: 90,
  cleanliness: 90, health: 100, sleeping: false, sick: false, age: 120,
});

test('uses the native OpenRouter Decisions contract and reads a typed choice', async () => {
  const result = await decide(pet, {
    apiKey,
    fetchImpl: async (url, request) => {
      assert.equal(url, 'https://openrouter.ai/api/alpha/decisions');
      assert.equal(request.method, 'POST');
      assert.equal(request.headers.Authorization, `Bearer ${apiKey}`);
      assert.equal(request.headers['Content-Type'], 'application/json');
      assert.ok(request.signal instanceof AbortSignal);
      assert.equal(request.body.includes(apiKey), false);
      const body = JSON.parse(request.body);
      assert.equal(body.model, '~typesafe/jev-latest');
      assert.deepEqual(body.state, pet);
      assert.equal(body.questions.action.type, 'choice');
      assert.deepEqual(Object.keys(body.questions.action.criteria).sort(),
        ['clean', 'feed', 'heal', 'play', 'sleep', 'wait', 'wake']);
      return Response.json({
        model: 'typesafe/jev-1.13',
        answers: { action: { type: 'choice', choice: 'feed', confidence: 0.96 } },
      });
    },
  });
  assert.equal(result.action, 'feed');
  assert.equal(result.model, 'typesafe/jev-1.13');
  assert.equal(result.confidence, 0.96);
  assert.ok(Number.isInteger(result.latencyMs) && result.latencyMs >= 0);
});

test('rejects choices outside the care allowlist and malformed answer shapes', async () => {
  for (const answer of [
    { type: 'choice', choice: 'delete' },
    { type: 'choice', choice: '__proto__' },
    { type: 'choice', choice: null },
    { type: 'score', choice: 'feed' },
    null,
  ]) {
    await assert.rejects(decide(pet, {
      apiKey,
      fetchImpl: async () => Response.json({ answers: { action: answer } }),
    }), { code: 'INVALID_DECISION' });
  }
});

test('provider error bodies and network exceptions cannot expose credentials', async () => {
  for (const status of [400, 401, 402, 403, 404, 429, 500, 502, 503]) {
    await assert.rejects(decide(pet, {
      apiKey,
      fetchImpl: async () => new Response(`Provider echoed ${apiKey}`, { status }),
    }), error => {
      assert.equal(error.code, 'UPSTREAM_ERROR');
      assert.equal(String(error).includes(apiKey), false);
      assert.equal(error.cause, undefined);
      return true;
    });
  }
  await assert.rejects(decide(pet, {
    apiKey,
    fetchImpl: async () => { throw new Error(`Connection failed for ${apiKey}`); },
  }), error => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.equal(String(error).includes(apiKey), false);
    assert.equal(error.cause, undefined);
    return true;
  });
});

test('rejects an unreadable provider response with a sanitized error', async () => {
  await assert.rejects(decide(pet, {
    apiKey,
    fetchImpl: async () => new Response(apiKey),
  }), error => error.code === 'INVALID_RESPONSE' && !String(error).includes(apiKey));
});

test('missing keys are rejected before any request is made', async () => {
  let requests = 0;
  for (const missingKey of [undefined, '', '   ', null]) {
    await assert.rejects(decide(pet, {
      apiKey: missingKey,
      fetchImpl: async () => { requests++; throw new Error('Unexpected request'); },
    }), { code: 'MISSING_API_KEY' });
  }
  assert.equal(requests, 0);
});
