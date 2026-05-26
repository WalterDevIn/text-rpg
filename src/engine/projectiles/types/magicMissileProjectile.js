import { spawnMagicMissileVolley } from "../projectileSystem.js";

export function createMagicMissileVolley(caster, target, options = {}) {
  return spawnMagicMissileVolley(caster, target, options);
}

export { spawnMagicMissileVolley };
