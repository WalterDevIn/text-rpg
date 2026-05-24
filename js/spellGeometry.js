import {
  BURNING_HANDS_CONE_ANGLE_RADIANS,
  BURNING_HANDS_RANGE_PIXELS,
  TILE_SIZE,
  WALL_OF_FORCE_LENGTH_TILES,
  FORCECAGE_SCROLL_SIZE_TILES,
} from "./constants.js";

import { getDistance, normalizeVector } from "./physics.js";

export function isPointInBurningHandsCone(caster, direction, point) {
  return isPointInCone(caster, direction, point, BURNING_HANDS_RANGE_PIXELS, BURNING_HANDS_CONE_ANGLE_RADIANS);
}

export function isPointInCone(caster, direction, point, rangePixels, coneAngleRadians) {
  const vector = normalizeVector(direction?.x ?? 0, direction?.y ?? 0);

  if (vector.x === 0 && vector.y === 0) {
    return false;
  }

  const distance = getDistance(caster, point);

  if (distance > rangePixels) {
    return false;
  }

  const pointDirection = normalizeVector(point.x - caster.x, point.y - caster.y);

  if (pointDirection.x === 0 && pointDirection.y === 0) {
    return true;
  }

  const dot = vector.x * pointDirection.x + vector.y * pointDirection.y;
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const angle = Math.acos(clampedDot);

  return angle <= coneAngleRadians / 2;
}

export function getWallOfForceTiles(caster, point) {
  const centerCol = Math.floor(point.x / TILE_SIZE);
  const centerRow = Math.floor(point.y / TILE_SIZE);
  const axis = getSnappedWallAxis(caster, point);
  const half = Math.floor(WALL_OF_FORCE_LENGTH_TILES / 2);
  const tiles = [];

  for (let i = -half; i <= half; i++) {
    tiles.push({
      row: centerRow + axis.row * i,
      col: centerCol + axis.col * i,
    });
  }

  return tiles;
}

export function getSnappedWallAxis(caster, point) {
  const direction = normalizeVector(point.x - caster.x, point.y - caster.y);

  if (direction.x === 0 && direction.y === 0) {
    return { row: 0, col: 1 };
  }

  // El muro se orienta perpendicularmente a la línea jugador -> mouse,
  // pero se ajusta a la grilla en una de ocho direcciones.
  const wallAngle = Math.atan2(direction.y, direction.x) + Math.PI / 2;
  const snappedIndex = Math.round(wallAngle / (Math.PI / 4));
  const snappedAngle = snappedIndex * (Math.PI / 4);

  const col = Math.round(Math.cos(snappedAngle));
  const row = Math.round(Math.sin(snappedAngle));

  if (row === 0 && col === 0) {
    return { row: 0, col: 1 };
  }

  return { row, col };
}


export function getForcecageTiles(point) {
  const centerCol = Math.floor(point.x / TILE_SIZE);
  const centerRow = Math.floor(point.y / TILE_SIZE);
  const half = Math.floor(FORCECAGE_SCROLL_SIZE_TILES / 2);
  const tiles = [];

  for (let row = centerRow - half; row <= centerRow + half; row++) {
    for (let col = centerCol - half; col <= centerCol + half; col++) {
      const isBorder = row === centerRow - half || row === centerRow + half || col === centerCol - half || col === centerCol + half;

      if (isBorder) {
        tiles.push({ row, col });
      }
    }
  }

  return tiles;
}
