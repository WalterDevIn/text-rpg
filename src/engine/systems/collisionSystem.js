import { Component } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";
import { getMovementBlockers, getProjectileBlockers, getVisionBlockers } from "../ecs/queries.js";
import {
  canPlaceEntityAt,
  getDistance,
  getDirection,
  getSurfaceDistance,
  isColliding,
  isCollidingWithBlocker,
  isCollidingWithWall,
  moveEntityWithCollision,
  normalizeVector,
} from "../world/collision.js";

function entityAsCollisionObject(entity) {
  const position = entity?.components?.[Component.POSITION];
  const collider = entity?.components?.[Component.COLLIDER];
  if (!position || !collider) return null;
  return {
    id: entity.id,
    x: position.x,
    y: position.y,
    radius: collider.radius ?? 0,
    width: collider.width,
    height: collider.height,
    entity,
  };
}

export function getCollisionObjects(kind = "movement") {
  const query = kind === "projectile" ? getProjectileBlockers : kind === "vision" ? getVisionBlockers : getMovementBlockers;
  return query().map(entityAsCollisionObject).filter(Boolean);
}

export function wouldEntityCollide(entityOrObject, x, y, options = {}) {
  const object = entityOrObject?.components ? entityAsCollisionObject(entityOrObject) : entityOrObject;
  if (!object) return false;
  const blockers = options.blockers ?? getCollisionObjects(options.kind ?? "movement");
  const filtered = blockers.filter((blocker) => blocker.id !== object.id);
  return isColliding(object, x, y, filtered);
}

export function moveEntityWithEcsCollision(entity, nextX, nextY, options = {}) {
  const position = entity?.components?.[Component.POSITION];
  const collider = entity?.components?.[Component.COLLIDER];
  if (!position || !collider) return false;

  const collisionObject = entityAsCollisionObject(entity);
  const blockers = options.blockers ?? getCollisionObjects("movement").filter((blocker) => blocker.id !== entity.id);
  moveEntityWithCollision(collisionObject, nextX, nextY, { blockers });
  position.x = collisionObject.x;
  position.y = collisionObject.y;
  return true;
}

export function updateCollisionSystem() {
  for (const entity of ecsWorld.query([Component.POSITION, Component.COLLIDER])) {
    const collider = entity.components[Component.COLLIDER];
    collider.lastCheckedAt = performance?.now?.() ?? Date.now();
  }
}

export {
  canPlaceEntityAt,
  getDistance,
  getDirection,
  getSurfaceDistance,
  isColliding,
  isCollidingWithBlocker,
  isCollidingWithWall,
  moveEntityWithCollision,
  normalizeVector,
};
