import { normalizeVector, getDistance, getDirection, getSurfaceDistance } from "../engine/world/collision.js";

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleToVector(angle) {
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export { normalizeVector, getDistance, getDirection, getSurfaceDistance };
