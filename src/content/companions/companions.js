import {
  ATTACK_RANGE_PIXELS,
  BOW_ATTACK_RANGE_PIXELS,
  ENEMY_PATH_NODE_REACHED_DISTANCE,
  ENEMY_PATH_RECALC_INTERVAL,
  PLAYER_ATTACK_COOLDOWN,
  RUN_SPEED,
  TILE_SIZE,
} from "../../config/constants.js";

import { EnemyState, gameState } from "../../engine/state/gameState.js";
import { getDistance, getDirection, getSurfaceDistance, moveEntityWithCollision, normalizeVector } from "../../engine/world/collision.js";
import { hasLineOfSight, findPath, worldToTile } from "../../engine/world/pathfinding.js";
import { isEntityVisibleToPlayer } from "../../engine/world/map.js";
import { rollDie } from "../../engine/rules/dice.js";
import { spawnArrowShot } from "../../engine/projectiles/projectileSystem.js";
import { createInventoryItem, getItemDefinition, ItemId } from "../items/items.js";
import { groundItems } from "../items/inventory.js";
import { player } from "../creatures/player.js";

export const companions = [];

const WARRIOR_REACTION_COOLDOWN = 3;
const WARRIOR_LOW_HP_RATIO = 0.35;

let nextCompanionId = 1;

export function resetCompanionsForNewGame() {
  companions.length = 0;
  companions.push(createWarriorCompanion({
    x: player.x - TILE_SIZE * 0.75,
    y: player.y + TILE_SIZE * 0.75,
  }));
}

export function createWarriorCompanion({ x, y } = {}) {
  const id = nextCompanionId++;

  return {
    id,
    companionType: "warrior",
    name: "Guerrero acompañante",
    portraitKey: "guerrero_acompanante",
    portraitName: "guerrero_acompanante",
    char: "G",
    color: "#e6c15c",
    baseColor: "#e6c15c",
    x: x ?? player.x - TILE_SIZE,
    y: y ?? player.y + TILE_SIZE,
    radius: TILE_SIZE * 0.35,
    hp: 12,
    maxHp: 12,
    attackCooldown: 0,
    reactionCooldown: 0,
    state: EnemyState.IDLE,
    path: [],
    pathTargetTileKey: null,
    pathRecalcRemaining: 0,
    isCompanion: true,
    inventory: [
      createInventoryItem(ItemId.LONGSWORD, 1),
      createInventoryItem(ItemId.BOW, 1),
      createInventoryItem(ItemId.ARROW, 20),
    ],
  };
}

export function updateCompanions(deltaTime, enemies = [], alliedMerchants = []) {
  for (const companion of companions) {
    if (companion.hp <= 0) {
      companion.hp = 0;
      companion.state = EnemyState.DEAD;
      companion.char = "%";
      companion.color = "#777777";
      continue;
    }

    companion.attackCooldown = Math.max(0, (companion.attackCooldown ?? 0) - deltaTime);
    companion.reactionCooldown = Math.max(0, (companion.reactionCooldown ?? 0) - deltaTime);
    companion.shieldRemaining = Math.max(0, (companion.shieldRemaining ?? 0) - deltaTime);
    if (companion.shieldRemaining <= 0) companion.shieldHp = 0;
    companion.pathRecalcRemaining = Math.max(0, (companion.pathRecalcRemaining ?? 0) - deltaTime);

    if (companion.companionType === "warrior") {
      updateWarriorCompanion(companion, deltaTime, enemies, alliedMerchants);
    }
  }
}

function updateWarriorCompanion(companion, deltaTime, enemies, alliedMerchants) {
  const visibleEnemies = getVisibleEnemiesForCompanion(companion, enemies);
  const nearestEnemy = getNearestEntity(companion, visibleEnemies);

  if (nearestEnemy) {
    const meleeWeapon = getCompanionWeapon(companion, { ranged: false });
    const bow = getCompanionWeapon(companion, { ranged: true });
    const adjacentEnemy = getAdjacentEnemy(companion, visibleEnemies);
    const lowHealth = isWarriorLowHealth(companion);
    const guardPoint = getWarriorGuardPoint(nearestEnemy, { lowHealth });

    // Si está muy herido, no persigue ni se queda intercambiando golpes: retrocede con el jugador,
    // pero conserva el punto de guardia entre el jugador y la amenaza más cercana.
    if (lowHealth) {
      companion.state = EnemyState.CHASE;
      companion.color = "#c98f4a";

      if (meleeWeapon && adjacentEnemy && isCompanionHoldingGuardPoint(companion, guardPoint)) {
        tryCompanionReactionAttack(companion, adjacentEnemy, meleeWeapon);
      }

      moveCompanionTowardPoint(companion, guardPoint, deltaTime, alliedMerchants);
      return;
    }

    if (meleeWeapon && adjacentEnemy) {
      companion.state = EnemyState.ATTACK;
      companion.color = "#ffd36d";
      companionMeleeAttack(companion, adjacentEnemy, meleeWeapon);
      tryCompanionReactionAttack(companion, adjacentEnemy, meleeWeapon);
      return;
    }

    // Prioridad táctica: proteger al jugador antes que quedarse disparando.
    // El guerrero intenta ocupar la línea entre jugador y enemigo; sólo usa el arco si ya está en posición.
    if (!isCompanionHoldingGuardPoint(companion, guardPoint)) {
      companion.state = EnemyState.CHASE;
      companion.color = "#e6c15c";
      moveCompanionTowardPoint(companion, guardPoint, deltaTime, alliedMerchants);
      return;
    }

    if (bow && hasCompanionAmmo(companion) && getSurfaceDistance(companion, nearestEnemy) <= BOW_ATTACK_RANGE_PIXELS && hasLineOfSight(companion, nearestEnemy)) {
      companion.state = EnemyState.ATTACK;
      companion.color = "#ffe28a";
      companionRangedAttack(companion, nearestEnemy, bow, enemies);
      return;
    }

    companion.state = EnemyState.CHASE;
    companion.color = "#e6c15c";
    moveCompanionTowardPoint(companion, guardPoint, deltaTime, alliedMerchants);
    return;
  }

  tryCompanionPickup(companion);
  companion.state = EnemyState.IDLE;
  companion.color = "#cfae5a";
  moveCompanionTowardPoint(companion, getCompanionFollowPoint(companion), deltaTime, alliedMerchants);
}

function getAdjacentEnemy(companion, enemies) {
  return enemies
    .filter((enemy) => getSurfaceDistance(companion, enemy) <= ATTACK_RANGE_PIXELS)
    .sort((a, b) => getDistance(companion, a) - getDistance(companion, b))[0] ?? null;
}

function isCompanionHoldingGuardPoint(companion, guardPoint) {
  return Boolean(guardPoint) && getDistance(companion, guardPoint) <= TILE_SIZE * 0.45;
}

function isWarriorLowHealth(companion) {
  return companion.maxHp > 0 && companion.hp / companion.maxHp <= WARRIOR_LOW_HP_RATIO;
}

function getVisibleEnemiesForCompanion(companion, enemies) {
  return enemies.filter((enemy) => {
    return enemy.hp > 0 &&
      enemy.state !== EnemyState.DEAD &&
      isEntityVisibleToPlayer(enemy, player) &&
      getDistance(companion, enemy) <= BOW_ATTACK_RANGE_PIXELS &&
      hasLineOfSight(companion, enemy);
  });
}

function getWarriorGuardPoint(enemy, options = {}) {
  const playerToEnemy = normalizeVector(enemy.x - player.x, enemy.y - player.y);
  const fallback = playerToEnemy.x === 0 && playerToEnemy.y === 0 ? { x: 1, y: 0 } : playerToEnemy;
  const distanceFromPlayer = options.lowHealth ? TILE_SIZE * 0.62 : TILE_SIZE;

  return {
    x: player.x + fallback.x * distanceFromPlayer,
    y: player.y + fallback.y * distanceFromPlayer,
  };
}

function getCompanionFollowPoint(companion) {
  const direction = normalizeVector(companion.x - player.x, companion.y - player.y);
  const fallback = direction.x === 0 && direction.y === 0 ? { x: -1, y: 1 } : direction;
  return {
    x: player.x + fallback.x * TILE_SIZE * 1.15,
    y: player.y + fallback.y * TILE_SIZE * 1.15,
  };
}

function moveCompanionTowardPoint(companion, point, deltaTime, alliedMerchants = []) {
  if (!point || getDistance(companion, point) < TILE_SIZE * 0.32) {
    return;
  }

  const pathPoint = getCompanionNextPathPoint(companion, point);
  const target = pathPoint ?? point;
  const direction = getDirection(companion, target);
  const vector = normalizeVector(direction.x, direction.y);

  if (vector.x === 0 && vector.y === 0) {
    return;
  }

  const speed = RUN_SPEED * getCompanionAllyOverlapMultiplier(companion, alliedMerchants);
  const nextX = companion.x + vector.x * speed * deltaTime;
  const nextY = companion.y + vector.y * speed * deltaTime;

  // Los acompañantes no bloquean ni son bloqueados por otros aliados; sólo respetan paredes.
  moveEntityWithCollision(companion, nextX, nextY);
}

function getCompanionNextPathPoint(companion, target) {
  const targetTile = worldToTile(target);
  const targetTileKey = `${targetTile.row},${targetTile.col}`;

  if (!companion.path || companion.path.length === 0 || companion.pathTargetTileKey !== targetTileKey || companion.pathRecalcRemaining <= 0) {
    companion.path = findPath(companion, target);
    companion.pathTargetTileKey = targetTileKey;
    companion.pathRecalcRemaining = ENEMY_PATH_RECALC_INTERVAL;
  }

  while (companion.path.length > 0 && getDistance(companion, companion.path[0]) <= ENEMY_PATH_NODE_REACHED_DISTANCE) {
    companion.path.shift();
  }

  return companion.path[0] ?? null;
}

function getCompanionAllyOverlapMultiplier(companion, alliedMerchants = []) {
  const allies = [player, ...companions, ...alliedMerchants.filter((merchant) => merchant.isHired && merchant.hp > 0)];
  const overlapsAlly = allies.some((ally) => {
    if (!ally || ally === companion) return false;
    return getDistance(companion, ally) < (companion.radius ?? 0) + (ally.radius ?? 0);
  });

  return overlapsAlly ? 0.5 : 1;
}

function companionMeleeAttack(companion, target, weaponItem) {
  if (companion.attackCooldown > 0 || !target || target.hp <= 0) {
    return false;
  }

  resolveCompanionWeaponDamage(companion, target, weaponItem, {
    messageVerb: "golpea",
    deathVerb: "derriba",
  });
  companion.attackCooldown = PLAYER_ATTACK_COOLDOWN;
  return true;
}

function tryCompanionReactionAttack(companion, target, weaponItem) {
  if (companion.reactionCooldown > 0 || !target || target.hp <= 0) {
    return false;
  }

  if (getSurfaceDistance(companion, target) > ATTACK_RANGE_PIXELS) {
    return false;
  }

  resolveCompanionWeaponDamage(companion, target, weaponItem, {
    messageVerb: "reacciona y golpea otra vez a",
    deathVerb: "derriba con una reacción a",
  });
  companion.reactionCooldown = WARRIOR_REACTION_COOLDOWN;
  return true;
}

function resolveCompanionWeaponDamage(companion, target, weaponItem, { messageVerb, deathVerb }) {
  const weapon = getItemDefinition(weaponItem);
  const damage = rollDamage(weapon);
  target.hp = Math.max(0, target.hp - damage.total);

  if (target.hp <= 0) {
    target.hp = 0;
    target.state = EnemyState.DEAD;
    target.char = "%";
    target.color = "#777777";
    gameState.message = `${companion.name} ${deathVerb} ${target.name} con ${weapon.name}. Tirada: ${damage.text}.`;
    return;
  }

  gameState.message = `${companion.name} ${messageVerb} ${target.name} con ${weapon.name} por ${damage.total}. Tirada: ${damage.text}.`;
}

function companionRangedAttack(companion, target, weaponItem, enemies) {
  if (companion.attackCooldown > 0 || !target || target.hp <= 0) {
    return;
  }

  const arrowStack = getCompanionInventoryStackByDefinitionId(companion, ItemId.ARROW);

  if (!arrowStack || arrowStack.quantity <= 0) {
    return;
  }

  const weapon = getItemDefinition(weaponItem);
  const damage = rollDamage(weapon);
  arrowStack.quantity -= 1;
  removeEmptyCompanionStack(companion, arrowStack);
  companion.attackCooldown = PLAYER_ATTACK_COOLDOWN;

  spawnArrowShot(companion, target, {
    damage: damage.total,
    rollText: damage.text,
    weaponName: weapon.name,
    targets: enemies.filter((enemy) => enemy.hp > 0 && enemy.state !== EnemyState.DEAD),
  });

  gameState.message = `${companion.name} dispara una flecha contra ${target.name}.`;
}

function tryCompanionPickup(companion) {
  const nearbyItem = groundItems.find((item) => getDistance(companion, item) <= TILE_SIZE * 0.45);

  if (!nearbyItem) {
    return false;
  }

  companion.inventory.push(createInventoryItem(nearbyItem.definitionId, nearbyItem.quantity ?? 1));
  const index = groundItems.indexOf(nearbyItem);

  if (index >= 0) {
    groundItems.splice(index, 1);
  }

  const definition = getItemDefinition(nearbyItem.definitionId);
  gameState.message = `${companion.name} recoge ${definition?.name ?? "un objeto"} al pasar.`;
  return true;
}

function getCompanionWeapon(companion, options = {}) {
  return companion.inventory.find((item) => {
    const definition = getItemDefinition(item);
    return definition?.type === "weapon" && Boolean(definition.ranged) === Boolean(options.ranged);
  }) ?? null;
}

function hasCompanionAmmo(companion) {
  return (getCompanionInventoryStackByDefinitionId(companion, ItemId.ARROW)?.quantity ?? 0) > 0;
}

function getCompanionInventoryStackByDefinitionId(companion, definitionId) {
  return companion.inventory.find((item) => item.definitionId === definitionId) ?? null;
}

function removeEmptyCompanionStack(companion, item) {
  if (item.quantity > 0) {
    return;
  }

  const index = companion.inventory.indexOf(item);
  if (index >= 0) {
    companion.inventory.splice(index, 1);
  }
}

function rollDamage(weaponDefinition) {
  const rolls = [];
  const count = weaponDefinition?.damageDice ?? 1;
  const die = weaponDefinition?.damageDie ?? 4;
  const bonus = weaponDefinition?.damageBonus ?? 0;

  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(die));
  }

  const total = rolls.reduce((sum, roll) => sum + roll, 0) + bonus;
  const text = bonus > 0 ? `${rolls.join(" + ")} + ${bonus}` : rolls.join(" + ");
  return { total, text };
}

function getNearestEntity(origin, entities) {
  return entities
    .slice()
    .sort((a, b) => getDistance(origin, a) - getDistance(origin, b))[0] ?? null;
}
