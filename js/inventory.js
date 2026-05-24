import {
  CHEST_INTERACTION_RANGE_PIXELS,
  CHEST_LOOT_MAX_ITEMS,
  CHEST_LOOT_MIN_ITEMS,
  CHEST_SPAWN_CHANCE,
  FORCECAGE_SCROLL_DURATION,
  FORCECAGE_SCROLL_RANGE_PIXELS,
  ITEM_PICKUP_RANGE_PIXELS,
  TORCH_INTERACTION_RANGE_PIXELS,
  TORCH_PLACE_RANGE_PIXELS,
  MISTY_STEP_RANGE_PIXELS,
  POTION_OF_HEALING_BONUS,
  POTION_OF_HEALING_DICE,
  POTION_OF_HEALING_DIE,
  RANDOM_LOOT_CHANCE,
  RANDOM_LOOT_MAX_PER_ROOM,
  TILE_SIZE,
} from "./constants.js";

import { EnemyState, gameState } from "./state.js";
import { player } from "./player.js";
import { enemies, killEnemy } from "./enemy.js";
import { rollDie } from "./dice.js";
import { addTemporaryWall, addTorch, getTorchAt, isStaticWallAt, removeTorch } from "./map.js";
import { canPlaceEntityAt, getDistance, getSurfaceDistance, normalizeVector } from "./physics.js";
import {
  createGroundItem,
  createInventoryItem,
  getItemDefinition,
  ItemId,
  ItemTargeting,
  ItemType,
} from "./items.js";
import { getForcecageTiles } from "./spellGeometry.js";

export const groundItems = [];
export const chests = [];
let nextChestId = 1;

const lootTable = [
  { definitionId: ItemId.POTION_OF_HEALING, weight: 34 },
  { definitionId: ItemId.DAGGER, weight: 12 },
  { definitionId: ItemId.LONGSWORD, weight: 10 },
  { definitionId: ItemId.BOW, weight: 8 },
  { definitionId: ItemId.ARROW, weight: 24, minQuantity: 4, maxQuantity: 10 },
  { definitionId: ItemId.TORCH, weight: 18, minQuantity: 1, maxQuantity: 3 },
  { definitionId: ItemId.SCROLL_MISTY_STEP, weight: 14 },
  { definitionId: ItemId.SCROLL_DISINTEGRATE, weight: 8 },
  { definitionId: ItemId.SCROLL_FORCECAGE, weight: 8 },
];

export function createChestForRoom(room) {
  const point = getRandomPointInsideRoom(room);

  if (!point) {
    return null;
  }

  const chest = {
    id: nextChestId++,
    name: "Cofre",
    x: point.x,
    y: point.y,
    radius: TILE_SIZE * 0.38,
    char: "C",
    color: "#c9974d",
    opened: false,
    contents: generateChestContents(),
  };

  chests.push(chest);
  return chest;
}

export function lootChestAtPoint(boardPoint) {
  if (!boardPoint) {
    return false;
  }

  const chest = findChestAtPoint(boardPoint);

  if (!chest) {
    return false;
  }

  if (getDistance(player, chest) > CHEST_INTERACTION_RANGE_PIXELS) {
    gameState.message = "El cofre está demasiado lejos. Debes estar a 5 pies.";
    return true;
  }

  if (chest.opened) {
    gameState.message = "El cofre ya está vacío.";
    return true;
  }

  const received = [];

  for (const entry of chest.contents) {
    addItemToInventory(entry.definitionId, entry.quantity);
    const definition = getItemDefinition(entry.definitionId);
    received.push(`${definition?.name ?? entry.definitionId}${entry.quantity > 1 ? ` x${entry.quantity}` : ""}`);
  }

  chest.contents.length = 0;
  chest.opened = true;
  chest.char = "c";
  chest.color = "#775533";
  gameState.message = received.length > 0
    ? `Saqueas el cofre: ${received.join(", ")}.`
    : "El cofre estaba vacío.";
  return true;
}

export function findChestAtPoint(point) {
  return chests.find((chest) => {
    return Math.hypot(point.x - chest.x, point.y - chest.y) <= Math.max(chest.radius + TILE_SIZE * 0.35, TILE_SIZE * 0.55);
  }) ?? null;
}

function generateChestContents() {
  const count = randomInt(CHEST_LOOT_MIN_ITEMS, CHEST_LOOT_MAX_ITEMS);
  const contents = [];

  for (let i = 0; i < count; i++) {
    const loot = weightedRandom(lootTable);
    const quantity = loot.minQuantity && loot.maxQuantity
      ? randomInt(loot.minQuantity, loot.maxQuantity)
      : 1;
    const stack = contents.find((entry) => entry.definitionId === loot.definitionId);

    if (stack) {
      stack.quantity += quantity;
    } else {
      contents.push({ definitionId: loot.definitionId, quantity });
    }
  }

  if (Math.random() < 0.45) {
    const gold = randomInt(5, 35);
    const stack = contents.find((entry) => entry.definitionId === ItemId.MERCHANT_GOLD);

    if (stack) {
      stack.quantity += gold;
    } else {
      contents.push({ definitionId: ItemId.MERCHANT_GOLD, quantity: gold });
    }
  }

  return contents;
}

export function getInventoryItems() {
  return player.inventory ?? [];
}

export function getInventoryItemByInstanceId(instanceId) {
  return getInventoryItems().find((item) => item.instanceId === instanceId) ?? null;
}

export function getInventoryWeapons() {
  return getInventoryItems().filter((item) => getItemDefinition(item)?.type === ItemType.WEAPON);
}

export function getUsableInventoryItems() {
  return getInventoryItems().filter((item) => {
    const definition = getItemDefinition(item);
    return definition?.type === ItemType.POTION || definition?.type === ItemType.SCROLL;
  });
}

export function getUsableItemTargeting(item) {
  const definition = getItemDefinition(item);
  return definition?.targeting ?? ItemTargeting.NONE;
}

export function getItemRangePixels(item) {
  return getItemDefinition(item)?.rangePixels ?? 0;
}

export function getItemRangeFeet(item) {
  return getItemDefinition(item)?.rangeFeet ?? 0;
}

export function addItemToInventory(definitionId, quantity = 1) {
  const definition = getItemDefinition(definitionId);

  if (!definition) {
    return null;
  }

  if (definitionId === ItemId.MERCHANT_GOLD) {
    player.gold += quantity;
    return null;
  }

  if (definition.type !== ItemType.WEAPON) {
    const stack = getInventoryItems().find((item) => item.definitionId === definitionId);

    if (stack) {
      stack.quantity += quantity;
      return stack;
    }
  }

  const item = createInventoryItem(definitionId, quantity);
  player.inventory.push(item);
  return item;
}

export function consumeInventoryItem(instanceId) {
  const inventory = getInventoryItems();
  const item = getInventoryItemByInstanceId(instanceId);

  if (!item) {
    return false;
  }

  item.quantity -= 1;

  if (item.quantity <= 0) {
    const index = inventory.indexOf(item);

    if (index >= 0) {
      inventory.splice(index, 1);
    }
  }

  return true;
}

export function spawnRandomLootForRoom(room) {
  if (!room) {
    return 0;
  }

  let spawned = 0;

  if (Math.random() <= CHEST_SPAWN_CHANCE && createChestForRoom(room)) {
    spawned++;
  }

  if (Math.random() > RANDOM_LOOT_CHANCE) {
    return spawned;
  }

  const count = randomInt(1, RANDOM_LOOT_MAX_PER_ROOM);

  for (let i = 0; i < count; i++) {
    const point = getRandomPointInsideRoom(room);

    if (!point) {
      continue;
    }

    const loot = weightedRandom(lootTable);
    const quantity = loot.minQuantity && loot.maxQuantity
      ? randomInt(loot.minQuantity, loot.maxQuantity)
      : 1;
    groundItems.push(createGroundItem(loot.definitionId, point.x, point.y, quantity));
    spawned++;
  }

  return spawned;
}

export function updateItemPickup() {
  for (let i = groundItems.length - 1; i >= 0; i--) {
    const item = groundItems[i];

    if (getDistance(player, item) > ITEM_PICKUP_RANGE_PIXELS) {
      continue;
    }

    const definition = getItemDefinition(item);
    addItemToInventory(item.definitionId, item.quantity);
    groundItems.splice(i, 1);
    gameState.message = `Recoges ${definition.name}${item.quantity > 1 ? ` x${item.quantity}` : ""}.`;
  }
}

export function useSelectedInventoryItem(options = {}) {
  const item = getInventoryItemByInstanceId(options.itemInstanceId);

  if (!item) {
    gameState.message = "No hay objeto elegido.";
    return;
  }

  const definition = getItemDefinition(item);

  if (!definition) {
    gameState.message = "Ese objeto no tiene definición.";
    return;
  }

  if (definition.id === ItemId.POTION_OF_HEALING) {
    usePotionOfHealing(item);
    return;
  }

  if (definition.id === ItemId.SCROLL_MISTY_STEP) {
    useMistyStepScroll(item, options.boardPoint);
    return;
  }

  if (definition.id === ItemId.SCROLL_DISINTEGRATE) {
    useDisintegrateScroll(item, options.targetId);
    return;
  }

  if (definition.id === ItemId.SCROLL_FORCECAGE) {
    useForcecageScroll(item, options.boardPoint);
    return;
  }

  if (definition.id === ItemId.TORCH) {
    useTorch(item, options.boardPoint);
    return;
  }

  gameState.message = `${definition.name} no se puede usar desde este menú.`;
}

export function pickupTorchAtPoint(boardPoint) {
  if (!boardPoint) {
    return false;
  }

  const row = Math.floor(boardPoint.y / TILE_SIZE);
  const col = Math.floor(boardPoint.x / TILE_SIZE);
  const torch = getTorchAt(row, col);

  if (!torch) {
    return false;
  }

  if (getDistance(player, torch) > TORCH_INTERACTION_RANGE_PIXELS) {
    gameState.message = "La antorcha está demasiado lejos. Debes estar a 5 pies.";
    return true;
  }

  removeTorch(torch);
  addItemToInventory(ItemId.TORCH, 1);
  gameState.message = "Tomas una antorcha encendida.";
  return true;
}
function useTorch(item, boardPoint) {
  if (!boardPoint) {
    gameState.message = "Elegí un punto a 5 pies para colocar la antorcha.";
    return;
  }

  const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

  if (direction.x === 0 && direction.y === 0) {
    gameState.message = "Elegí una dirección distinta a tu propia casilla.";
    return;
  }

  const targetPoint = {
    x: player.x + direction.x * TORCH_PLACE_RANGE_PIXELS,
    y: player.y + direction.y * TORCH_PLACE_RANGE_PIXELS,
  };

  const row = Math.floor(targetPoint.y / TILE_SIZE);
  const col = Math.floor(targetPoint.x / TILE_SIZE);

  if (isStaticWallAt(row, col)) {
    gameState.message = "No puedes colocar una antorcha dentro de una pared.";
    return;
  }

  const placed = addTorch(row, col, { placedByPlayer: true });

  if (!placed) {
    gameState.message = "No puedes colocar otra antorcha aquí.";
    return;
  }

  consumeInventoryItem(item.instanceId);
  gameState.message = "Colocas una antorcha a 5 pies en la dirección elegida. La zona queda iluminada.";
}

function usePotionOfHealing(item) {
  const rolls = rollMany(POTION_OF_HEALING_DICE, POTION_OF_HEALING_DIE);
  const healing = rolls.reduce((sum, roll) => sum + roll, 0) + POTION_OF_HEALING_BONUS;
  const previousHp = player.hp;

  player.hp = Math.min(player.maxHp, player.hp + healing);
  consumeInventoryItem(item.instanceId);

  gameState.message = `Bebes una Poción de vida. Recuperas ${player.hp - previousHp} PG. Tirada: ${rolls.join(" + ")} + ${POTION_OF_HEALING_BONUS} = ${healing}.`;
}

function useMistyStepScroll(item, boardPoint) {
  if (!boardPoint) {
    gameState.message = "Paso brumoso necesita un punto del tablero.";
    return;
  }

  if (getDistance(player, boardPoint) > MISTY_STEP_RANGE_PIXELS) {
    gameState.message = "Paso brumoso falla: el punto está fuera de rango.";
    return;
  }

  const x = boardPoint.x;
  const y = boardPoint.y;
  const livingEnemies = getLivingEnemies();

  if (!canPlaceEntityAt(player, x, y, { blockers: livingEnemies })) {
    gameState.message = "Paso brumoso falla: el destino está bloqueado.";
    return;
  }

  player.x = x;
  player.y = y;
  consumeInventoryItem(item.instanceId);
  gameState.message = "Lees el Pergamino de Paso brumoso y te teletransportas.";
}

function useDisintegrateScroll(item, targetId) {
  const target = enemies.find((enemy) => enemy.id === targetId && enemy.state !== EnemyState.DEAD && enemy.hp > 0);

  if (!target) {
    gameState.message = "Desintegrar necesita un objetivo válido.";
    return;
  }

  const definition = getItemDefinition(item);

  if (getSurfaceDistance(player, target) > definition.rangePixels) {
    gameState.message = `Desintegrar falla: el objetivo está fuera de ${definition.rangeFeet} pies.`;
    return;
  }

  const rolls = rollMany(definition.damageDice, definition.damageDie);
  const damage = rolls.reduce((sum, roll) => sum + roll, 0) + definition.damageBonus;

  target.hp = Math.max(0, target.hp - damage);
  consumeInventoryItem(item.instanceId);

  if (target.hp <= 0) {
    killEnemy(target);
    target.char = "*";
    target.color = "#66ff99";
    gameState.message = `Lees Desintegrar contra ${target.name}. Recibe ${damage} de daño y queda reducido a polvo. Tirada: ${rolls.join(" + ")} + ${definition.damageBonus}.`;
    return;
  }

  gameState.message = `Lees Desintegrar contra ${target.name}. Recibe ${damage} de daño. Tirada: ${rolls.join(" + ")} + ${definition.damageBonus}.`;
}

function useForcecageScroll(item, boardPoint) {
  if (!boardPoint) {
    gameState.message = "Forcecage necesita un punto del tablero.";
    return;
  }

  if (getDistance(player, boardPoint) > FORCECAGE_SCROLL_RANGE_PIXELS) {
    gameState.message = "Forcecage falla: el punto está fuera de rango.";
    return;
  }

  const tiles = getForcecageTiles(boardPoint);
  const placedTiles = [];

  for (const tile of tiles) {
    if (isStaticWallAt(tile.row, tile.col)) {
      continue;
    }

    if (addTemporaryWall(tile.row, tile.col, FORCECAGE_SCROLL_DURATION)) {
      placedTiles.push(tile);
    }
  }

  if (placedTiles.length === 0) {
    gameState.message = "Forcecage falla: no hay espacio válido para crear la jaula.";
    return;
  }

  consumeInventoryItem(item.instanceId);
  gameState.message = `Lees Forcecage. Se forma una jaula de fuerza de ${placedTiles.length} bloques durante ${FORCECAGE_SCROLL_DURATION} segundos.`;
}

function getLivingEnemies() {
  return enemies.filter((enemy) => enemy.state !== EnemyState.DEAD && enemy.hp > 0);
}

function getRandomPointInsideRoom(room) {
  const minRow = room.row + 1;
  const maxRow = room.row + room.height - 2;
  const minCol = room.col + 1;
  const maxCol = room.col + room.width - 2;

  if (minRow > maxRow || minCol > maxCol) {
    return null;
  }

  for (let attempt = 0; attempt < 40; attempt++) {
    const row = randomInt(minRow, maxRow);
    const col = randomInt(minCol, maxCol);
    const x = col * TILE_SIZE + TILE_SIZE / 2;
    const y = row * TILE_SIZE + TILE_SIZE / 2;

    const tooCloseToPlayer = getDistance(player, { x, y }) < TILE_SIZE * 1.5;
    const overlapsItem = groundItems.some((item) => getDistance(item, { x, y }) < TILE_SIZE * 0.75);
    const overlapsChest = chests.some((chest) => getDistance(chest, { x, y }) < TILE_SIZE * 0.9);
    const blockedByWall = isStaticWallAt(row, col);

    if (!tooCloseToPlayer && !overlapsItem && !overlapsChest && !blockedByWall) {
      return { x, y };
    }
  }

  return null;
}

function rollMany(count, die) {
  const rolls = [];

  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(die));
  }

  return rolls;
}

function weightedRandom(items) {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of items) {
    roll -= item.weight;

    if (roll <= 0) {
      return item;
    }
  }

  return items[0];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
