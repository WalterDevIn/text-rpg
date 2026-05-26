import { getRooms, getCurrentRegionForEntity } from "./map.js";

export function listRooms() {
  return getRooms();
}

export function getRoomContaining(entityOrPoint) {
  return getCurrentRegionForEntity(entityOrPoint);
}

export function isPointInsideAnyRoom(point) {
  return Boolean(getRoomContaining(point));
}

export { getRooms, getCurrentRegionForEntity };
