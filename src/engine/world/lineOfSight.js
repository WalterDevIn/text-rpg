import { hasLineOfSight } from "./pathfinding.js";
import { getVisibleTileKeysForPlayer, isEntityVisibleToPlayer, isTileVisibleToPlayer } from "./map.js";

export function canSeePoint(viewer, target) {
  return hasLineOfSight(viewer, target);
}

export function getVisibleTilesForViewer(viewer) {
  return getVisibleTileKeysForPlayer(viewer);
}

export function canPlayerSeeEntity(entity, viewer) {
  return isEntityVisibleToPlayer(entity, viewer);
}

export { hasLineOfSight, getVisibleTileKeysForPlayer, isEntityVisibleToPlayer, isTileVisibleToPlayer };
