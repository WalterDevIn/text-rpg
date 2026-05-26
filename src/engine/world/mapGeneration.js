import { resetDungeonForNewFloor, updateDungeonGeneration, getRooms } from "./map.js";

export function updateMapGeneration(player, deltaTime = 0) {
  return updateDungeonGeneration(player, deltaTime);
}

export function resetGeneratedDungeon() {
  return resetDungeonForNewFloor();
}

export function getGeneratedRooms() {
  return getRooms();
}

export { resetDungeonForNewFloor, updateDungeonGeneration };
