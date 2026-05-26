import { rollDie, rollDice, rollDiceExpression } from "../engine/rules/dice.js";

const UINT32_MAX_PLUS_ONE = 0x100000000;

export function hashStringToSeed(value = "") {
  const text = String(value);
  let hash = 2166136261;

  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function normalizeSeed(seed = Date.now()) {
  if (typeof seed === "number" && Number.isFinite(seed)) {
    return seed >>> 0;
  }

  return hashStringToSeed(seed);
}

export function createSeededRng(seed = Date.now()) {
  let state = normalizeSeed(seed) || 0x6d2b79f5;

  return function seededRandom() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / UINT32_MAX_PLUS_ONE;
  };
}

export function createCoordinateRng(seed, ...coordinates) {
  return createSeededRng(`${seed}:${coordinates.join(":")}`);
}

export function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function pickRandom(items, rng = Math.random) {
  if (!items?.length) return null;
  return items[randomInt(0, items.length - 1, rng)];
}

export function chance(probability, rng = Math.random) {
  return rng() < probability;
}

export { rollDie, rollDice, rollDiceExpression };
