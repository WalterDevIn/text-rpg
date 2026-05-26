import { normalizeVector, getDirection, getDistance } from "../world/collision.js";

export function integrateProjectile(projectile, deltaTime) {
  if (!projectile) return projectile;
  projectile.previousX = projectile.x;
  projectile.previousY = projectile.y;
  projectile.x += Math.cos(projectile.angle ?? 0) * (projectile.speed ?? 0) * deltaTime;
  projectile.y += Math.sin(projectile.angle ?? 0) * (projectile.speed ?? 0) * deltaTime;
  return projectile;
}

export function steerProjectileTowardPoint(projectile, targetPoint, turnSpeed = projectile?.turnSpeed ?? 0) {
  if (!projectile || !targetPoint) return projectile;
  const desired = Math.atan2(targetPoint.y - projectile.y, targetPoint.x - projectile.x);
  const current = projectile.angle ?? desired;
  let delta = desired - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const clamped = Math.max(-turnSpeed, Math.min(turnSpeed, delta));
  projectile.angle = current + clamped;
  return projectile;
}

export { normalizeVector, getDirection, getDistance };
