import { gameState } from "./gameState.js";
import { serializeGameState, deserializeGameState } from "./serialization.js";
import { createWorldSnapshot, restoreWorldChunkDeltas } from "../world/world.js";
import { setCurrentDungeonEntranceKey, setCurrentFloor, setDungeonSeed } from "../world/map.js";

export function saveGameState(storage = localStorage, key = "rogue-canvas-save") {
  storage.setItem(key, serializeGameState(gameState, createWorldSnapshot()));
}

export function loadGameState(storage = localStorage, key = "rogue-canvas-save") {
  const raw = storage.getItem(key);
  if (!raw) return null;

  const save = deserializeGameState(raw);

  if (save.gameState) {
    Object.assign(gameState, save.gameState);
  }

  if (save.world?.seed) {
    setDungeonSeed(save.world.seed);
  }

  if (save.world?.dungeonEntranceKey) {
    setCurrentDungeonEntranceKey(save.world.dungeonEntranceKey);
  }

  if (Number.isFinite(Number(save.world?.floor))) {
    setCurrentFloor(Number(save.world.floor));
  }

  if (save.world?.chunkDeltas) {
    restoreWorldChunkDeltas(save.world.chunkDeltas);
  }

  return save;
}
