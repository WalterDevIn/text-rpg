import { Component } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";

export function applyDamageToEntity(entityId, amount, metadata = {}) {
  const entity = ecsWorld.get(entityId);
  if (!entity?.components?.[Component.HEALTH]) return false;
  const health = entity.components[Component.HEALTH];
  health.current = Math.max(0, health.current - Math.max(0, amount));
  if (health.current <= 0) {
    ecsWorld.addComponent(entityId, Component.DEAD, { reason: metadata.reason ?? "damage" });
  }
  return true;
}

export function healEntity(entityId, amount) {
  const entity = ecsWorld.get(entityId);
  if (!entity?.components?.[Component.HEALTH]) return false;
  const health = entity.components[Component.HEALTH];
  health.current = Math.min(health.max, health.current + Math.max(0, amount));
  return true;
}

export * from "../rules/dndCombatRules.js";
