import { getCurrentRegionForEntity, getRooms } from "./map.js";

export function getRegionForPoint(point) {
  return getCurrentRegionForEntity(point);
}

export function listRegions() {
  return getRooms();
}

export function areInSameRegion(a, b) {
  const regionA = getRegionForPoint(a);
  const regionB = getRegionForPoint(b);
  return Boolean(regionA && regionB && regionA === regionB);
}

export { getCurrentRegionForEntity };
