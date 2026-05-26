import {
  getForcecageTiles,
  getWallOfForceTiles,
  isPointInBurningHandsCone,
} from "../../content/spells/spellGeometry.js";
import { getDistance, normalizeVector } from "../world/collision.js";

export function normalizeTargetPoint(origin, point, maxRangePixels = Infinity) {
  if (!origin || !point) return point ?? origin;
  const distance = getDistance(origin, point);
  if (distance <= maxRangePixels) return point;
  const direction = normalizeVector(point.x - origin.x, point.y - origin.y);
  return {
    x: origin.x + direction.x * maxRangePixels,
    y: origin.y + direction.y * maxRangePixels,
  };
}

export function isTargetInsideRange(origin, target, rangePixels) {
  return getDistance(origin, target) <= rangePixels;
}

export function buildConeTarget(origin, direction, rangePixels, angleRadians) {
  return { type: "cone", origin, direction, rangePixels, angleRadians };
}

export function isPointInCircle(center, point, radiusPixels) {
  return getDistance(center, point) <= radiusPixels;
}

export { getForcecageTiles, getWallOfForceTiles, isPointInBurningHandsCone };
