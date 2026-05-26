import { spawnArrowShot, spawnArrowShotAtPoint } from "../projectileSystem.js";

export function createArrowProjectile(caster, target, options = {}) {
  return spawnArrowShot(caster, target, options);
}

export function createArrowProjectileAtPoint(caster, targetPoint, options = {}) {
  return spawnArrowShotAtPoint(caster, targetPoint, options);
}

export { spawnArrowShot, spawnArrowShotAtPoint };
