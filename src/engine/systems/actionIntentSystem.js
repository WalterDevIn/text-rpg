import { Component, makeActionIntent } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";
import { getEntitiesWithActionIntent } from "../ecs/queries.js";

export function setActionIntent(entityOrId, type, payload = {}) {
  const entity = typeof entityOrId === "string" ? ecsWorld.get(entityOrId) : entityOrId;
  if (!entity) return false;
  entity.components[Component.ACTION_INTENT] = makeActionIntent(type, payload);
  return true;
}

export function consumeActionIntents(handler) {
  for (const entity of getEntitiesWithActionIntent()) {
    const intent = entity.components.actionIntent;
    handler(entity, intent);
    intent.consumed = true;
  }
}

export function clearConsumedActionIntents() {
  for (const entity of ecsWorld.query([Component.ACTION_INTENT])) {
    if (entity.components.actionIntent?.consumed) {
      ecsWorld.removeComponent(entity.id, Component.ACTION_INTENT);
    }
  }
}

export function consumeActionIntentsOfType(type) {
  const consumed = [];

  for (const entity of getEntitiesWithActionIntent()) {
    const intent = entity.components.actionIntent;
    if (intent?.type !== type || intent.consumed) continue;
    consumed.push({ entity, intent });
    intent.consumed = true;
  }

  return consumed;
}
