import { TILE_SIZE } from "../../config/constants.js";
import { createCoordinateRng, normalizeSeed, randomInt } from "../../utils/random.js";

export const DEFAULT_CHUNK_SIZE = 32;
export const DEFAULT_WORLD_SEED = "palacio-infinito";

export const SURFACE_FOREST_TREE_CHAR = "♣";
export const SURFACE_GRASS_CHAR = ".";
export const SURFACE_ENTRANCE_FLOOR_CHAR = ".";
export const SURFACE_ENTRANCE_WALL_CHAR = "#";
export const SURFACE_STAIRS_DOWN_CHAR = ">";
export const SURFACE_TORCH_CHAR = "t";

export function isSurfaceSeed(seed = activeWorldSeed) {
  return String(seed).includes(":layer:surface");
}

let activeWorldSeed = DEFAULT_WORLD_SEED;
const chunkCache = new Map();
const chunkDeltas = new Map();

export function setWorldSeed(seed = DEFAULT_WORLD_SEED) {
  activeWorldSeed = String(seed ?? DEFAULT_WORLD_SEED);
  chunkCache.clear();
  chunkDeltas.clear();
  return activeWorldSeed;
}

export function getWorldSeed() {
  return activeWorldSeed;
}

export function getWorldSeedNumber() {
  return normalizeSeed(activeWorldSeed);
}

export function getChunkKey(chunkX, chunkY) {
  return `${chunkX},${chunkY}`;
}

export function getTileDeltaKey(localCol, localRow) {
  return `${localCol},${localRow}`;
}

export function worldTileToChunk(tileCol, tileRow, chunkSize = DEFAULT_CHUNK_SIZE) {
  return {
    chunkX: Math.floor(tileCol / chunkSize),
    chunkY: Math.floor(tileRow / chunkSize),
    localCol: ((tileCol % chunkSize) + chunkSize) % chunkSize,
    localRow: ((tileRow % chunkSize) + chunkSize) % chunkSize,
  };
}

export function createChunk(chunkX, chunkY, chunkSize = DEFAULT_CHUNK_SIZE, fillTile = ".") {
  return {
    key: getChunkKey(chunkX, chunkY),
    seed: activeWorldSeed,
    chunkX,
    chunkY,
    width: chunkSize,
    height: chunkSize,
    tiles: Array.from({ length: chunkSize }, () => Array.from({ length: chunkSize }, () => fillTile)),
    generated: false,
    loaded: true,
    surfaceTorchTiles: new Set(),
  };
}

export function generateBaseChunk(chunkX, chunkY, options = {}) {
  if (isSurfaceSeed()) {
    return generateSurfaceForestChunk(chunkX, chunkY, options);
  }

  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const floorTile = options.floorTile ?? ".";
  const wallTile = options.wallTile ?? "#";
  const rng = createCoordinateRng(activeWorldSeed, "chunk", chunkX, chunkY);
  const chunk = createChunk(chunkX, chunkY, chunkSize, wallTile);

  // Generación base barata y determinista. Actualmente se usa como soporte de
  // chunk/delta; el dungeon principal puede sobrescribir estos tiles con setTile().
  for (let row = 0; row < chunkSize; row++) {
    for (let col = 0; col < chunkSize; col++) {
      const edge = row === 0 || col === 0 || row === chunkSize - 1 || col === chunkSize - 1;
      const carved = !edge && rng() > 0.68;
      chunk.tiles[row][col] = carved ? floorTile : wallTile;
    }
  }

  // Semillas distintas producen accidentes internos distintos, pero siempre
  // reproducibles para el mismo chunk.
  const pocketCount = randomInt(1, 4, rng);
  for (let i = 0; i < pocketCount; i++) {
    const centerRow = randomInt(3, chunkSize - 4, rng);
    const centerCol = randomInt(3, chunkSize - 4, rng);
    const radius = randomInt(2, 5, rng);

    for (let row = centerRow - radius; row <= centerRow + radius; row++) {
      for (let col = centerCol - radius; col <= centerCol + radius; col++) {
        if (row <= 0 || col <= 0 || row >= chunkSize - 1 || col >= chunkSize - 1) continue;
        const distance = Math.hypot(row - centerRow, col - centerCol);
        if (distance <= radius + rng() * 0.8) {
          chunk.tiles[row][col] = floorTile;
        }
      }
    }
  }

  chunk.generated = true;
  applyChunkDeltas(chunk);
  return chunk;
}

function generateSurfaceForestChunk(chunkX, chunkY, options = {}) {
  const chunkSize = options.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const rng = createCoordinateRng(activeWorldSeed, "surface-forest", chunkX, chunkY);
  const chunk = createChunk(chunkX, chunkY, chunkSize, SURFACE_GRASS_CHAR);

  for (let row = 0; row < chunkSize; row++) {
    for (let col = 0; col < chunkSize; col++) {
      const worldCol = chunkX * chunkSize + col;
      const worldRow = chunkY * chunkSize + row;
      const nearOriginSpawn = Math.abs(worldCol - 45) <= 7 && Math.abs(worldRow - 47) <= 7;
      const softNoise = createCoordinateRng(activeWorldSeed, "tree", worldCol, worldRow)();
      const groveNoise = createCoordinateRng(activeWorldSeed, "grove", Math.floor(worldCol / 5), Math.floor(worldRow / 5))();
      const treeChance = 0.10 + (groveNoise > 0.72 ? 0.18 : 0) + (groveNoise > 0.9 ? 0.14 : 0);
      chunk.tiles[row][col] = !nearOriginSpawn && softNoise < treeChance ? SURFACE_FOREST_TREE_CHAR : SURFACE_GRASS_CHAR;
    }
  }

  if (chunkX === 1 && chunkY === 1) {
    carveSurfaceDungeonEntrance(chunk, rng, { startRow: 8, startCol: 8, width: 11, height: 11 });
  } else if (shouldPlaceDungeonEntranceInChunk(chunkX, chunkY, rng)) {
    carveSurfaceDungeonEntrance(chunk, rng);
  }

  chunk.generated = true;
  applyChunkDeltas(chunk);
  return chunk;
}

function shouldPlaceDungeonEntranceInChunk(chunkX, chunkY, rng) {
  // Garantiza una entrada cerca del spawn y deja que aparezcan más al explorar.
  if (chunkX === 1 && chunkY === 1) return true;

  // No saturar el origen inmediato con múltiples entradas.
  if (Math.abs(chunkX) <= 1 && Math.abs(chunkY) <= 1) return false;

  return rng() < 0.16;
}

function carveSurfaceDungeonEntrance(chunk, rng, options = {}) {
  const width = options.width ?? randomInt(5, 8, rng);
  const height = options.height ?? randomInt(5, 8, rng);
  const startCol = options.startCol ?? randomInt(2, Math.max(2, chunk.width - width - 2), rng);
  const startRow = options.startRow ?? randomInt(2, Math.max(2, chunk.height - height - 2), rng);
  const stairRow = startRow + Math.floor(height / 2);
  const stairCol = startCol + Math.floor(width / 2);
  const doorRow = startRow + height - 1;

  for (let row = startRow; row < startRow + height; row++) {
    for (let col = startCol; col < startCol + width; col++) {
      const boundary = row === startRow || row === startRow + height - 1 || col === startCol || col === startCol + width - 1;
      chunk.tiles[row][col] = boundary ? SURFACE_ENTRANCE_WALL_CHAR : SURFACE_ENTRANCE_FLOOR_CHAR;
      // Estructura abierta: no hay techo. La iluminación de superficie entra
      // como luz tenue global del layer 0.
    }
  }

  chunk.tiles[doorRow][stairCol] = SURFACE_ENTRANCE_FLOOR_CHAR;
  chunk.tiles[stairRow][stairCol] = SURFACE_STAIRS_DOWN_CHAR;

  const torchCandidates = [
    { row: startRow + 2, col: startCol + 2 },
    { row: startRow + 2, col: startCol + width - 3 },
    { row: startRow + height - 3, col: startCol + 2 },
    { row: startRow + height - 3, col: startCol + width - 3 },
  ];

  for (const candidate of torchCandidates) {
    if (candidate.row <= startRow || candidate.row >= startRow + height - 1) continue;
    if (candidate.col <= startCol || candidate.col >= startCol + width - 1) continue;
    if (candidate.row === stairRow && candidate.col === stairCol) continue;
    chunk.tiles[candidate.row][candidate.col] = SURFACE_TORCH_CHAR;
    chunk.surfaceTorchTiles.add(getTileDeltaKey(candidate.col, candidate.row));
  }
}

export function isSurfaceRoofedTile(tileCol, tileRow, chunkSize = DEFAULT_CHUNK_SIZE) {
  // Layer 0 ya no usa techos: incluso dentro de las entradas de mazmorra
  // entra luz solar tenue. Se mantiene la función por compatibilidad.
  return false;
}

export function getOrCreateChunk(chunkX, chunkY, options = {}) {
  const key = getChunkKey(chunkX, chunkY);
  if (!chunkCache.has(key)) {
    chunkCache.set(key, generateBaseChunk(chunkX, chunkY, options));
  }
  return chunkCache.get(key);
}

export function getChunkAtTile(tileCol, tileRow, chunkSize = DEFAULT_CHUNK_SIZE) {
  const location = worldTileToChunk(tileCol, tileRow, chunkSize);
  return getOrCreateChunk(location.chunkX, location.chunkY, { chunkSize });
}

export function getTileFromChunks(tileCol, tileRow, chunkSize = DEFAULT_CHUNK_SIZE) {
  const location = worldTileToChunk(tileCol, tileRow, chunkSize);
  const chunk = getOrCreateChunk(location.chunkX, location.chunkY, { chunkSize });
  return chunk.tiles[location.localRow]?.[location.localCol] ?? null;
}

export function setTileInChunks(tileCol, tileRow, value, chunkSize = DEFAULT_CHUNK_SIZE, options = {}) {
  const location = worldTileToChunk(tileCol, tileRow, chunkSize);
  const chunk = getOrCreateChunk(location.chunkX, location.chunkY, { chunkSize });
  chunk.tiles[location.localRow][location.localCol] = value;
  if (options.recordDelta !== false) {
    recordChunkDelta(location.chunkX, location.chunkY, location.localCol, location.localRow, value);
  }
  return chunk;
}

export function recordChunkDelta(chunkX, chunkY, localCol, localRow, value) {
  const chunkKey = getChunkKey(chunkX, chunkY);
  if (!chunkDeltas.has(chunkKey)) {
    chunkDeltas.set(chunkKey, new Map());
  }

  chunkDeltas.get(chunkKey).set(getTileDeltaKey(localCol, localRow), {
    localCol,
    localRow,
    value,
  });
}

export function applyChunkDeltas(chunk) {
  const deltas = chunkDeltas.get(chunk.key);
  if (!deltas) return chunk;

  for (const delta of deltas.values()) {
    if (delta.localRow >= 0 && delta.localRow < chunk.height && delta.localCol >= 0 && delta.localCol < chunk.width) {
      chunk.tiles[delta.localRow][delta.localCol] = delta.value;
    }
  }

  return chunk;
}

export function getGeneratedSurfaceTorchSources() {
  const sources = [];

  if (!isSurfaceSeed()) {
    return sources;
  }

  for (const chunk of chunkCache.values()) {
    if (!chunk?.surfaceTorchTiles) continue;

    for (const key of chunk.surfaceTorchTiles) {
      const [localColText, localRowText] = key.split(",");
      const localCol = Number(localColText);
      const localRow = Number(localRowText);

      if (!Number.isFinite(localCol) || !Number.isFinite(localRow)) continue;
      if (chunk.tiles?.[localRow]?.[localCol] !== SURFACE_TORCH_CHAR) continue;

      const tileCol = chunk.chunkX * chunk.width + localCol;
      const tileRow = chunk.chunkY * chunk.height + localRow;
      sources.push({
        row: tileRow,
        col: tileCol,
        x: tileCol * TILE_SIZE + TILE_SIZE / 2,
        y: tileRow * TILE_SIZE + TILE_SIZE / 2,
      });
    }
  }

  return sources;
}

export function getChunkDeltasSnapshot() {
  const snapshot = {};
  for (const [chunkKey, deltas] of chunkDeltas.entries()) {
    snapshot[chunkKey] = Array.from(deltas.values()).map((delta) => ({ ...delta }));
  }
  return snapshot;
}

export function loadChunkDeltasSnapshot(snapshot = {}) {
  chunkDeltas.clear();

  for (const [chunkKey, deltas] of Object.entries(snapshot)) {
    const deltaMap = new Map();
    for (const delta of deltas ?? []) {
      deltaMap.set(getTileDeltaKey(delta.localCol, delta.localRow), { ...delta });
    }
    chunkDeltas.set(chunkKey, deltaMap);
  }

  for (const chunk of chunkCache.values()) {
    applyChunkDeltas(chunk);
  }
}

export function getLoadedChunks() {
  return Array.from(chunkCache.values());
}

export function getLoadedChunkKeys() {
  return Array.from(chunkCache.keys());
}

export function getChunksAroundTile(tileCol, tileRow, radiusChunks = 1, chunkSize = DEFAULT_CHUNK_SIZE) {
  const center = worldTileToChunk(tileCol, tileRow, chunkSize);
  const chunks = [];

  for (let y = center.chunkY - radiusChunks; y <= center.chunkY + radiusChunks; y++) {
    for (let x = center.chunkX - radiusChunks; x <= center.chunkX + radiusChunks; x++) {
      chunks.push(getOrCreateChunk(x, y, { chunkSize }));
    }
  }

  return chunks;
}
