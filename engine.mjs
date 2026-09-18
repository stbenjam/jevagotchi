import { TamagotchiManager } from './vendor/tamagotchi-mcp/tamagotchi.js';

export const engineInfo = {
  name: 'tamagotchi-mcp 1.0.0',
  url: 'https://www.npmjs.com/package/tamagotchi-mcp',
  license: 'MIT',
};

// The HTTP server owns persistence. Never write to the upstream home directory.
class MemoryManager extends TamagotchiManager {
  ensureDataDir() {}
  saveState() {}
  loadState() { return null; }
}

const statNames = ['hunger', 'happiness', 'energy', 'cleanliness', 'health'];
const bounded = value => Math.max(0, Math.min(100, value));

function managerFor(pet) {
  const manager = new MemoryManager();
  manager.tamagotchi = {
    name: pet.name,
    species: 'mametchi',
    age: Math.floor(pet.age / 86400),
    stage: pet.stage || 'egg',
    stats: Object.fromEntries([...statNames.map(key => [key, pet[key]]), ['discipline', pet.discipline || 0]]),
    isSick: pet.sick || false,
    isSleeping: pet.sleeping,
    mood: pet.mood || 'happy',
    evolutionPoints: pet.evolutionPoints || 0,
  };
  return manager;
}

function copyBack(pet, manager) {
  const state = manager.tamagotchi;
  for (const key of statNames) pet[key] = bounded(state.stats[key]);
  pet.sleeping = state.isSleeping;
  pet.sick = state.isSick;
  pet.mood = state.mood;
  pet.stage = state.stage;
  pet.discipline = state.stats.discipline;
  pet.evolutionPoints = state.evolutionPoints;
  return pet;
}

export function createPet(now = Date.now()) {
  const manager = new MemoryManager();
  manager.createTamagotchi('Mochi');
  return copyBack({ name: 'Mochi', age: 0, updatedAt: now, healthElapsedMs: 0 }, manager);
}

export function tick(pet, now = Date.now(), speed = 1) {
  const elapsed = Math.max(0, now - pet.updatedAt) * speed;
  if (!elapsed) return pet;
  const hours = elapsed / 3600000;
  // Upstream rates, with fractional time retained across frequent HTTP reads.
  pet.hunger = bounded(pet.hunger - hours * 2);
  pet.happiness = bounded(pet.happiness - hours);
  pet.cleanliness = bounded(pet.cleanliness - hours);
  pet.energy = bounded(pet.energy + hours * (pet.sleeping ? 12 : -1));
  pet.age += elapsed / 1000;
  pet.updatedAt = now;
  const manager = managerFor(pet);
  // Catch up through all evolution stages after a long absence.
  for (let stage = 0; stage < 5; stage++) manager.checkEvolution();
  pet.healthElapsedMs = (pet.healthElapsedMs || 0) + elapsed;
  const healthHours = Math.floor(pet.healthElapsedMs / 3600000);
  for (let hour = 0; hour < Math.min(healthHours, 100); hour++) manager.checkHealth();
  pet.healthElapsedMs -= healthHours * 3600000;
  manager.updateMood();
  return copyBack(pet, manager);
}

export function act(pet, action) {
  if (action === 'wait') return `${pet.name} is enjoying a quiet moment.`;
  const manager = managerFor(pet);
  const methods = {
    feed: () => manager.feed('meal'),
    play: () => manager.play('ball'),
    clean: () => manager.clean(),
    heal: () => manager.feed('medicine'),
    sleep: () => manager.sleep(),
    wake: () => manager.wake(),
  };
  if (!Object.hasOwn(methods, action)) throw new Error(`Unknown care action: ${action}`);
  const result = methods[action]();
  copyBack(pet, manager);
  return result.message;
}
