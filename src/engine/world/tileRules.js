// Static tile definitions. Tiles are data, not ECS entities.
// A door/trap/chest becomes an ECS entity only when it needs dynamic state.
export const TileId = Object.freeze({
  FLOOR: "floor",
  WALL: "wall",
  CLOSED_DOOR: "closed_door",
  OPEN_DOOR: "open_door",
  TREE: "tree",
  VOID: "void",
});

export const tileRules = Object.freeze({
  [TileId.FLOOR]: {
    id: TileId.FLOOR,
    char: ".",
    blocksMovement: false,
    blocksVision: false,
    blocksProjectiles: false,
    destructible: false,
  },
  [TileId.WALL]: {
    id: TileId.WALL,
    char: "#",
    blocksMovement: true,
    blocksVision: true,
    blocksProjectiles: true,
    destructible: true,
    hardness: 3,
  },
  [TileId.TREE]: {
    id: TileId.TREE,
    char: "T",
    blocksMovement: true,
    blocksVision: true,
    blocksProjectiles: true,
    destructible: true,
    hardness: 2,
  },
  [TileId.CLOSED_DOOR]: {
    id: TileId.CLOSED_DOOR,
    char: "+",
    blocksMovement: true,
    blocksVision: false,
    blocksProjectiles: true,
    allowsPeek: true,
    interactable: true,
  },
  [TileId.OPEN_DOOR]: {
    id: TileId.OPEN_DOOR,
    char: "/",
    blocksMovement: false,
    blocksVision: false,
    blocksProjectiles: false,
    allowsPeek: false,
    interactable: true,
  },
  [TileId.VOID]: {
    id: TileId.VOID,
    char: " ",
    blocksMovement: true,
    blocksVision: true,
    blocksProjectiles: true,
    destructible: false,
  },
});

const charToTileId = new Map(Object.values(tileRules).map((rule) => [rule.char, rule.id]));

export function getTileRule(tileOrChar) {
  const id = tileRules[tileOrChar] ? tileOrChar : charToTileId.get(tileOrChar);
  return tileRules[id] ?? tileRules[TileId.VOID];
}

export function blocksMovement(tileOrChar) {
  return Boolean(getTileRule(tileOrChar).blocksMovement);
}

export function blocksVision(tileOrChar) {
  return Boolean(getTileRule(tileOrChar).blocksVision);
}

export function blocksProjectiles(tileOrChar) {
  return Boolean(getTileRule(tileOrChar).blocksProjectiles);
}

export function allowsDoorPeek(tileOrChar) {
  return Boolean(getTileRule(tileOrChar).allowsPeek);
}
