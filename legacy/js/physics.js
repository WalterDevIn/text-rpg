import { TILE_SIZE } from "./constants.js";
import { mapRows, mapCols, isWallAt } from "./map.js";

export function normalizeVector(x, y) {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

export function getDirection(from, to) {
  return normalizeVector(to.x - from.x, to.y - from.y);
}

export function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getSurfaceDistance(a, b) {
  const centerDistance = getDistance(a, b);
  const aRadius = a?.radius ?? 0;
  const bRadius = b?.radius ?? 0;
  return Math.max(0, centerDistance - aRadius - bRadius);
}

export function moveEntityWithCollision(entity, nextX, nextY, options = {}) {
  const blockers = options.blockers ?? [];

  if (!isColliding(entity, nextX, entity.y, blockers)) {
    entity.x = nextX;
  }

  if (!isColliding(entity, entity.x, nextY, blockers)) {
    entity.y = nextY;
  }
}

export function isColliding(entity, x, y, blockers = []) {
  return isCollidingWithWall(entity, x, y) || isCollidingWithBlocker(entity, x, y, blockers);
}

export function isCollidingWithWall(entity, x, y) {
  const pointsToCheck = [
    { x: x - entity.radius, y: y - entity.radius },
    { x: x + entity.radius, y: y - entity.radius },
    { x: x - entity.radius, y: y + entity.radius },
    { x: x + entity.radius, y: y + entity.radius },
  ];

  return pointsToCheck.some((point) => {
    const col = Math.floor(point.x / TILE_SIZE);
    const row = Math.floor(point.y / TILE_SIZE);

    if (row < 0 || row >= mapRows || col < 0 || col >= mapCols) {
      return true;
    }

    return isWallAt(row, col);
  });
}

export function isCollidingWithBlocker(entity, x, y, blockers = []) {
  return blockers.some((blocker) => {
    if (!blocker || blocker === entity) {
      return false;
    }

    const distance = Math.hypot(x - blocker.x, y - blocker.y);
    return distance < entity.radius + blocker.radius;
  });
}

export function canPlaceEntityAt(entity, x, y, options = {}) {
  const blockers = options.blockers ?? [];
  return !isColliding(entity, x, y, blockers);
}
