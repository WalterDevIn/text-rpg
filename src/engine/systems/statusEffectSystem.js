import { Component } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";

export function addStatusEffect(entityOrId, effect) {
  const entity = typeof entityOrId === "string" ? ecsWorld.get(entityOrId) : entityOrId;
  if (!entity) return false;
  entity.components.statusEffects = entity.components.statusEffects ?? [];
  entity.components.statusEffects.push(effect);
  return true;
}

export function updateStatusEffects(deltaTime) {
  for (const entity of ecsWorld.query([Component.STATUS_EFFECTS])) {
    entity.components.statusEffects = entity.components.statusEffects
      .map((effect) => ({ ...effect, remaining: effect.remaining == null ? null : Math.max(0, effect.remaining - deltaTime) }))
      .filter((effect) => effect.remaining == null || effect.remaining > 0);
  }
}

export { EnemyState } from "../state/gameState.js";
