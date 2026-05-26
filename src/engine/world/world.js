import { TILE_SIZE } from "../../config/constants.js";
import { map, mapCols, mapRows, getCurrentFloor, getCurrentLayerId, getCurrentLayerName, getRooms, getDungeonSeed, getCurrentDungeonEntranceKey, getTileAt as getMapTileAt } from "./map.js";
import {
  DEFAULT_CHUNK_SIZE,
  createChunk,
  getChunkDeltasSnapshot,
  getChunkKey,
  getChunksAroundTile,
  getLoadedChunkKeys,
  getLoadedChunks,
  getTileFromChunks,
  getWorldSeed,
  loadChunkDeltasSnapshot,
  setTileInChunks,
  setWorldSeed,
  worldTileToChunk,
} from "./chunks.js";

export function createWorldSnapshot() {
  return {
    seed: getDungeonSeed(),
    chunkSeed: getWorldSeed(),
    floor: getCurrentFloor(),
    layerId: getCurrentLayerId(),
    layerName: getCurrentLayerName(),
    dungeonEntranceKey: getCurrentDungeonEntranceKey(),
    map,
    rows: mapRows,
    cols: mapCols,
    rooms: getRooms(),
    loadedChunkKeys: getLoadedChunkKeys(),
    chunkDeltas: getChunkDeltasSnapshot(),
  };
}

export function getWorldBounds() {
  return { rows: mapRows, cols: mapCols };
}

export function getTileAt(row, col) {
  return getMapTileAt(row, col);
}

export function getChunkTileAt(row, col) {
  return getTileFromChunks(col, row);
}

export function setChunkTileAt(row, col, value) {
  return setTileInChunks(col, row, value);
}

export function getActiveChunksAroundPoint(point, radiusChunks = 1) {
  const col = Math.floor(point.x / TILE_SIZE);
  const row = Math.floor(point.y / TILE_SIZE);
  return getChunksAroundTile(col, row, radiusChunks);
}

export function restoreWorldChunkDeltas(snapshot = {}) {
  loadChunkDeltasSnapshot(snapshot);
}

export { map, mapCols, mapRows, getCurrentFloor, getCurrentLayerId, getCurrentLayerName, getRooms, getDungeonSeed, getCurrentDungeonEntranceKey } from "./map.js";
export {
  DEFAULT_CHUNK_SIZE,
  createChunk,
  getChunkDeltasSnapshot,
  getChunkKey,
  getChunksAroundTile,
  getLoadedChunkKeys,
  getLoadedChunks,
  getTileFromChunks,
  getWorldSeed,
  loadChunkDeltasSnapshot,
  setTileInChunks,
  setWorldSeed,
  worldTileToChunk,
} from "./chunks.js";
