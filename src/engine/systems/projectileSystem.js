import { Component } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";
import { projectiles as stateProjectiles } from "../projectiles/projectileSystem.js";

export function updateProjectileLifetimeEcs(dt) {
  for (const entity of ecsWorld.query([Component.PROJECTILE, Component.LIFETIME])) {
    const lifetime = entity.components[Component.LIFETIME];
    const current = lifetime.remaining ?? lifetime.remainingMs ?? 0;
    lifetime.remaining = Math.max(0, current - dt);
    lifetime.remainingMs = lifetime.remaining * 1000;

    if (lifetime.remaining <= 0) {
      ecsWorld.remove(entity.id);
    }
  }
}

export function getProjectileSourceStateObjects() {
  return stateProjectiles;
}

export * from "../projectiles/projectileSystem.js";
