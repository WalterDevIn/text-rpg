import {
  TILE_SIZE,
  MERCHANT_INTERACTION_RANGE_PIXELS,
  MERCHANT_HIRE_COST,
  MERCHANT_ALLY_FRONT_DISTANCE_PIXELS,
  MERCHANT_ALLY_LOW_HP_PERCENT,
  MERCHANT_ALLY_MIN_ENEMY_DISTANCE_PIXELS,
  MERCHANT_THEFT_CHECK_INTERVAL,
  MERCHANT_THEFT_NOTICE_DC,
  ENEMY_ACTION_CAST_TIME,
  ENEMY_SPELL_COOLDOWN,
  ENEMY_PATH_RECALC_INTERVAL,
  ENEMY_PATH_NODE_REACHED_DISTANCE,
  MAGIC_MISSILE_RANGE_PIXELS,
} from "./constants.js";

import { player } from "./player.js";
import { gameState, EnemyState } from "./state.js";
import { getDistance, getDirection, moveEntityWithCollision, normalizeVector } from "./physics.js";
import { addItemToInventory } from "./inventory.js";
import { getItemDefinition, ItemId } from "./items.js";
import { hasWallNearPoint, isEntityVisibleToPlayer, isPointInMerchantSafeZone, isWallAt } from "./map.js";
import { rollDie } from "./dice.js";
import { enemies } from "./enemy.js";
import { spawnMagicMissileVolley } from "./projectiles.js";
import { findPath, hasLineOfSight, worldToTile } from "./pathfinding.js";

export const merchants = [];

let nextMerchantId = 1;

const limitedMerchantStock = [
  { definitionId: ItemId.SCROLL_MISTY_STEP, quantity: 2, price: 120 },
  { definitionId: ItemId.SCROLL_DISINTEGRATE, quantity: 1, price: 450 },
  { definitionId: ItemId.SCROLL_FORCECAGE, quantity: 1, price: 380 },
];

const realMageStock = [
  { definitionId: ItemId.MERCHANT_DRESS, quantity: 1, price: 0 },
  { definitionId: ItemId.MERCHANT_BOOTS, quantity: 1, price: 0 },
  { definitionId: ItemId.MERCHANT_BRACERS, quantity: 2, price: 0 },
  { definitionId: ItemId.MERCHANT_NECKLACE, quantity: 1, price: 0 },
  { definitionId: ItemId.MERCHANT_CAP, quantity: 1, price: 0 },
  { definitionId: ItemId.MERCHANT_STAFF, quantity: 1, price: 0 },
  { definitionId: ItemId.BAG_OF_HOLDING, quantity: 1, price: 0 },
  { definitionId: ItemId.MERCHANT_SPELLBOOK, quantity: 1, price: 0 },
  { definitionId: ItemId.MERCHANT_GOLD, quantity: 150, price: 0 },
  { definitionId: ItemId.SCROLL_MISTY_STEP, quantity: 2, price: 0 },
  { definitionId: ItemId.SCROLL_DISINTEGRATE, quantity: 1, price: 0 },
  { definitionId: ItemId.SCROLL_FORCECAGE, quantity: 1, price: 0 },
];

export function spawnMerchantForRoom(room) {
  if (!room || !room.merchantRoom) {
    return null;
  }

  const centerRow = room.row + Math.floor(room.height / 2);
  const centerCol = room.col + Math.floor(room.width / 2);

  const merchant = {
    id: nextMerchantId++,
    name: "Vendedora arcana",
    portraitKey: "vendedora_arcana",
    portraitName: "vendedora_arcana",
    x: centerCol * TILE_SIZE + TILE_SIZE / 2,
    y: centerRow * TILE_SIZE + TILE_SIZE / 2,
    radius: TILE_SIZE * 0.35,
    char: "M",
    color: "#d6a3ff",
    baseColor: "#d6a3ff",
    roomId: room.id,
    hp: 14,
    maxHp: 14,
    state: EnemyState.IDLE,
    attackCooldown: 0,
    spellCooldown: 0,
    canCastMagicMissile: true,
    actionWindupType: null,
    actionWindupRemaining: 0,
    actionWindupTargetId: null,
    path: [],
    pathTargetTileKey: null,
    pathRecalcRemaining: 0,
    isMerchant: true,
    isHostile: false,
    theftCheckRemaining: MERCHANT_THEFT_CHECK_INTERVAL,
    limitedInventory: cloneStock(limitedMerchantStock),
    realInventory: cloneStock(realMageStock),
    originalRealInventory: cloneStock(realMageStock),
  };

  merchants.push(merchant);
  return merchant;
}

export function updateMerchants(deltaTime) {
  for (const merchant of [...merchants]) {
    if (merchant.hp <= 0) {
      merchant.state = EnemyState.DEAD;
      continue;
    }

    updateMerchantCooldowns(merchant, deltaTime);

    if (merchant.isHired) {
      updateHiredMerchant(merchant, deltaTime);
      continue;
    }

    if (merchant.isHostile) {
      continue;
    }

    merchant.theftCheckRemaining = Math.max(0, merchant.theftCheckRemaining - deltaTime);

    if (merchant.theftCheckRemaining > 0) {
      continue;
    }

    merchant.theftCheckRemaining = MERCHANT_THEFT_CHECK_INTERVAL;

    if (!isRealInventoryMissingItem(merchant)) {
      continue;
    }

    const roll = rollDie(20);

    if (roll >= MERCHANT_THEFT_NOTICE_DC) {
      turnMerchantHostile(merchant, roll);
    }
  }
}

export function getVisibleNearbyMerchant() {
  return merchants.find((merchant) => {
    return !merchant.isHostile && merchant.hp > 0 && isEntityVisibleToPlayer(merchant, player) && getDistance(player, merchant) <= MERCHANT_INTERACTION_RANGE_PIXELS;
  }) ?? null;
}

export function getMerchantBlockers() {
  return merchants.filter((merchant) => !merchant.isHostile && merchant.hp > 0);
}

export function hireMerchant(merchantId) {
  const merchant = merchants.find((candidate) => candidate.id === merchantId);

  if (!merchant || merchant.isHostile || merchant.hp <= 0) {
    gameState.message = "No puedes contratar a esa criatura.";
    return false;
  }

  if (merchant.isHired) {
    gameState.message = `${merchant.name} ya te acompaña.`;
    return true;
  }

  if (getDistance(player, merchant) > MERCHANT_INTERACTION_RANGE_PIXELS) {
    gameState.message = "Estás demasiado lejos para contratarla.";
    return false;
  }

  if (player.gold < MERCHANT_HIRE_COST) {
    gameState.message = `Necesitas ${MERCHANT_HIRE_COST} po para contratarla.`;
    return false;
  }

  player.gold -= MERCHANT_HIRE_COST;
  merchant.isHired = true;
  merchant.name = "Vendedora arcana aliada";
  merchant.color = "#77ddff";
  merchant.baseColor = "#77ddff";
  merchant.state = EnemyState.IDLE;
  merchant.hasSeenPlayer = true;
  merchant.lastKnownPlayerPosition = null;
  merchant.spellCooldown = 0;
  merchant.actionWindupType = null;
  merchant.actionWindupRemaining = 0;
  merchant.actionWindupTargetId = null;
  merchant.path = [];
  merchant.pathTargetTileKey = null;
  merchant.pathRecalcRemaining = 0;

  gameState.message = `${merchant.name} acepta acompañarte por ${MERCHANT_HIRE_COST} po. Te seguirá como acólita y priorizará sobrevivir.`;
  return true;
}

export function getMerchantInventory(merchant) {
  if (!merchant) {
    return [];
  }

  return isTimeStoppedForMerchant() ? merchant.realInventory : merchant.limitedInventory;
}

export function isTimeStoppedForMerchant() {
  return gameState.timeStopRemaining > 0;
}

export function buyMerchantItem(merchantId, stockIndex) {
  const merchant = merchants.find((candidate) => candidate.id === merchantId);

  if (!merchant || merchant.isHostile) {
    gameState.message = "No hay vendedora disponible.";
    return false;
  }

  if (getDistance(player, merchant) > MERCHANT_INTERACTION_RANGE_PIXELS) {
    gameState.message = "Estás demasiado lejos para comerciar.";
    return false;
  }

  const inventory = getMerchantInventory(merchant);
  const stock = inventory[stockIndex];

  if (!stock || stock.quantity <= 0) {
    gameState.message = "Ese objeto ya no está disponible.";
    return false;
  }

  const definition = getItemDefinition(stock.definitionId);
  const price = isTimeStoppedForMerchant() ? 0 : stock.price;

  if (price > 0 && player.gold < price) {
    gameState.message = `No tienes oro suficiente para comprar ${definition?.name ?? "ese objeto"}. Precio: ${price} po.`;
    return false;
  }

  if (price > 0) {
    player.gold -= price;
  }

  if (stock.definitionId === ItemId.BAG_OF_HOLDING && isTimeStoppedForMerchant()) {
    takeBagOfHoldingAndContents(merchant);
    gameState.message = "Tomas la Bolsa de vacío. Todo lo guardado dentro pasa a tu inventario.";
    return true;
  }

  stock.quantity -= 1;

  if (isTimeStoppedForMerchant()) {
    grantMerchantStockToPlayer(stock.definitionId, 1);
  } else {
    grantMerchantStockToPlayer(stock.definitionId, 1);
    markAuthorizedRealInventoryRemoval(merchant, stock.definitionId, 1);
  }

  const modeText = price === 0
    ? "Tomas un objeto del inventario verdadero mientras el tiempo está detenido"
    : "Compras un pergamino";

  gameState.message = `${modeText}: ${definition?.name ?? stock.definitionId}. Precio: ${price} po.`;
  return true;
}

function updateMerchantCooldowns(merchant, deltaTime) {
  merchant.spellCooldown = Math.max(0, (merchant.spellCooldown ?? 0) - deltaTime);
  merchant.attackCooldown = Math.max(0, (merchant.attackCooldown ?? 0) - deltaTime);
  merchant.actionWindupRemaining = Math.max(0, (merchant.actionWindupRemaining ?? 0) - deltaTime);
  merchant.pathRecalcRemaining = Math.max(0, (merchant.pathRecalcRemaining ?? 0) - deltaTime);
}

function updateHiredMerchant(merchant, deltaTime) {
  if (resolveHiredMerchantWindup(merchant)) {
    return;
  }

  const visibleEnemies = getVisibleEnemiesForMerchant(merchant);
  const nearestEnemy = getNearestEntity(merchant, visibleEnemies);

  if (nearestEnemy && (merchant.hp / merchant.maxHp <= MERCHANT_ALLY_LOW_HP_PERCENT || getDistance(merchant, nearestEnemy) < MERCHANT_ALLY_MIN_ENEMY_DISTANCE_PIXELS)) {
    merchant.state = EnemyState.FLEE;
    merchant.color = "#88eeff";
    moveMerchantAwayFrom(merchant, nearestEnemy, deltaTime);
    return;
  }

  const castTarget = getBestMagicMissileTarget(merchant, visibleEnemies);

  if (castTarget && merchant.spellCooldown <= 0) {
    if (hasMerchantCastingClearance(merchant)) {
      startHiredMerchantWindup(merchant, "ally_magic_missile", castTarget);
      return;
    }

    const clearPoint = findMerchantCastingClearancePoint(merchant, castTarget);

    if (clearPoint) {
      moveMerchantTowardPoint(merchant, clearPoint, deltaTime);
      merchant.state = EnemyState.CHASE;
      merchant.color = "#99ddff";
      return;
    }
  }

  const targetPoint = getHiredMerchantTacticalPoint(merchant, nearestEnemy);
  moveMerchantTowardPoint(merchant, targetPoint, deltaTime);
  merchant.state = nearestEnemy ? EnemyState.CHASE : EnemyState.IDLE;
  merchant.color = nearestEnemy ? "#77ddff" : "#66bbdd";
}

function resolveHiredMerchantWindup(merchant) {
  if (!merchant.actionWindupType) {
    return false;
  }

  if (merchant.actionWindupRemaining > 0) {
    merchant.state = EnemyState.CAST;
    return true;
  }

  const type = merchant.actionWindupType;
  const targetId = merchant.actionWindupTargetId;
  merchant.actionWindupType = null;
  merchant.actionWindupTargetId = null;

  if (type === "ally_magic_missile") {
    const target = enemies.find((enemy) => enemy.id === targetId && enemy.hp > 0 && enemy.state !== EnemyState.DEAD);

    if (!target || !canMerchantSeeEnemy(merchant, target) || getDistance(merchant, target) > MAGIC_MISSILE_RANGE_PIXELS) {
      gameState.message = `${merchant.name} pierde el objetivo y cancela Misil mágico.`;
      return true;
    }

    if (!hasMerchantCastingClearance(merchant)) {
      gameState.message = `${merchant.name} cancela Misil mágico: está demasiado pegada a una pared.`;
      return true;
    }

    spawnMagicMissileVolley(merchant, target);
    merchant.spellCooldown = ENEMY_SPELL_COOLDOWN;
    gameState.message = `${merchant.name} conjura Misil mágico contra ${target.name}.`;
    return true;
  }

  return true;
}

function startHiredMerchantWindup(merchant, type, target) {
  if (merchant.actionWindupType || !target) {
    return;
  }

  merchant.actionWindupType = type;
  merchant.actionWindupTargetId = target.id;
  merchant.actionWindupRemaining = ENEMY_ACTION_CAST_TIME;
  merchant.state = EnemyState.CAST;
  merchant.color = "#99eeff";
  gameState.message = `${merchant.name} empieza a conjurar Misil mágico contra ${target.name}.`;
}

function getVisibleEnemiesForMerchant(merchant) {
  return enemies.filter((enemy) => {
    return enemy.hp > 0 &&
      enemy.state !== EnemyState.DEAD &&
      isEntityVisibleToPlayer(enemy, player) &&
      canMerchantSeeEnemy(merchant, enemy);
  });
}

function canMerchantSeeEnemy(merchant, enemy) {
  return getDistance(merchant, enemy) <= MAGIC_MISSILE_RANGE_PIXELS && hasLineOfSight(merchant, enemy);
}

function getBestMagicMissileTarget(merchant, visibleEnemies) {
  return visibleEnemies
    .filter((enemy) => getDistance(merchant, enemy) <= MAGIC_MISSILE_RANGE_PIXELS)
    .sort((a, b) => getDistance(merchant, a) - getDistance(merchant, b))[0] ?? null;
}

function getHiredMerchantTacticalPoint(merchant, nearestEnemy) {
  if (!nearestEnemy) {
    const followDistance = TILE_SIZE * 1.2;
    const direction = normalizeVector(merchant.x - player.x, merchant.y - player.y);
    const fallback = direction.x === 0 && direction.y === 0 ? { x: -1, y: 0 } : direction;
    return {
      x: player.x + fallback.x * followDistance,
      y: player.y + fallback.y * followDistance,
    };
  }

  const playerToEnemy = normalizeVector(nearestEnemy.x - player.x, nearestEnemy.y - player.y);
  return {
    x: player.x + playerToEnemy.x * MERCHANT_ALLY_FRONT_DISTANCE_PIXELS,
    y: player.y + playerToEnemy.y * MERCHANT_ALLY_FRONT_DISTANCE_PIXELS,
  };
}

function moveMerchantAwayFrom(merchant, threat, deltaTime) {
  const direction = normalizeVector(merchant.x - threat.x, merchant.y - threat.y);
  const fallback = direction.x === 0 && direction.y === 0 ? { x: 1, y: 0 } : direction;
  moveMerchantByDirection(merchant, fallback, deltaTime);
}

function moveMerchantTowardPoint(merchant, point, deltaTime) {
  if (!point) {
    return;
  }

  if (getDistance(merchant, point) < TILE_SIZE * 0.35) {
    return;
  }

  const pathPoint = getMerchantNextPathPoint(merchant, point);
  const target = pathPoint ?? point;
  const direction = getDirection(merchant, target);
  moveMerchantByDirection(merchant, direction, deltaTime);
}

function moveMerchantByDirection(merchant, direction, deltaTime) {
  const vector = normalizeVector(direction.x, direction.y);

  if (vector.x === 0 && vector.y === 0) {
    return;
  }

  const speed = TILE_SIZE * 0.78;
  const nextX = merchant.x + vector.x * speed * deltaTime;
  const nextY = merchant.y + vector.y * speed * deltaTime;

  moveEntityWithCollision(merchant, nextX, nextY);
}

function getMerchantNextPathPoint(merchant, target) {
  const targetTile = worldToTile(target);
  const targetTileKey = `${targetTile.row},${targetTile.col}`;

  if (!merchant.path || merchant.path.length === 0 || merchant.pathTargetTileKey !== targetTileKey || merchant.pathRecalcRemaining <= 0) {
    merchant.path = findPath(merchant, target);
    merchant.pathTargetTileKey = targetTileKey;
    merchant.pathRecalcRemaining = ENEMY_PATH_RECALC_INTERVAL;
  }

  while (merchant.path.length > 0 && getDistance(merchant, merchant.path[0]) <= ENEMY_PATH_NODE_REACHED_DISTANCE) {
    merchant.path.shift();
  }

  return merchant.path[0] ?? null;
}

function hasMerchantCastingClearance(merchant) {
  return !hasWallNearPoint(merchant, 1);
}

function findMerchantCastingClearancePoint(merchant, target) {
  const originTile = worldToTile(merchant);
  let best = null;
  let bestScore = Infinity;

  for (let radius = 1; radius <= 6; radius++) {
    for (let row = originTile.row - radius; row <= originTile.row + radius; row++) {
      for (let col = originTile.col - radius; col <= originTile.col + radius; col++) {
        if (isWallAt(row, col)) {
          continue;
        }

        const point = { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };

        if (isPointInMerchantSafeZone(point) && !isPointInMerchantSafeZone(merchant)) {
          continue;
        }

        if (hasWallNearPoint(point, 1)) {
          continue;
        }

        if (target && getDistance(point, target) > MAGIC_MISSILE_RANGE_PIXELS) {
          continue;
        }

        if (target && !hasLineOfSight(point, target)) {
          continue;
        }

        const score = getDistance(merchant, point);

        if (score < bestScore) {
          bestScore = score;
          best = point;
        }
      }
    }

    if (best) {
      return best;
    }
  }

  return null;
}

function getNearestEntity(origin, entities) {
  return entities
    .slice()
    .sort((a, b) => getDistance(origin, a) - getDistance(origin, b))[0] ?? null;
}

function grantMerchantStockToPlayer(definitionId, quantity = 1) {
  if (definitionId === ItemId.MERCHANT_GOLD) {
    player.gold += quantity;
    return;
  }

  addItemToInventory(definitionId, quantity);
}

function takeBagOfHoldingAndContents(merchant) {
  const realInventorySnapshot = merchant.realInventory
    .filter((stock) => stock.quantity > 0)
    .map((stock) => ({ ...stock }));

  for (const stock of realInventorySnapshot) {
    grantMerchantStockToPlayer(stock.definitionId, stock.quantity);
    stock.quantity = 0;
  }

  for (const stock of merchant.realInventory) {
    stock.quantity = 0;
  }
}

function markAuthorizedRealInventoryRemoval(merchant, definitionId, quantity) {
  reduceStockQuantity(merchant.realInventory, definitionId, quantity);
  reduceStockQuantity(merchant.originalRealInventory, definitionId, quantity);
}

function reduceStockQuantity(stockList, definitionId, quantity) {
  const stock = stockList.find((item) => item.definitionId === definitionId);

  if (!stock) {
    return;
  }

  stock.quantity = Math.max(0, stock.quantity - quantity);
}

function isRealInventoryMissingItem(merchant) {
  return merchant.originalRealInventory.some((original) => {
    const current = merchant.realInventory.find((item) => item.definitionId === original.definitionId);
    return !current || current.quantity < original.quantity;
  });
}

function turnMerchantHostile(merchant, roll) {
  merchant.isHostile = true;
  merchant.name = "Vendedora arcana hostil";
  merchant.char = "m";
  merchant.color = "#cc66ff";
  merchant.baseColor = "#cc66ff";
  merchant.state = EnemyState.IDLE;
  merchant.hasSeenPlayer = true;
  merchant.lastKnownPlayerPosition = { x: player.x, y: player.y };
  merchant.path = [];
  merchant.pathTargetTileKey = null;
  merchant.pathRecalcRemaining = 0;
  merchant.actionWindupType = null;
  merchant.actionWindupRemaining = 0;

  const index = merchants.indexOf(merchant);

  if (index >= 0) {
    merchants.splice(index, 1);
  }

  enemies.push(merchant);
  gameState.message = `${merchant.name} nota que falta algo de su inventario verdadero (d20=${roll}, DC ${MERCHANT_THEFT_NOTICE_DC}) y se vuelve hostil.`;
}

function cloneStock(stock) {
  return stock.map((item) => ({ ...item }));
}
