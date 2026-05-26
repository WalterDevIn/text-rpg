import { projectiles } from "./projectileSystem.js";

export function getProjectileRenderData() {
  return projectiles.filter((projectile) => projectile.alive !== false).map((projectile) => ({
    id: projectile.id,
    kind: projectile.kind,
    x: projectile.x,
    y: projectile.y,
    char: projectile.char,
    color: projectile.color,
    drawSize: projectile.drawSize,
    radius: projectile.radius,
    angle: projectile.angle,
  }));
}

export { projectiles };
