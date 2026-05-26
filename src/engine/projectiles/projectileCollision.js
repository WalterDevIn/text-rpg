import { isCollidingWithWall, getDistance } from "../world/collision.js";
import { hasLineOfSight } from "../world/pathfinding.js";

export function getProjectileCollisionPoint(projectile) {
  return { x: projectile.x, y: projectile.y, radius: projectile.radius ?? 0 };
}

export function projectileHitsWall(projectile) {
  const point = getProjectileCollisionPoint(projectile);
  return isCollidingWithWall(point, point.x, point.y);
}

export function projectileHitsEntity(projectile, entity) {
  if (!projectile || !entity) return false;
  const radius = (projectile.radius ?? 0) + (entity.radius ?? 0);
  return getDistance(projectile, entity) <= radius;
}

export function projectileHasLineOfSight(projectile, target) {
  return hasLineOfSight(projectile, target);
}

export { isCollidingWithWall, hasLineOfSight };
