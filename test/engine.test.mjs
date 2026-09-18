import test from 'node:test';
import assert from 'node:assert/strict';
import { createPet, tick, act } from '../engine.mjs';

const HOUR = 3_600_000;
const approximately = (actual, expected) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} should equal ${expected}`);

test('frequent reads retain elapsed decay and match a single catch-up tick', () => {
  const frequent = createPet(0), absent = createPet(0);
  for (let now = 1000; now <= HOUR; now += 1000) tick(frequent, now);
  tick(absent, HOUR);
  for (const stat of ['hunger', 'happiness', 'energy', 'cleanliness', 'age']) approximately(frequent[stat], absent[stat]);
  approximately(frequent.hunger, 48);
  assert.equal(frequent.age, 3600);
  tick(frequent, HOUR - 1000);
  assert.equal(frequent.updatedAt, HOUR, 'a backward clock cannot reverse age or replay decay');
});

test('sleep prevents feeding and recovers energy as time passes', () => {
  const pet = createPet(0);
  pet.energy = 5;
  act(pet, 'sleep');
  const before = { hunger: pet.hunger, energy: pet.energy };
  assert.match(act(pet, 'feed'), /sleeping/);
  assert.equal(pet.hunger, before.hunger);
  tick(pet, HOUR);
  approximately(pet.energy, before.energy + 12);
  act(pet, 'wake');
  assert.equal(pet.sleeping, false);
  act(pet, 'feed');
  approximately(pet.hunger, before.hunger - 2 + 25);
});

test('care effects remain bounded and tired pets cannot play', () => {
  const pet = createPet(0);
  pet.hunger = 98;
  act(pet, 'feed');
  assert.equal(pet.hunger, 100);
  pet.health = pet.hunger = pet.happiness = 0;
  act(pet, 'heal');
  assert.equal(pet.health, 30);
  assert.equal(pet.hunger, 0);
  assert.equal(pet.happiness, 0);
  pet.energy = 5;
  assert.match(act(pet, 'play'), /too tired/);
  assert.equal(pet.energy, 5);
  assert.throws(() => act(pet, '__proto__'), /Unknown care action/);
});

test('long absences catch up through all stages without negative stats', () => {
  const pet = createPet(0);
  tick(pet, 31 * 24 * HOUR);
  assert.equal(pet.stage, 'elder');
  assert.equal(pet.age, 31 * 86400);
  for (const stat of ['hunger', 'happiness', 'energy', 'cleanliness', 'health']) assert.ok(pet[stat] >= 0 && pet[stat] <= 100);
});

test('3600x speed advances an hour of age and decay in one wall-clock second', () => {
  const pet = createPet(0);
  tick(pet, 1000, 3600);
  assert.equal(pet.age, 3600);
  assert.equal(pet.hunger, 48);
  assert.equal(pet.updatedAt, 1000, 'the update cursor remains a wall-clock timestamp');
});

test('frequent accelerated ticks match one accelerated catch-up including health budget', () => {
  const frequent = createPet(0), absent = createPet(0);
  frequent.health = absent.health = 49;
  for (let now = 10; now <= 500; now += 10) tick(frequent, now, 3600);
  assert.equal(frequent.sick, false, 'only half a simulation hour has elapsed');
  assert.equal(frequent.healthElapsedMs, HOUR / 2);
  for (let now = 510; now <= 1000; now += 10) tick(frequent, now, 3600);
  tick(absent, 1000, 3600);
  for (const key of ['hunger', 'happiness', 'energy', 'cleanliness', 'health', 'age', 'healthElapsedMs']) approximately(frequent[key], absent[key]);
  assert.equal(frequent.sick, true, 'the health check runs after one simulation hour');
  assert.equal(absent.sick, true);
});

test('changing speed affects only time after the preceding tick', () => {
  const pet = createPet(0);
  tick(pet, 10_000, 1);
  assert.equal(pet.age, 10);
  tick(pet, 11_000, 3600);
  assert.equal(pet.age, 3610);
  tick(pet, 12_000, 60);
  assert.equal(pet.age, 3670);
  approximately(pet.hunger, 50 - 2 * 3670 / 3600);
});
