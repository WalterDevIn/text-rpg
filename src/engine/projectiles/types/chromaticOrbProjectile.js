import { spawnChromaticOrbShot } from "../projectileSystem.js";

export function createChromaticOrbProjectile(caster, targetPoint, options = {}) {
  return spawnChromaticOrbShot(caster, targetPoint, options);
}

export { spawnChromaticOrbShot };
