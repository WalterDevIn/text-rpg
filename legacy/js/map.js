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
} from "./constants.js";

export const DUNGEON_DOOR_CHAR = "+";
export const DUNGEON_FLOOR_CHAR = ".";
export const DUNGEON_WALL_CHAR = "#";
export const DUNGEON_STAIRS_CHAR = ">";
export const DUNGEON_STAIRS_UP_CHAR = "<";

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
let currentFloor = 1;
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

initializeStartingArea();

export function getPlayerSpawnPoint() {
  return tileCenter(45, 45);
}

export function isWallAt(row, col) {
  if (!isInsideMap(row, col)) {
    return true;
  }

  return map[row][col] === DUNGEON_WALL_CHAR || isTemporaryWallAt(row, col);
}

export function isStaticWallAt(row, col) {
  if (!isInsideMap(row, col)) {
    return true;
  }

  return map[row][col] === DUNGEON_WALL_CHAR;
}

export function isDoorAt(row, col) {
  if (!isInsideMap(row, col)) {
    return false;
  }

  return map[row][col] === DUNGEON_DOOR_CHAR;
}

export function isStairsAt(row, col) {
  return isDownStairsAt(row, col) || isUpStairsAt(row, col);
}

export function isDownStairsAt(row, col) {
  if (!isInsideMap(row, col)) {
    return false;
  }

  return map[row][col] === DUNGEON_STAIRS_CHAR;
}

export function isUpStairsAt(row, col) {
  if (!isInsideMap(row, col)) {
    return false;
  }

  return map[row][col] === DUNGEON_STAIRS_UP_CHAR;
}

export function getCurrentFloor() {
  return currentFloor;
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

    return descendToNextFloor();
  }

  lastStairTileKey = null;

  if (!isDoorAt(row, col)) {
    lastDoorTileKey = null;
    return null;
  }

  if (lastDoorTileKey === key) {
    return null;
  }

  lastDoorTileKey = key;

  const door = doors.find((candidate) => candidate.row === row && candidate.col === col);

  if (!door || door.generated) {
    return null;
  }

  const result = generateBeyondDoor(door);
  door.generated = true;

  if (!result) {
    return createEmergencyAlcoveBeyondDoor(door, "La puerta cedió hacia un nicho excavado de emergencia.");
  }

  return result;
}

function descendToNextFloor() {
  currentFloor += 1;
  resetDungeonForNewFloor();

  const spawn = getPlayerSpawnPoint();

  return {
    floorChanged: true,
    floorDirection: "down",
    spawnPoint: spawn,
    room: getRooms()[0] ?? null,
    difficulty: "none",
    message: `Bajas por las escaleras al piso ${currentFloor}. La mazmorra vuelve a cerrarse alrededor de una cámara inicial.`,
  };
}

function ascendToPreviousFloor() {
  if (currentFloor <= 1) {
    return {
      floorChanged: false,
      message: "No hay un piso superior al que volver desde aquí.",
    };
  }

  currentFloor -= 1;
  resetDungeonForNewFloor();

  const spawn = getPlayerSpawnPoint();

  return {
    floorChanged: true,
    floorDirection: "up",
    spawnPoint: spawn,
    room: getRooms()[0] ?? null,
    difficulty: "none",
    message: `Subes al piso ${currentFloor}. El grupo reaparece en una cámara segura de transición.`,
  };
}

export function resetDungeonForNewFloor() {
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

export function getVisibleTileKeysForPlayer(viewer) {
  const region = getCurrentRegionForEntity(viewer);
  const visible = region ? new Set(region.tiles) : new Set();

  addLineOfSightPeekTiles(viewer, visible);

  if (visible.size > 0) {
    return visible;
  }

  const row = Math.floor(viewer.y / TILE_SIZE);
  const col = Math.floor(viewer.x / TILE_SIZE);

  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (isInsideMap(r, c)) {
        visible.add(tileKey(r, c));
      }
    }
  }

  return visible;
}

function addLineOfSightPeekTiles(viewer, visible) {
  const viewerRow = Math.floor(viewer.y / TILE_SIZE);
  const viewerCol = Math.floor(viewer.x / TILE_SIZE);
  const peekRadiusTiles = 6;
  const floorKeysSeenThroughOpenings = [];

  for (let row = viewerRow - peekRadiusTiles; row <= viewerRow + peekRadiusTiles; row++) {
    for (let col = viewerCol - peekRadiusTiles; col <= viewerCol + peekRadiusTiles; col++) {
      if (!isInsideMap(row, col)) {
        continue;
      }

      const dx = col - viewerCol;
      const dy = row - viewerRow;

      if (dx * dx + dy * dy > peekRadiusTiles * peekRadiusTiles) {
        continue;
      }

      if (isWallAt(row, col)) {
        continue;
      }

      const center = tileCenter(row, col);

      if (!hasMapLineOfSight(viewer, center)) {
        continue;
      }

      const key = tileKey(row, col);
      visible.add(key);
      floorKeysSeenThroughOpenings.push({ row, col });
    }
  }

  for (const tile of floorKeysSeenThroughOpenings) {
    addAdjacentBoundaryWalls(tile.row, tile.col, visible);
  }
}

function addAdjacentBoundaryWalls(row, col, visible) {
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (!isInsideMap(r, c)) {
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
  carveRoom({
    ...startingRoom,
    id: nextRoomId++,
    generatedFromTable: false,
  });

  if (currentFloor > 1) {
    const upRow = startingRoom.row + 2;
    const upCol = startingRoom.col + 1;
    setTile(upRow, upCol, DUNGEON_STAIRS_UP_CHAR);
    addTileToAllRegionsAt(upRow, upCol);
  }

  addDoor({ row: startingRoom.row, col: startingRoom.col + 2, direction: Direction.NORTH, sourceRoomId: 1 });
  addDoor({ row: startingRoom.row + startingRoom.height - 1, col: startingRoom.col + 2, direction: Direction.SOUTH, sourceRoomId: 1 });
  addDoor({ row: startingRoom.row + 2, col: startingRoom.col, direction: Direction.WEST, sourceRoomId: 1 });
  addDoor({ row: startingRoom.row + 2, col: startingRoom.col + startingRoom.width - 1, direction: Direction.EAST, sourceRoomId: 1 });
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
  const merchantRoom = options.forceMerchant || (!options.forceNonMerchant && Math.random() < MERCHANT_ROOM_CHANCE);
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
  if (Math.random() > ROOM_TORCH_CHANCE) {
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
    const horizontal = Math.random() < 0.5;
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

function setTile(row, col, value) {
  if (!isInsideMap(row, col)) {
    return;
  }

  map[row][col] = value;
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
  return row >= 0 && row < mapRows && col >= 0 && col < mapCols;
}

function rollPercent() {
  return randomInt(1, 100);
}

function rollDie(sides) {
  return randomInt(1, sides);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
