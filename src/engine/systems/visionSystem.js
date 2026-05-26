import { Component } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";
import { isEntityVisibleToPlayer, getVisibleTileKeysForPlayer } from "../world/map.js";

export function updateVisionComponents() {
  const playerEntity = ecsWorld.get("player:player");
  const playerPosition = playerEntity?.components?.[Component.POSITION];

  if (!playerPosition) {
    return;
  }

  const viewer = {
    x: playerPosition.x,
    y: playerPosition.y,
    radius: playerEntity.components?.[Component.COLLIDER]?.radius ?? 0,
  };

  const visibleTileKeys = getVisibleTileKeysForPlayer(viewer);

  for (const entity of ecsWorld.query([Component.POSITION])) {
    const position = entity.components[Component.POSITION];
    const collider = entity.components[Component.COLLIDER];
    const visible = isEntityVisibleToPlayer({
      x: position.x,
      y: position.y,
      radius: collider?.radius ?? 0,
    }, viewer);

    ecsWorld.addComponent(entity.id, Component.VISIBLE, {
      value: visible,
      visibleTileKeys,
      updatedAtFrame: performance?.now?.() ?? Date.now(),
    });
  }
}

export * from "../world/map.js";
