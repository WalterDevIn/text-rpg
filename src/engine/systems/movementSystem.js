import { Component } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";
import { getStateObjectsFromEntities } from "../ecs/stateEcsAdapter.js";
import { getMovementBlockers as queryMovementBlockers } from "../ecs/queries.js";
import { moveEntityWithCollision, normalizeVector } from "../world/collision.js";

export function getMovementBlockerStateObjects(options = {}) {
  const excludeIds = new Set(options.excludeEntityIds ?? []);
  const blockers = queryMovementBlockers().filter((entity) => !excludeIds.has(entity.id));
  return getStateObjectsFromEntities(blockers);
}

export function moveEcsEntityWithCollision(entity, nextX, nextY, options = {}) {
  const stateObject = entity.components.sourceRef?.ref;
  if (!stateObject) return false;

  const blockers = options.blockers ?? getMovementBlockerStateObjects({ excludeEntityIds: [entity.id] });
  moveEntityWithCollision(stateObject, nextX, nextY, { blockers });

  entity.components.position = { x: stateObject.x, y: stateObject.y };
  return true;
}

export function updateVelocityMovement(deltaTime) {
  for (const entity of ecsWorld.query([Component.POSITION, Component.VELOCITY])) {
    if (entity.components.playerControlled || entity.components.ai || entity.components.projectile) continue;

    const position = entity.components.position;
    const velocity = entity.components.velocity;
    const nextX = position.x + velocity.x * deltaTime;
    const nextY = position.y + velocity.y * deltaTime;

    if (entity.components.collider?.blocksMovement) {
      moveEcsEntityWithCollision(entity, nextX, nextY);
    } else {
      position.x = nextX;
      position.y = nextY;
    }
  }
}

export { moveEntityWithCollision, normalizeVector };
export * from "../world/collision.js";
