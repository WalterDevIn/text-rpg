import {
  LARGE_ROOM_STRUCTURE_MAX_LENGTH,
  LARGE_ROOM_STRUCTURE_MAX_SEGMENTS,
  LARGE_ROOM_STRUCTURE_MIN_FLOOR_TILES,
  LARGE_ROOM_STRUCTURE_MIN_LENGTH,
  MERCHANT_ROOM_CHANCE,
  ROOM_TORCH_CHANCE,
  ROOM_TORCH_MAX_COUNT,
  TILE_SIZE,
  TORCH_LIGHT_RADIUS_PIXELS,
} from "../../config/constants.js";
import { createSeededRng } from "../../utils/random.js";
import { getTileFromChunks, setTileInChunks, setWorldSeed as setChunkWorldSeed, SURFACE_FOREST_TREE_CHAR } from "./chunks.js";

export const DUNGEON_DOOR_CHAR = "+";
export const DUNGEON_FLOOR_CHAR = ".";
export const DUNGEON_WALL_CHAR = "#";
export const DUNGEON_STAIRS_CHAR = ">";
export const DUNGEON_STAIRS_UP_CHAR = "<";
export const SURFACE_TREE_CHAR = SURFACE_FOREST_TREE_CHAR;

export const mapRows = 90;
export const mapCols = 90;

export const map = Array.from({ length: mapRows }, () => {
  return Array.from({ length: mapCols }, () => DUNGEON_WALL_CHAR);
});

const temporaryWalls = [];
const torches = [];
const rooms = [];
const doors = [];
const visibleRegions = [];
const tileRegions = new Map();

let nextRoomId = 1;
let nextRegionId = 1;
let nextTorchId = 1;
export const SURFACE_LAYER = 0;
export const FIRST_DUNGEON_FLOOR = 1;
export const MAX_DUNGEON_FLOOR = 3;

let currentFloor = SURFACE_LAYER;
let dungeonSeed = "palacio-infinito";
let currentDungeonEntranceKey = "45,45";
let dungeonRng = createSeededRng(getCurrentLayerSeed());
let lastDoorTileKey = null;
let lastStairTileKey = null;
let floorGeneratedFeatureCount = 0;
let floorHasMerchantRoom = false;
let floorHasStairs = false;

const Direction = {
  NORTH: "north",
  SOUTH: "south",
  EAST: "east",
  WEST: "west",
};

const directionVectors = {
  [Direction.NORTH]: { row: -1, col: 0 },
  [Direction.SOUTH]: { row: 1, col: 0 },
  [Direction.EAST]: { row: 0, col: 1 },
  [Direction.WEST]: { row: 0, col: -1 },
};

const oppositeDirections = {
  [Direction.NORTH]: Direction.SOUTH,
  [Direction.SOUTH]: Direction.NORTH,
  [Direction.EAST]: Direction.WEST,
  [Direction.WEST]: Direction.EAST,
};

const startingRoom = {
  row: 43,
  col: 43,
  width: 5,
  height: 5,
  name: "Habitación inicial",
};

const surfaceEntranceRoom = {
  row: 40,
  col: 40,
  width: 11,
  height: 11,
  name: "Entrada de la mazmorra",
};

initializeStartingArea();

export function getPlayerSpawnPoint() {
  if (isSurfaceLayer()) {
    const [row, col] = parseDungeonEntranceKey(currentDungeonEntranceKey);
    return tileCenter(row + 1, col);
  }

  return tileCenter(45, 45);
}

export function isWallAt(row, col) {
  if (!isSurfaceLayer() && !isInsideMap(row, col)) {
    return true;
  }

  const tile = getTileAt(row, col);
  return tile === DUNGEON_WALL_CHAR || tile === SURFACE_TREE_CHAR || isTemporaryWallAt(row, col);
}

export function isStaticWallAt(row, col) {
  if (!isSurfaceLayer() && !isInsideMap(row, col)) {
    return true;
  }

  const tile = getTileAt(row, col);
  return tile === DUNGEON_WALL_CHAR || tile === SURFACE_TREE_CHAR;
}

export function isDoorAt(row, col) {
  if (!isInsideMap(row, col)) {
    return false;
  }

  return getTileAt(row, col) === DUNGEON_DOOR_CHAR;
}

export function isStairsAt(row, col) {
  return isDownStairsAt(row, col) || isUpStairsAt(row, col);
}

export function isDownStairsAt(row, col) {
  if (!isSurfaceLayer() && !isInsideMap(row, col)) {
    return false;
  }

  return getTileAt(row, col) === DUNGEON_STAIRS_CHAR;
}

export function isUpStairsAt(row, col) {
  if (!isSurfaceLayer() && !isInsideMap(row, col)) {
    return false;
  }

  return getTileAt(row, col) === DUNGEON_STAIRS_UP_CHAR;
}

export function getCurrentFloor() {
  return currentFloor;
}

export function isSurfaceLayer() {
  return currentFloor === SURFACE_LAYER;
}

export function getCurrentLayerId() {
  return isSurfaceLayer() ? "surface" : `dungeon:${currentFloor}`;
}

export function getCurrentLayerName() {
  return isSurfaceLayer() ? "Superficie" : `Mazmorra ${currentFloor}`;
}

export function getCurrentLayerSeed() {
  if (isSurfaceLayer()) {
    return `${dungeonSeed}:layer:surface`;
  }

  return `${dungeonSeed}:entrance:${currentDungeonEntranceKey}:layer:${getCurrentLayerId()}`;
}

export function setDungeonSeed(seed = "palacio-infinito") {
  dungeonSeed = String(seed ?? "palacio-infinito");
  reseedForCurrentFloor();
  hydrateChunksFromCurrentMap();
  return dungeonSeed;
}

export function getDungeonSeed() {
  return dungeonSeed;
}

export function getCurrentDungeonEntranceKey() {
  return currentDungeonEntranceKey;
}

export function setCurrentDungeonEntranceKey(key = "45,45") {
  const [row, col] = parseDungeonEntranceKey(key);
  currentDungeonEntranceKey = `${row},${col}`;
  reseedForCurrentFloor();
  return currentDungeonEntranceKey;
}

export function getTileAt(row, col) {
  if (isSurfaceLayer()) {
    return getTileFromChunks(col, row) ?? DUNGEON_FLOOR_CHAR;
  }

  if (!isInsideMap(row, col)) {
    return DUNGEON_WALL_CHAR;
  }

  return map[row]?.[col] ?? DUNGEON_WALL_CHAR;
}

export function setCurrentFloor(floor = SURFACE_LAYER) {
  currentFloor = Number.isFinite(Number(floor)) ? Number(floor) : SURFACE_LAYER;
  resetDungeonForNewFloor();
  return currentFloor;
}

function reseedForCurrentFloor() {
  setChunkWorldSeed(getCurrentLayerSeed());
  dungeonRng = createSeededRng(getCurrentLayerSeed());
}

export function isTileInMerchantSafeZone(row, col) {
  return rooms.some((room) => {
    return Boolean(room.merchantRoom) &&
      row >= room.row &&
      row < room.row + room.height &&
      col >= room.col &&
      col < room.col + room.width;
  });
}

export function isPointInMerchantSafeZone(point) {
  if (!point) {
    return false;
  }

  const row = Math.floor(point.y / TILE_SIZE);
  const col = Math.floor(point.x / TILE_SIZE);
  return isTileInMerchantSafeZone(row, col);
}

export function hasWallNearPoint(point, radiusTiles = 1) {
  if (!point) {
    return true;
  }

  const centerRow = Math.floor(point.y / TILE_SIZE);
  const centerCol = Math.floor(point.x / TILE_SIZE);

  for (let row = centerRow - radiusTiles; row <= centerRow + radiusTiles; row++) {
    for (let col = centerCol - radiusTiles; col <= centerCol + radiusTiles; col++) {
      if (isWallAt(row, col)) {
        return true;
      }
    }
  }

  return false;
}

export function getSafeZoneRooms() {
  return rooms.filter((room) => room.merchantRoom).map((room) => ({ ...room }));
}

export function getTorches() {
  return torches.slice();
}

export function getTorchAt(row, col) {
  return torches.find((torch) => torch.row === row && torch.col === col) ?? null;
}

export function hasTorchAt(row, col) {
  return Boolean(getTorchAt(row, col));
}

export function addTorch(row, col, options = {}) {
  if (!isInsideMap(row, col) || isWallAt(row, col) || hasTorchAt(row, col)) {
    return null;
  }

  const torch = {
    id: nextTorchId++,
    row,
    col,
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
    radius: TILE_SIZE * 0.22,
    drawSize: TILE_SIZE * 0.7,
    char: "t",
    color: "#ffaa33",
    lightRadius: options.lightRadius ?? TORCH_LIGHT_RADIUS_PIXELS,
    placedByPlayer: Boolean(options.placedByPlayer),
  };

  torches.push(torch);
  return torch;
}

export function removeTorch(torchOrId) {
  const id = typeof torchOrId === "object" ? torchOrId.id : torchOrId;
  const index = torches.findIndex((torch) => torch.id === id);

  if (index < 0) {
    return null;
  }

  return torches.splice(index, 1)[0];
}

export function isTemporaryWallAt(row, col) {
  return temporaryWalls.some((wall) => wall.row === row && wall.col === col && wall.remaining > 0);
}

export function addTemporaryWall(row, col, duration) {
  if (!isInsideMap(row, col)) {
    return false;
  }

  if (isStaticWallAt(row, col)) {
    return false;
  }

  const existingWall = temporaryWalls.find((wall) => wall.row === row && wall.col === col);

  if (existingWall) {
    existingWall.remaining = Math.max(existingWall.remaining, duration);
    return true;
  }

  temporaryWalls.push({ row, col, remaining: duration });
  return true;
}

export function getTemporaryWalls() {
  return temporaryWalls.filter((wall) => wall.remaining > 0);
}

export function clearTemporaryWalls() {
  temporaryWalls.length = 0;
}

export function updateTemporaryWalls(deltaTime) {
  for (const wall of temporaryWalls) {
    wall.remaining = Math.max(0, wall.remaining - deltaTime);
  }

  for (let i = temporaryWalls.length - 1; i >= 0; i--) {
    if (temporaryWalls[i].remaining <= 0) {
      temporaryWalls.splice(i, 1);
    }
  }
}

export function updateDungeonGeneration(player) {
  const row = Math.floor(player.y / TILE_SIZE);
  const col = Math.floor(player.x / TILE_SIZE);
  const key = `${row},${col}`;

  if (isStairsAt(row, col)) {
    if (lastStairTileKey === key) {
      return null;
    }

    lastStairTileKey = key;

    if (isUpStairsAt(row, col)) {
      return ascendToPreviousFloor();
    }

    return descendToNextFloor(row, col);
  }

  lastStairTileKey = null;

  // La mazmorra ya no se genera al cruzar puertas. Desde layer 1 se genera el
  // piso completo de una sola vez para evitar estructuras rotas o salas
  // inconexas. Las puertas quedan como tiles de tránsito/visión, no como
  // disparadores de generación.
  lastDoorTileKey = isDoorAt(row, col) ? key : null;
  return null;
}

function descendToNextFloor(entranceRow = 45, entranceCol = 45) {
  if (!isSurfaceLayer() && currentFloor >= MAX_DUNGEON_FLOOR) {
    return {
      floorChanged: false,
      message: "La mazmorra termina aquí; no hay más escaleras descendentes.",
    };
  }

  if (isSurfaceLayer()) {
    currentDungeonEntranceKey = `${Math.floor(entranceRow)},${Math.floor(entranceCol)}`;
  }

  currentFloor += 1;
  reseedForCurrentFloor();
  resetDungeonForNewFloor();

  const spawn = getPlayerSpawnPoint();
  const message = currentFloor === FIRST_DUNGEON_FLOOR
    ? "Bajas por la escalera de la entrada a la primera planta de la mazmorra."
    : `Bajas por las escaleras al piso ${currentFloor}. La mazmorra vuelve a cerrarse alrededor de una cámara inicial.`;

  return {
    floorChanged: true,
    floorDirection: "down",
    spawnPoint: spawn,
    room: getRooms()[0] ?? null,
    difficulty: "none",
    message,
  };
}

function ascendToPreviousFloor() {
  if (currentFloor <= SURFACE_LAYER) {
    return {
      floorChanged: false,
      message: "Ya estás en la superficie.",
    };
  }

  currentFloor -= 1;
  reseedForCurrentFloor();
  resetDungeonForNewFloor();

  const spawn = getPlayerSpawnPoint();
  const message = isSurfaceLayer()
    ? "Subes por la escalera y vuelves a la pequeña entrada de la superficie."
    : `Subes al piso ${currentFloor}. El grupo reaparece en una cámara segura de transición.`;

  return {
    floorChanged: true,
    floorDirection: "up",
    spawnPoint: spawn,
    room: getRooms()[0] ?? null,
    difficulty: "none",
    message,
  };
}

export function resetDungeonForNewFloor() {
  reseedForCurrentFloor();
  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      map[row][col] = DUNGEON_WALL_CHAR;
    }
  }

  temporaryWalls.length = 0;
  torches.length = 0;
  rooms.length = 0;
  doors.length = 0;
  visibleRegions.length = 0;
  tileRegions.clear();
  nextRoomId = 1;
  nextRegionId = 1;
  nextTorchId = 1;
  lastDoorTileKey = null;
  lastStairTileKey = null;
  floorGeneratedFeatureCount = 0;
  floorHasMerchantRoom = false;
  floorHasStairs = false;
  initializeStartingArea();
}

export function getRooms() {
  return rooms.slice();
}

const VISION_RADIUS_TILES = 32;
const VISION_RAY_COUNT = 384;
let visibleTileCache = { key: null, visible: null };

export function invalidateVisibleTileCache() {
  visibleTileCache = { key: null, visible: null };
}

export function getVisibleTileKeysForPlayer(viewer) {
  const viewerRow = Math.floor(viewer.y / TILE_SIZE);
  const viewerCol = Math.floor(viewer.x / TILE_SIZE);
  const cacheKey = `${getCurrentLayerId?.() ?? "layer"}|${viewerRow},${viewerCol}|${isSurfaceLayer() ? "surface" : "dungeon"}`;

  if (visibleTileCache.key === cacheKey && visibleTileCache.visible) {
    return visibleTileCache.visible;
  }

  const region = getCurrentRegionForEntity(viewer);
  const visible = region ? new Set(region.tiles) : new Set();

  addLineOfSightPeekTiles(viewer, visible);

  if (visible.size === 0) {
    for (let r = viewerRow - 1; r <= viewerRow + 1; r++) {
      for (let c = viewerCol - 1; c <= viewerCol + 1; c++) {
        if (isSurfaceLayer() || isInsideMap(r, c)) {
          visible.add(tileKey(r, c));
        }
      }
    }
  }

  visibleTileCache = { key: cacheKey, visible };
  return visible;
}

function addLineOfSightPeekTiles(viewer, visible) {
  const seenFloors = raycastVisibleFloorTiles(viewer, VISION_RADIUS_TILES, VISION_RAY_COUNT);

  for (const tile of seenFloors) {
    visible.add(tileKey(tile.row, tile.col));
  }

  for (const tile of seenFloors) {
    addAdjacentBoundaryWalls(tile.row, tile.col, visible);
  }
}

function raycastVisibleFloorTiles(viewer, radiusTiles, rayCount) {
  const result = new Map();
  const viewerRow = Math.floor(viewer.y / TILE_SIZE);
  const viewerCol = Math.floor(viewer.x / TILE_SIZE);

  if (isSurfaceLayer() || isInsideMap(viewerRow, viewerCol)) {
    result.set(tileKey(viewerRow, viewerCol), { row: viewerRow, col: viewerCol });
  }

  const maxDistance = radiusTiles * TILE_SIZE;
  const stepDistance = TILE_SIZE * 0.72;

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let lastKey = null;

    for (let distance = stepDistance; distance <= maxDistance; distance += stepDistance) {
      const x = viewer.x + dx * distance;
      const y = viewer.y + dy * distance;
      const row = Math.floor(y / TILE_SIZE);
      const col = Math.floor(x / TILE_SIZE);

      if (!isSurfaceLayer() && !isInsideMap(row, col)) {
        break;
      }

      const key = tileKey(row, col);
      if (key === lastKey) {
        continue;
      }
      lastKey = key;

      if (isWallAt(row, col)) {
        result.set(key, { row, col });
        break;
      }

      result.set(key, { row, col });
    }
  }

  return result.values();
}

function addAdjacentBoundaryWalls(row, col, visible) {
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (!isSurfaceLayer() && !isInsideMap(r, c)) {
        continue;
      }

      if (isWallAt(r, c)) {
        visible.add(tileKey(r, c));
      }
    }
  }
}

function hasMapLineOfSight(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / (TILE_SIZE / 4)));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const row = Math.floor(y / TILE_SIZE);
    const col = Math.floor(x / TILE_SIZE);

    if (isWallAt(row, col)) {
      return false;
    }
  }

  return true;
}

export function isTileVisibleToPlayer(row, col, viewer) {
  return getVisibleTileKeysForPlayer(viewer).has(tileKey(row, col));
}

export function isEntityVisibleToPlayer(entity, viewer) {
  const row = Math.floor(entity.y / TILE_SIZE);
  const col = Math.floor(entity.x / TILE_SIZE);
  return isTileVisibleToPlayer(row, col, viewer);
}

export function getCurrentRegionForEntity(entity) {
  const row = Math.floor(entity.y / TILE_SIZE);
  const col = Math.floor(entity.x / TILE_SIZE);
  const ids = tileRegions.get(tileKey(row, col));

  if (!ids || ids.size === 0) {
    return null;
  }

  const newestRegionId = Math.max(...ids);
  return visibleRegions.find((region) => region.id === newestRegionId) ?? null;
}

function initializeStartingArea() {
  if (isSurfaceLayer()) {
    initializeSurfaceEntrance();
    return;
  }

  generateCompleteDungeonFloor();
}


function generateCompleteDungeonFloor() {
  const targetRoomCount = getDungeonRoomTargetCount();
  const startRoom = {
    ...startingRoom,
    id: nextRoomId++,
    width: 7,
    height: 7,
    row: 42,
    col: 42,
    name: `Entrada del piso ${currentFloor}`,
    generatedFromTable: false,
    spawnRoom: true,
    difficulty: "none",
  };

  carveRoom(startRoom);
  setTile(startRoom.row + Math.floor(startRoom.height / 2), startRoom.col + Math.floor(startRoom.width / 2) - 1, DUNGEON_STAIRS_UP_CHAR);
  addTileToAllRegionsAt(startRoom.row + Math.floor(startRoom.height / 2), startRoom.col + Math.floor(startRoom.width / 2) - 1);

  const placedRooms = [startRoom];
  let attempts = 0;

  while (placedRooms.length < targetRoomCount && attempts < targetRoomCount * 80) {
    attempts++;
    const room = createRandomWholeFloorRoom();

    if (!room || !canPlaceWholeFloorRoom(room, placedRooms)) {
      continue;
    }

    carveRoom(room);
    placedRooms.push(room);
  }

  // Fallback: si la tirada generó demasiadas colisiones, garantiza una planta
  // jugable con salas medianas, no con nichos diminutos.
  while (placedRooms.length < Math.min(7, targetRoomCount)) {
    const fallback = createFallbackWholeFloorRoom(placedRooms.length);

    if (!fallback || !canPlaceWholeFloorRoom(fallback, placedRooms, 1)) {
      break;
    }

    carveRoom(fallback);
    placedRooms.push(fallback);
  }

  connectWholeFloorRooms(placedRooms);
  assignWholeFloorSpecialRooms(placedRooms);
  placeWholeFloorStairs(placedRooms);
  addWholeFloorMetadata();
}

function getDungeonRoomTargetCount() {
  // Inspirado en la tabla de tamaño de mazmorra del Toolbox: no genera nichos
  // mínimos; cada piso tiene un número suficiente de salas para explorar.
  if (currentFloor === 1) return randomInt(8, 11);
  if (currentFloor === 2) return randomInt(10, 13);
  return randomInt(12, 15);
}

function createRandomWholeFloorRoom() {
  const spec = rollRoomSpec(rollDie(20));
  const width = clamp(spec.floorWidth + 2, 7, 16);
  const height = clamp(spec.floorHeight + 2, 7, 13);
  const row = randomInt(3, mapRows - height - 4);
  const col = randomInt(3, mapCols - width - 4);

  return {
    id: nextRoomId++,
    name: `Sala ${nextRoomId - 1}`,
    row,
    col,
    width,
    height,
    generatedFromTable: true,
    roomShapeLabel: spec.label,
    difficulty: "none",
  };
}

function createFallbackWholeFloorRoom(index) {
  const anchors = [
    { row: 8, col: 8 },
    { row: 8, col: 66 },
    { row: 66, col: 8 },
    { row: 66, col: 66 },
    { row: 18, col: 42 },
    { row: 62, col: 42 },
  ];
  const anchor = anchors[index % anchors.length];

  return {
    id: nextRoomId++,
    name: `Sala ${nextRoomId - 1}`,
    row: anchor.row,
    col: anchor.col,
    width: 10,
    height: 8,
    generatedFromTable: true,
    roomShapeLabel: "sala mediana de respaldo",
    difficulty: "none",
  };
}

function canPlaceWholeFloorRoom(room, placedRooms, padding = 2) {
  if (room.row < 2 || room.col < 2 || room.row + room.height >= mapRows - 2 || room.col + room.width >= mapCols - 2) {
    return false;
  }

  return placedRooms.every((other) => !roomsOverlapWithPadding(room, other, padding));
}

function roomsOverlapWithPadding(a, b, padding = 2) {
  return !(
    a.col + a.width + padding <= b.col ||
    b.col + b.width + padding <= a.col ||
    a.row + a.height + padding <= b.row ||
    b.row + b.height + padding <= a.row
  );
}

function connectWholeFloorRooms(placedRooms) {
  const connected = [placedRooms[0]];
  const remaining = placedRooms.slice(1);

  while (remaining.length > 0) {
    let best = null;

    for (const room of remaining) {
      for (const candidate of connected) {
        const score = getRoomCenterDistance(room, candidate);

        if (!best || score < best.score) {
          best = { room, candidate, score };
        }
      }
    }

    if (!best) break;

    carveCorridorBetweenRooms(best.candidate, best.room);
    connected.push(best.room);
    remaining.splice(remaining.indexOf(best.room), 1);
  }
}

function getRoomCenterDistance(a, b) {
  const ac = getRoomCenterTile(a);
  const bc = getRoomCenterTile(b);
  return Math.abs(ac.row - bc.row) + Math.abs(ac.col - bc.col);
}

function getRoomCenterTile(room) {
  return {
    row: room.row + Math.floor(room.height / 2),
    col: room.col + Math.floor(room.width / 2),
  };
}

function carveCorridorBetweenRooms(a, b) {
  const start = getRoomCenterTile(a);
  const end = getRoomCenterTile(b);
  const horizontalFirst = randomFloat() < 0.5;
  const region = createVisibleRegion("passage", `Pasaje ${nextRegionId - 1}`);
  const path = [];

  if (horizontalFirst) {
    addHorizontalPath(path, start.row, start.col, end.col);
    addVerticalPath(path, start.row, end.row, end.col);
  } else {
    addVerticalPath(path, start.row, end.row, start.col);
    addHorizontalPath(path, end.row, start.col, end.col);
  }

  for (const tile of path) {
    carveCorridorTile(tile.row, tile.col, region);
  }

  addTorchesForCorridor(path);
}

function addHorizontalPath(path, row, fromCol, toCol) {
  const step = fromCol <= toCol ? 1 : -1;
  for (let col = fromCol; col !== toCol + step; col += step) {
    path.push({ row, col });
  }
}

function addVerticalPath(path, fromRow, toRow, col) {
  const step = fromRow <= toRow ? 1 : -1;
  for (let row = fromRow; row !== toRow + step; row += step) {
    path.push({ row, col });
  }
}

function carveCorridorTile(row, col, region) {
  if (!isInsideMap(row, col)) return;

  const boundaryRoom = rooms.find((room) => isRoomBoundaryTile(room, row, col));
  const tile = boundaryRoom ? DUNGEON_DOOR_CHAR : DUNGEON_FLOOR_CHAR;

  setTile(row, col, tile);
  addTileToRegion(region, row, col);

  if (boundaryRoom) {
    doors.push({ row, col, direction: null, sourceRoomId: boundaryRoom.id, generated: true });
    addTileToAllRegionsAt(row, col);
  }

  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (!isInsideMap(r, c)) continue;
      if (map[r][c] === DUNGEON_WALL_CHAR) {
        addTileToRegion(region, r, c);
      }
    }
  }
}

function isRoomBoundaryTile(room, row, col) {
  const inside = row >= room.row && row < room.row + room.height && col >= room.col && col < room.col + room.width;
  if (!inside) return false;
  return row === room.row || row === room.row + room.height - 1 || col === room.col || col === room.col + room.width - 1;
}

function addTorchesForCorridor(path) {
  for (let i = 6; i < path.length; i += randomInt(8, 12)) {
    const tile = path[i];
    if (tile && map[tile.row]?.[tile.col] === DUNGEON_FLOOR_CHAR) {
      addTorch(tile.row, tile.col, { lightRadius: TORCH_LIGHT_RADIUS_PIXELS * 0.85 });
    }
  }
}

function assignWholeFloorSpecialRooms(placedRooms) {
  const candidates = placedRooms.filter((room) => room.generatedFromTable && !room.spawnRoom);
  const bossRoom = candidates
    .slice()
    .sort((a, b) => getRoomCenterDistance(b, placedRooms[0]) - getRoomCenterDistance(a, placedRooms[0]))[0] ?? candidates[0];

  if (bossRoom) {
    bossRoom.bossRoom = true;
    bossRoom.difficulty = "boss";
    bossRoom.name = `Sala del jefe ${currentFloor}`;
  }

  const merchantRoom = candidates.find((room) => room !== bossRoom && getRoomFloorTileCount(room) >= 9) ?? candidates.find((room) => room !== bossRoom);

  if (merchantRoom) {
    merchantRoom.merchantRoom = true;
    merchantRoom.difficulty = "merchant";
    merchantRoom.name = `Cámara de vendedora ${currentFloor}`;
    floorHasMerchantRoom = true;
  }

  for (const room of candidates) {
    if (room.bossRoom || room.merchantRoom) continue;
    const contents = rollRoomContents(rollPercent());
    room.difficulty = contents.difficulty;
    room.contentLabel = contents.label;
  }
}

function placeWholeFloorStairs(placedRooms) {
  const start = placedRooms[0];
  const startCenter = getRoomCenterTile(start);
  setTile(startCenter.row, startCenter.col - 1, DUNGEON_STAIRS_UP_CHAR);
  addTileToAllRegionsAt(startCenter.row, startCenter.col - 1);

  if (currentFloor >= MAX_DUNGEON_FLOOR) {
    floorHasStairs = false;
    return;
  }

  const candidates = placedRooms.filter((room) => room.generatedFromTable && !room.merchantRoom);
  const stairsRoom = candidates
    .slice()
    .sort((a, b) => getRoomCenterDistance(b, start) - getRoomCenterDistance(a, start))[0];

  if (!stairsRoom) return;

  const center = getRoomCenterTile(stairsRoom);
  const stairCol = Math.min(stairsRoom.col + stairsRoom.width - 2, center.col + 1);
  setTile(center.row, stairCol, DUNGEON_STAIRS_CHAR);
  addTileToAllRegionsAt(center.row, stairCol);
  stairsRoom.hasDownStairs = true;
  floorHasStairs = true;
}

function addWholeFloorMetadata() {
  floorGeneratedFeatureCount = rooms.filter((room) => room.generatedFromTable).length;

  // Cada sala tiene paredes, contenido y antorchas potenciales desde el inicio;
  // no se agregan features al cruzar puertas.
  for (const room of rooms) {
    if (room.generatedFromTable) {
      addLargeRoomStructures(room);
    }
  }
}

function getRoomFloorTileCount(room) {
  return Math.max(0, room.width - 2) * Math.max(0, room.height - 2);
}

function initializeSurfaceEntrance() {
  // La superficie real se genera por chunks. Esta región inicial sólo garantiza
  // visibilidad local alrededor del spawn/entrada conocida.
  const room = {
    ...surfaceEntranceRoom,
    id: nextRoomId++,
    generatedFromTable: false,
    surfaceEntrance: true,
  };

  rooms.push(room);
  const region = createVisibleRegion("surface", room.name);

  for (let row = room.row; row < room.row + room.height; row++) {
    for (let col = room.col; col < room.col + room.width; col++) {
      addTileToRegion(region, row, col);
    }
  }

  const entryRow = room.row + Math.floor(room.height / 2);
  const entryCol = room.col + Math.floor(room.width / 2);
  const doorRow = room.row + room.height - 1;

  addTileToRegion(region, entryRow, entryCol);
  addTileToRegion(region, doorRow, entryCol);

  addSurfaceEntranceTorches(room);
}

function addSurfaceEntranceTorches(room) {
  const candidates = [
    { row: room.row + 2, col: room.col + 2 },
    { row: room.row + 2, col: room.col + room.width - 3 },
    { row: room.row + room.height - 3, col: room.col + 2 },
    { row: room.row + room.height - 3, col: room.col + room.width - 3 },
  ];

  for (const candidate of candidates) {
    addTorch(candidate.row, candidate.col, { lightRadius: TORCH_LIGHT_RADIUS_PIXELS * 0.75 });
  }
}

function generateBeyondDoor(door) {
  // Reglas duras por piso: primero debe existir una NPC mercader,
  // luego al menos una sala normal para que pueda aparecer el jefe raro,
  // y recién después se permite generar escaleras.
  if (!floorHasMerchantRoom) {
    return generateRoomFromDoor(door, "Generación obligatoria: cámara de NPC.", { forceMerchant: true });
  }

  if (floorGeneratedFeatureCount < 2) {
    return generateRoomFromDoor(door, "Generación obligatoria: cámara de amenaza/jefe.", { forceNonMerchant: true });
  }

  if (!floorHasStairs) {
    return generateStairsFromDoor(door, "Generación obligatoria: escaleras del piso.");
  }

  const doorRoll = rollPercent();
  const destination = rollDoorDestination(doorRoll);
  const prefix = `Puerta d100=${doorRoll}: ${destination.label}.`;

  if (destination.kind === "passage") {
    return generatePassageThenFeature(door, prefix);
  }

  if (destination.kind === "stairs") {
    const stairsRoll = rollDie(20);
    return generateStairsFromDoor(door, `${prefix} Escaleras d20=${stairsRoll}: acceso vertical a otro piso.`);
  }

  return generateRoomFromDoor(door, prefix);
}
function generatePassageThenFeature(door, prefix) {
  const passageRoll = rollDie(20);
  const passage = rollPassageResult(passageRoll);
  const vector = directionVectors[door.direction];
  const lengthTiles = passage.lengthTiles;

  if (!canCarvePassageFromDoor(door, lengthTiles)) {
    return generateRoomFromDoor(door, `${prefix} Pasaje d20=${passageRoll}: ${passage.label}; el pasaje fue descartado porque pisaba una zona existente.`)
      ?? createEmergencyAlcoveBeyondDoor(door, `${prefix} Pasaje d20=${passageRoll}: ${passage.label}; se evitó pisar otra sala y se excavó un nicho.`);
  }

  const passageRegion = carvePassageFromDoor(door, lengthTiles);
  const endRow = door.row + vector.row * lengthTiles;
  const endCol = door.col + vector.col * lengthTiles;

  if (passage.deadEnd) {
    const alcove = createEmergencyAlcoveBeyondDoor({ ...door, row: endRow, col: endCol }, `${prefix} Pasaje d20=${passageRoll}: ${passage.label}; termina en una pequeña cámara, no en vacío.`);
    return alcove;
  }

  const terminalDoor = {
    row: endRow,
    col: endCol,
    direction: door.direction,
    generated: true,
    sourceRoomId: door.sourceRoomId,
  };

  setTile(endRow, endCol, DUNGEON_DOOR_CHAR);
  addTileToRegion(passageRegion, endRow, endCol);

  const result = generateRoomFromDoor(terminalDoor, `${prefix} Pasaje d20=${passageRoll}: ${passage.label}.`);

  if (!result) {
    return createEmergencyAlcoveBeyondDoor(terminalDoor, `${prefix} Pasaje d20=${passageRoll}: ${passage.label}; la puerta terminal abre a un nicho.`);
  }

  return result;
}

function generateRoomFromDoor(door, prefix, options = {}) {
  const merchantRoom = options.forceMerchant || (!options.forceNonMerchant && randomFloat() < MERCHANT_ROOM_CHANCE);
  const roomRoll = merchantRoom ? 0 : rollDie(20);
  const spec = merchantRoom
    ? rectangleSpec("cámara pequeña de comerciante arcana, 15 x 15 pies", 3, 3, 1)
    : rollRoomSpec(roomRoll);
  let room = buildRoomBeyondDoor(door, spec);

  if (merchantRoom && room) {
    room.merchantRoom = true;
    room.name = `Cámara de vendedora ${room.id}`;
  }

  if (!room || !canCarveRoom(room, door)) {
    const adjusted = findAdjustedRoomBeyondDoor(door, spec, merchantRoom);

    if (!adjusted) {
      return createEmergencyAlcoveBeyondDoor(door, `${prefix} Sala d20=${roomRoll}: ${spec.label}. No había espacio para la sala sin pisar zonas previas: se excavó un nicho transitable.`);
    }

    room = adjusted.room;
    spec.label = `${spec.label}; ajustada por colisión con zonas existentes`;
    spec.exitCount = adjusted.spec.exitCount;
  }

  if (merchantRoom) {
    room.merchantRoom = true;
    room.name = `Cámara de vendedora ${room.id}`;
  }

  carveRoom(room);
  addGeneratedRoomExits(room, door.direction, spec.exitCount);
  const structureCount = addLargeRoomStructures(room);

  if (room.merchantRoom) {
    floorHasMerchantRoom = true;
    floorGeneratedFeatureCount++;
    return {
      room,
      difficulty: "merchant",
      message: `${prefix} Cámara especial: vendedora arcana. Sala 3x3 navegable, sin enemigos.`,
    };
  }

  const contentRoll = rollPercent();
  const contents = rollRoomContents(contentRoll);

  floorGeneratedFeatureCount++;

  return {
    room,
    difficulty: contents.difficulty,
    message: `${prefix} Sala d20=${roomRoll}: ${spec.label}${structureCount > 0 ? `. Estructuras: ${structureCount} muro(s) interior(es).` : ""}. Contenido d100=${contentRoll}: ${contents.label}.`,
  };
}

function generateStairsFromDoor(door, prefix) {
  const vector = directionVectors[door.direction];
  const lengthTiles = 3;

  if (!canCarvePassageFromDoor(door, lengthTiles)) {
    return createEmergencyAlcoveBeyondDoor(door, `${prefix} No había espacio limpio para escaleras sin pisar otra zona; se generó un nicho.`);
  }

  const region = createVisibleRegion("stairs", `Escaleras ${nextRegionId - 1}`);

  addTileToRegion(region, door.row, door.col);

  for (let i = 1; i <= lengthTiles; i++) {
    const row = door.row + vector.row * i;
    const col = door.col + vector.col * i;

    if (!isInsideMap(row, col)) {
      return createEmergencyAlcoveBeyondDoor(door, `${prefix} El borde del mapa fuerza un nicho en vez de escaleras.`);
    }

    setTile(row, col, i === lengthTiles ? DUNGEON_STAIRS_CHAR : DUNGEON_FLOOR_CHAR);
    addTileToRegion(region, row, col);
    addPassageSideWalls(row, col, door.direction, region);
  }

  floorHasStairs = true;
  floorGeneratedFeatureCount++;

  return {
    room: null,
    difficulty: "none",
    generatedStairs: true,
    message: `${prefix} Se genera un tramo corto de pasillo con escaleras al fondo.`,
  };
}

function createEmergencyAlcoveBeyondDoor(door, message) {
  const vector = directionVectors[door.direction];
  const floorRow = door.row + vector.row;
  const floorCol = door.col + vector.col;

  if (!isInsideMap(floorRow, floorCol)) {
    return {
      room: null,
      difficulty: "none",
      message: `${message} El borde del mapa impide excavar más.`,
    };
  }

  const room = {
    id: nextRoomId++,
    name: `Nicho ${nextRoomId - 1}`,
    row: Math.max(1, floorRow - 1),
    col: Math.max(1, floorCol - 1),
    width: 3,
    height: 3,
    entryDirection: oppositeDirections[door.direction],
    entryDoor: { row: door.row, col: door.col },
    generatedFromTable: true,
    emergencyAlcove: true,
  };

  // Reajuste mínimo para que el nicho quede del lado correcto de la puerta.
  if (door.direction === Direction.EAST) {
    room.row = door.row - 1;
    room.col = door.col;
  } else if (door.direction === Direction.WEST) {
    room.row = door.row - 1;
    room.col = door.col - 2;
  } else if (door.direction === Direction.SOUTH) {
    room.row = door.row;
    room.col = door.col - 1;
  } else {
    room.row = door.row - 2;
    room.col = door.col - 1;
  }

  if (room.row < 1 || room.col < 1 || room.row + room.height >= mapRows - 1 || room.col + room.width >= mapCols - 1) {
    return {
      room: null,
      difficulty: "none",
      message: `${message} El borde del mapa impide excavar más.`,
    };
  }

  // El nicho de emergencia nunca debe pisar otra sala, pasillo, escalera u objeto
  // estructural ya generado. Sólo acepta piedra sólida más la puerta de entrada.
  if (!canCarveRoom(room, door)) {
    return createSingleTilePocketBeyondDoor(door, message);
  }

  carveRoom(room);

  return {
    room,
    difficulty: "none",
    message,
  };
}

function rollDoorDestination(roll) {
  if (roll <= 20) return randomChoice([
    { kind: "passage", label: "puerta común hacia pasaje" },
    { kind: "stairs", label: "puerta común hacia escaleras" },
    { kind: "room", label: "puerta común hacia sala" },
    { kind: "room", label: "puerta común hacia sala" },
  ]);
  if (roll <= 25) return { kind: "room", label: "rastrillo; se resuelve como acceso a sala" };
  if (roll <= 30) return randomChoice([
    { kind: "passage", label: "vano vacío hacia pasaje" },
    { kind: "stairs", label: "vano vacío hacia escaleras" },
    { kind: "room", label: "vano vacío hacia sala" },
    { kind: "room", label: "vano vacío hacia sala" },
  ]);
  if (roll <= 35) return { kind: "room", label: "puerta de madera cerrada; se abre hacia sala" };
  if (roll <= 40) return randomChoice([
    { kind: "passage", label: "puerta de hierro hacia pasaje" },
    { kind: "room", label: "puerta de hierro hacia sala" },
    { kind: "room", label: "puerta de hierro hacia sala" },
    { kind: "room", label: "puerta de hierro hacia sala" },
  ]);
  if (roll <= 45) return randomChoice([
    { kind: "passage", label: "puerta de piedra con trampa hacia pasaje" },
    { kind: "stairs", label: "puerta de piedra con trampa hacia escaleras" },
    { kind: "room", label: "puerta de piedra con trampa hacia sala" },
    { kind: "room", label: "puerta de piedra con trampa hacia sala" },
  ]);
  if (roll <= 50) return randomChoice([
    { kind: "passage", label: "puerta secreta hacia pasaje oculto" },
    { kind: "room", label: "puerta secreta hacia cámara oculta" },
    { kind: "room", label: "puerta secreta hacia cámara oculta" },
    { kind: "room", label: "puerta secreta hacia cámara oculta" },
  ]);
  if (roll <= 55) return { kind: "passage", label: "entrada y diez pies hasta pasaje adyacente" };
  if (roll <= 60) return randomChoice([
    { kind: "passage", label: "puerta de piedra con puzzle hacia pasaje" },
    { kind: "room", label: "puerta de piedra con puzzle hacia sala" },
    { kind: "room", label: "puerta de piedra con puzzle hacia sala" },
    { kind: "room", label: "puerta de piedra con puzzle hacia sala" },
  ]);
  if (roll <= 80) return randomChoice([
    { kind: "passage", label: "puerta aleatoria hacia pasaje" },
    { kind: "room", label: "puerta aleatoria hacia sala" },
    { kind: "room", label: "puerta aleatoria hacia sala" },
    { kind: "room", label: "puerta aleatoria hacia sala" },
  ]);
  if (roll <= 85) return { kind: "room", label: "puerta que requiere llave; se resuelve como sala" };
  if (roll <= 90) return { kind: "room", label: "puerta elemental peligrosa; se resuelve como sala" };
  if (roll <= 95) return { kind: "room", label: "puerta pesada de piedra hacia sala" };
  return { kind: "room", label: "puerta rota colgando de sus bisagras hacia sala" };
}

function rollPassageResult(roll) {
  if (roll === 1) return { label: "continúa una distancia corta", lengthTiles: rollDie(4) * 2 };
  if (roll === 2) return { label: "avanza 15 pies y termina en puerta", lengthTiles: 3 };
  if (roll === 3) return { label: "avanza 30 pies y termina en escaleras", lengthTiles: 6 };
  if (roll === 4 || roll === 5) return { label: "gira 90 grados; en esta adaptación termina en una puerta", lengthTiles: 4 };
  if (roll === 6) return { label: "callejón sin salida", lengthTiles: 4, deadEnd: true };
  if (roll === 7 || roll === 8) return { label: "llega a una intersección; se abre una nueva cámara", lengthTiles: rollDie(4) * 2 };
  if (roll === 9 || roll === 10) return { label: "continúa y muestra un pasaje lateral; se abre una nueva cámara", lengthTiles: rollDie(6) * 2 };
  if (roll === 11) return { label: "termina en entrada abierta a una sala", lengthTiles: 3 };
  if (roll === 12 || roll === 13 || roll === 14) return { label: "encuentra una puerta lateral o secreta", lengthTiles: 4 };
  if (roll === 15) return { label: "se estrecha", lengthTiles: Math.max(2, Math.ceil(rollDie(6) / 2) * 2) };
  if (roll === 16) return { label: "se ensancha", lengthTiles: Math.max(2, Math.ceil(rollDie(6) / 2) * 2) };
  if (roll === 17 || roll === 18) return { label: "abre hacia escaleras laterales", lengthTiles: 4 };
  if (roll === 19) return { label: "hay una abertura en el suelo; se adapta como cámara", lengthTiles: rollDie(10) * 2 };
  return { label: "arquitectura rara; se adapta como sala especial", lengthTiles: 4 };
}

function rollRoomSpec(roll) {
  if (roll <= 2) return rectangleSpec(`${rollDie(4) * 10} x ${rollDie(4) * 10} pies`, rollDie(4) * 2, rollDie(4) * 2, rollDie(6));
  if (roll <= 4) {
    const size = (rollDie(4) + 1) * 2;
    return rectangleSpec(`cuadrada de ${(size / 2) * 10} pies`, size, size, rollDie(4));
  }
  if (roll <= 6) {
    const size = (rollDie(6) + 1) * 2;
    return rectangleSpec(`cuadrada de ${(size / 2) * 10} pies`, size, size, rollDie(6));
  }
  if (roll <= 8) {
    const size = (rollDie(8) + 1) * 2;
    return rectangleSpec(`gran sala cuadrada de ${(size / 2) * 10} pies`, size, size, rollDie(8));
  }
  if (roll <= 10) return rectangleSpec(`rectangular amplia`, (rollDie(4) + 1) * 2, (rollDie(8) + 1) * 2, rollDie(6));
  if (roll <= 12) return rectangleSpec(`rectangular mediana`, (rollDie(6) + 1) * 2, (rollDie(6) + 2) * 2, rollDie(6));
  if (roll <= 14) {
    const size = rollDie(4) * 2;
    return rectangleSpec(`circular adaptada a grilla, diámetro ${(size / 2) * 10} pies`, size, size, rollDie(4));
  }
  if (roll === 15) {
    const size = rollDie(6) * 2;
    return rectangleSpec(`triangular adaptada a grilla`, size, Math.max(4, Math.floor(size * 0.8)), rollDie(4));
  }
  if (roll === 16) {
    const size = rollDie(4) * 2;
    return rectangleSpec(`pentagonal adaptada a grilla`, size, size, Math.max(1, rollDie(4) - 2));
  }
  if (roll === 17) {
    const size = rollDie(6) * 2;
    return rectangleSpec(`hexagonal adaptada a grilla`, size, size, Math.max(1, rollDie(4) - 1));
  }
  if (roll === 18) {
    const size = rollDie(6) * 2;
    return rectangleSpec(`octagonal adaptada a grilla`, size, size, Math.max(1, rollDie(4) - 1));
  }
  if (roll === 19) {
    const size = rollDie(6) * 2;
    return rectangleSpec(`trapezoidal adaptada a grilla`, size, Math.max(4, size - 2), rollDie(4));
  }

  const width = Math.max(6, rollDie(12) * 2);
  return rectangleSpec(`cueva irregular adaptada a grilla`, width, Math.max(5, Math.round(width * 0.65)), rollDie(4));
}

function rectangleSpec(label, floorWidth, floorHeight, exitCount) {
  return {
    label,
    floorWidth: clamp(floorWidth, 4, 14),
    floorHeight: clamp(floorHeight, 4, 10),
    exitCount: clamp(exitCount, 1, 6),
  };
}

function rollRoomContents(roll) {
  if (roll <= 4) return { difficulty: "deadly", label: "encuentro mortal" };
  if (roll <= 8) return { difficulty: "easy", label: "rastros del jefe o amenaza principal" };
  if (roll <= 12) return { difficulty: "easy", label: "esbirros menores" };
  if (roll <= 20) return { difficulty: "medium", label: "peligro de mazmorra o monstruo errante" };
  if (roll <= 32) return { difficulty: "hard", label: "encuentro difícil" };
  if (roll <= 40) return { difficulty: "medium", label: "NPC investigando o víctima de una trampa" };
  if (roll <= 52) return { difficulty: "easy", label: "encuentro fácil" };
  if (roll <= 56) return { difficulty: "none", label: "obstáculo ambiental" };
  if (roll <= 67) return { difficulty: "medium", label: "encuentro medio" };
  if (roll <= 74) return { difficulty: "hard", label: "combate en curso o superviviente malherido" };
  if (roll <= 80) return { difficulty: "none", label: "runa, NPC fuerte o sala extraña" };
  if (roll <= 84) return { difficulty: "none", label: "sala vacía con posible botín relevante" };
  if (roll <= 88) return { difficulty: "easy", label: "encuentro fácil con posible pista" };
  if (roll <= 92) return { difficulty: "deadly", label: "reliquia maldita o bendita custodiada" };
  return { difficulty: "boss", label: "encuentro significativo o jefe" };
}

function buildRoomBeyondDoor(door, spec) {
  const width = spec.floorWidth + 2;
  const height = spec.floorHeight + 2;
  let row;
  let col;

  if (door.direction === Direction.EAST) {
    row = door.row - Math.floor(height / 2);
    col = door.col;
  } else if (door.direction === Direction.WEST) {
    row = door.row - Math.floor(height / 2);
    col = door.col - width + 1;
  } else if (door.direction === Direction.SOUTH) {
    row = door.row;
    col = door.col - Math.floor(width / 2);
  } else {
    row = door.row - height + 1;
    col = door.col - Math.floor(width / 2);
  }

  return {
    id: nextRoomId++,
    name: `Sala ${nextRoomId - 1}`,
    row,
    col,
    width,
    height,
    entryDirection: oppositeDirections[door.direction],
    entryDoor: { row: door.row, col: door.col },
    generatedFromTable: true,
  };
}

function findAdjustedRoomBeyondDoor(door, originalSpec, merchantRoom) {
  const sizeCandidates = merchantRoom
    ? [rectangleSpec("cámara pequeña de comerciante arcana", 3, 3, 1)]
    : [
        originalSpec,
        rectangleSpec("sala ajustada", Math.min(originalSpec.floorWidth, 8), Math.min(originalSpec.floorHeight, 6), Math.min(3, originalSpec.exitCount)),
        rectangleSpec("sala compacta", 5, 5, Math.min(2, originalSpec.exitCount)),
        rectangleSpec("sala mínima", 3, 3, 1),
      ];

  const offsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5];

  for (const spec of sizeCandidates) {
    for (const offset of offsets) {
      const room = buildRoomBeyondDoor(door, spec);
      shiftRoomPerpendicularToDoor(room, door.direction, offset);

      if (canCarveRoom(room, door)) {
        return { room, spec };
      }
    }
  }

  return null;
}

function shiftRoomPerpendicularToDoor(room, direction, offset) {
  if (direction === Direction.NORTH || direction === Direction.SOUTH) {
    room.col += offset;
  } else {
    room.row += offset;
  }
}

function canCarveRoom(room, door) {
  if (room.row < 1 || room.col < 1 || room.row + room.height >= mapRows - 1 || room.col + room.width >= mapCols - 1) {
    return false;
  }

  for (let row = room.row; row < room.row + room.height; row++) {
    for (let col = room.col; col < room.col + room.width; col++) {
      const key = tileKey(row, col);
      const isEntryDoor = row === door.row && col === door.col;
      const isBoundary = row === room.row || row === room.row + room.height - 1 || col === room.col || col === room.col + room.width - 1;
      const alreadyReserved = tileRegions.has(key);

      if (isEntryDoor) {
        continue;
      }

      if (alreadyReserved && !isBoundary) {
        return false;
      }

      if (map[row][col] !== DUNGEON_WALL_CHAR) {
        return false;
      }
    }
  }

  return true;
}
function carveRoom(room) {
  rooms.push(room);

  const region = createVisibleRegion("room", room.name);

  for (let row = room.row; row < room.row + room.height; row++) {
    for (let col = room.col; col < room.col + room.width; col++) {
      const isBoundary = row === room.row || row === room.row + room.height - 1 || col === room.col || col === room.col + room.width - 1;
      setTile(row, col, isBoundary ? DUNGEON_WALL_CHAR : DUNGEON_FLOOR_CHAR);
      addTileToRegion(region, row, col);
    }
  }

  if (room.entryDoor) {
    setTile(room.entryDoor.row, room.entryDoor.col, DUNGEON_DOOR_CHAR);
    addTileToRegion(region, room.entryDoor.row, room.entryDoor.col);
  }

  addTorchesForRoom(room);
}

function addTorchesForRoom(room) {
  if (randomFloat() > ROOM_TORCH_CHANCE) {
    return 0;
  }

  const floorTiles = Math.max(1, (room.width - 2) * (room.height - 2));
  const count = Math.min(ROOM_TORCH_MAX_COUNT, Math.max(1, Math.floor(floorTiles / 24)));
  let placed = 0;

  for (let i = 0; i < count; i++) {
    const position = getTorchPlacementInRoom(room);

    if (position && addTorch(position.row, position.col)) {
      placed++;
    }
  }

  return placed;
}

function getTorchPlacementInRoom(room) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const side = randomChoice([Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST]);
    let row;
    let col;

    if (side === Direction.NORTH) {
      row = room.row + 1;
      col = randomInt(room.col + 1, room.col + room.width - 2);
    } else if (side === Direction.SOUTH) {
      row = room.row + room.height - 2;
      col = randomInt(room.col + 1, room.col + room.width - 2);
    } else if (side === Direction.WEST) {
      row = randomInt(room.row + 1, room.row + room.height - 2);
      col = room.col + 1;
    } else {
      row = randomInt(room.row + 1, room.row + room.height - 2);
      col = room.col + room.width - 2;
    }

    if (map[row][col] === DUNGEON_FLOOR_CHAR && !hasTorchAt(row, col) && !isNearDoor(row, col)) {
      return { row, col };
    }
  }

  return null;
}

function addGeneratedRoomExits(room, entranceDirection, exitCountIncludingEntrance) {
  const extraExitCount = Math.max(0, exitCountIncludingEntrance - 1);
  const validDirections = [Direction.NORTH, Direction.SOUTH, Direction.EAST, Direction.WEST].filter((direction) => {
    return direction !== entranceDirection;
  });
  const usedDirections = new Set();

  for (let i = 0; i < extraExitCount; i++) {
    const availableDirections = validDirections.filter((direction) => !usedDirections.has(direction));

    if (availableDirections.length === 0) {
      return;
    }

    const direction = randomChoice(availableDirections);
    usedDirections.add(direction);
    const door = getRandomDoorOnRoomWall(room, direction);

    if (door && canAddDoorAt(door.row, door.col, direction)) {
      addDoor({ ...door, direction, sourceRoomId: room.id });
    }
  }
}

function getRandomDoorOnRoomWall(room, direction) {
  if (direction === Direction.NORTH) {
    return { row: room.row, col: randomInt(room.col + 1, room.col + room.width - 2) };
  }

  if (direction === Direction.SOUTH) {
    return { row: room.row + room.height - 1, col: randomInt(room.col + 1, room.col + room.width - 2) };
  }

  if (direction === Direction.EAST) {
    return { row: randomInt(room.row + 1, room.row + room.height - 2), col: room.col + room.width - 1 };
  }

  return { row: randomInt(room.row + 1, room.row + room.height - 2), col: room.col };
}

function canAddDoorAt(row, col, direction) {
  const vector = directionVectors[direction];
  const outsideRow = row + vector.row;
  const outsideCol = col + vector.col;

  return isInsideMap(row, col) &&
    isInsideMap(outsideRow, outsideCol) &&
    map[row][col] === DUNGEON_WALL_CHAR &&
    map[outsideRow][outsideCol] === DUNGEON_WALL_CHAR &&
    !tileRegions.has(tileKey(outsideRow, outsideCol));
}

function addDoor({ row, col, direction, sourceRoomId }) {
  if (!isInsideMap(row, col)) {
    return false;
  }

  setTile(row, col, DUNGEON_DOOR_CHAR);
  doors.push({ row, col, direction, sourceRoomId, generated: false });
  addTileToAllRegionsAt(row, col);
  return true;
}

function canCarvePassageFromDoor(door, lengthTiles) {
  const vector = directionVectors[door.direction];

  for (let i = 1; i <= lengthTiles; i++) {
    const row = door.row + vector.row * i;
    const col = door.col + vector.col * i;

    if (!isInsideMap(row, col)) {
      return false;
    }

    // El eje navegable del pasillo debe ser piedra sin excavar.
    // Esto evita que la generación atraviese o sobrescriba salas previas.
    if (map[row][col] !== DUNGEON_WALL_CHAR || tileRegions.has(tileKey(row, col))) {
      return false;
    }
  }

  return true;
}

function createSingleTilePocketBeyondDoor(door, message) {
  const vector = directionVectors[door.direction];
  const row = door.row + vector.row;
  const col = door.col + vector.col;

  if (!isInsideMap(row, col) || map[row][col] !== DUNGEON_WALL_CHAR || tileRegions.has(tileKey(row, col))) {
    return {
      room: null,
      difficulty: "none",
      blockedGeneration: true,
      message: `${message} La puerta queda bloqueada por una zona ya generada; no se pisa el mapa existente.`,
    };
  }

  const region = createVisibleRegion("pocket", `Nicho ${nextRegionId - 1}`);
  setTile(row, col, DUNGEON_FLOOR_CHAR);
  addTileToRegion(region, door.row, door.col);
  addTileToRegion(region, row, col);
  addPassageSideWalls(row, col, door.direction, region);

  return {
    room: null,
    difficulty: "none",
    message: `${message} Se generó un nicho mínimo sin sobrescribir salas existentes.`,
  };
}

function carvePassageFromDoor(door, lengthTiles) {
  const vector = directionVectors[door.direction];
  const region = createVisibleRegion("passage", `Pasaje ${nextRegionId - 1}`);

  addTileToRegion(region, door.row, door.col);

  for (let i = 1; i <= lengthTiles; i++) {
    const row = door.row + vector.row * i;
    const col = door.col + vector.col * i;

    if (!isInsideMap(row, col)) {
      break;
    }

    setTile(row, col, DUNGEON_FLOOR_CHAR);
    addTileToRegion(region, row, col);
    addPassageSideWalls(row, col, door.direction, region);
  }

  return region;
}

function addPassageSideWalls(row, col, direction, region) {
  const sideDirections = direction === Direction.NORTH || direction === Direction.SOUTH
    ? [Direction.EAST, Direction.WEST]
    : [Direction.NORTH, Direction.SOUTH];

  for (const side of sideDirections) {
    const vector = directionVectors[side];
    const wallRow = row + vector.row;
    const wallCol = col + vector.col;

    if (isInsideMap(wallRow, wallCol)) {
      if (map[wallRow][wallCol] === DUNGEON_WALL_CHAR) {
        setTile(wallRow, wallCol, DUNGEON_WALL_CHAR);
      }

      addTileToRegion(region, wallRow, wallCol);
    }
  }
}

function addLargeRoomStructures(room) {
  const floorWidth = room.width - 2;
  const floorHeight = room.height - 2;
  const floorTiles = floorWidth * floorHeight;

  if (!room.generatedFromTable || floorTiles < LARGE_ROOM_STRUCTURE_MIN_FLOOR_TILES) {
    return 0;
  }

  const maxSegments = Math.min(
    LARGE_ROOM_STRUCTURE_MAX_SEGMENTS,
    Math.max(1, Math.floor(floorTiles / LARGE_ROOM_STRUCTURE_MIN_FLOOR_TILES))
  );
  const segmentCount = randomInt(1, maxSegments);
  let placed = 0;

  for (let i = 0; i < segmentCount; i++) {
    if (placeInteriorWallSegment(room)) {
      placed++;
    }
  }

  return placed;
}

function placeInteriorWallSegment(room) {
  for (let attempt = 0; attempt < 50; attempt++) {
    const horizontal = randomFloat() < 0.5;
    const maxLength = horizontal ? room.width - 4 : room.height - 4;
    const length = clamp(
      randomInt(LARGE_ROOM_STRUCTURE_MIN_LENGTH, LARGE_ROOM_STRUCTURE_MAX_LENGTH),
      1,
      Math.max(1, maxLength)
    );

    if (length < 2) {
      continue;
    }

    const row = randomInt(room.row + 2, room.row + room.height - 3);
    const col = randomInt(room.col + 2, room.col + room.width - 3);
    const tiles = [];

    for (let offset = 0; offset < length; offset++) {
      tiles.push({
        row: row + (horizontal ? 0 : offset),
        col: col + (horizontal ? offset : 0),
      });
    }

    if (!canPlaceInteriorWallSegment(room, tiles)) {
      continue;
    }

    for (const tile of tiles) {
      setTile(tile.row, tile.col, DUNGEON_WALL_CHAR);
    }

    return true;
  }

  return false;
}

function canPlaceInteriorWallSegment(room, tiles) {
  return tiles.every((tile) => {
    if (tile.row <= room.row + 1 || tile.row >= room.row + room.height - 2) {
      return false;
    }

    if (tile.col <= room.col + 1 || tile.col >= room.col + room.width - 2) {
      return false;
    }

    if (map[tile.row][tile.col] !== DUNGEON_FLOOR_CHAR) {
      return false;
    }

    return !isNearDoor(tile.row, tile.col);
  });
}

function isNearDoor(row, col) {
  return doors.some((door) => {
    return Math.abs(door.row - row) <= 1 && Math.abs(door.col - col) <= 1;
  });
}

function createVisibleRegion(kind, name) {
  const region = {
    id: nextRegionId++,
    kind,
    name,
    tiles: new Set(),
  };

  visibleRegions.push(region);
  return region;
}

function addTileToRegion(region, row, col) {
  if (!region || !isInsideMap(row, col)) {
    return;
  }

  const key = tileKey(row, col);
  region.tiles.add(key);

  if (!tileRegions.has(key)) {
    tileRegions.set(key, new Set());
  }

  tileRegions.get(key).add(region.id);
}

function addTileToAllRegionsAt(row, col) {
  const key = tileKey(row, col);
  const ids = tileRegions.get(key);

  if (!ids) {
    return;
  }

  for (const id of ids) {
    const region = visibleRegions.find((candidate) => candidate.id === id);
    addTileToRegion(region, row, col);
  }
}

function hydrateChunksFromCurrentMap() {
  // La superficie se genera íntegramente por chunks. No debe hidratarse desde
  // `map`, porque `map` es la matriz antigua de dungeon y está inicializada con
  // paredes. Si se copiara sobre layer 0, rellenaría el bosque/entrada con #.
  if (isSurfaceLayer()) {
    return;
  }

  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      setTileInChunks(col, row, map[row][col], undefined, { recordDelta: false });
    }
  }
}

function setTile(row, col, value) {
  if (!isInsideMap(row, col)) {
    return;
  }

  invalidateVisibleTileCache();

  if (!isSurfaceLayer() && map[row]) {
    map[row][col] = value;
  } else if (map[row]?.[col] !== undefined) {
    map[row][col] = value;
  }

  setTileInChunks(col, row, value);
}

function tileCenter(row, col) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

function tileKey(row, col) {
  return `${row},${col}`;
}

function isInsideMap(row, col) {
  if (!Number.isFinite(row) || !Number.isFinite(col)) {
    return false;
  }

  if (isSurfaceLayer()) {
    return true;
  }

  return row >= 0 && row < mapRows && col >= 0 && col < mapCols;
}

function parseDungeonEntranceKey(key) {
  const [rowText, colText] = String(key ?? "45,45").split(",");
  const row = Number(rowText);
  const col = Number(colText);
  return [Number.isFinite(row) ? row : 45, Number.isFinite(col) ? col : 45];
}

function rollPercent() {
  return randomInt(1, 100);
}

function rollDie(sides) {
  return randomInt(1, sides);
}

function randomFloat() {
  return dungeonRng();
}

function randomInt(min, max) {
  return Math.floor(randomFloat() * (max - min + 1)) + min;
}

function randomChoice(items) {
  return items[randomInt(0, items.length - 1)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
