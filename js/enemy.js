import {
  TILE_SIZE,
  ENEMY_SPEED,
  ENEMY_FLEE_SPEED,
  ENEMY_DETECTION_RANGE_PIXELS,
  ENEMY_LOW_HP_PERCENT,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_ATTACK_DAMAGE,
  ENEMY_ACTION_CAST_TIME,
  ENEMY_SPELL_COOLDOWN,
  ENEMY_MAGIC_MISSILE_RANGE_PIXELS,
  ENEMY_SEPARATION_RANGE_PIXELS,
  ENEMY_SEPARATION_STRENGTH,
  ENEMY_PATH_RECALC_INTERVAL,
  ENEMY_PATH_NODE_REACHED_DISTANCE,
  ENEMY_LOST_TARGET_DISTANCE,
  ENEMY_CASTER_MIN_DISTANCE_PIXELS,
  ENEMY_CASTER_PREFERRED_DISTANCE_PIXELS,
  DRAGON_BOSS_ROOM_MIN_FLOOR_TILES,
  DRAGON_BOSS_SPAWN_CHANCE,
  CENTIPEDE_SPAWN_CHANCE,
  DRAGON_BOSS_SIZE_TILES,
  DRAGON_BOSS_RADIUS,
  DRAGON_BOSS_HP,
  DRAGON_BOSS_MELEE_DAMAGE,
  DRAGON_BOSS_BREATH_DAMAGE_DICE,
  DRAGON_BOSS_BREATH_DAMAGE_DIE,
  DRAGON_BOSS_BREATH_RANGE_PIXELS,
  DRAGON_BOSS_BREATH_CONE_ANGLE_RADIANS,
  DRAGON_BOSS_BREATH_COOLDOWN,
  CENTIPEDE_SEGMENT_COUNT,
  CENTIPEDE_SEGMENT_SPACING,
  CENTIPEDE_TURN_SPEED,
  CENTIPEDE_SPEED,
  CENTIPEDE_ATTACK_DAMAGE,
} from "./constants.js";

import { EnemyState, gameState } from "./state.js";
import { player } from "./player.js";
import { getDistance, getDirection, moveEntityWithCollision, normalizeVector } from "./physics.js";
import { isInAttackRange } from "./combat.js";
import { spawnDragonBreathFlames, spawnMagicMissileVolley } from "./projectiles.js";
import { hasWallNearPoint, isEntityVisibleToPlayer, isPointInMerchantSafeZone, isStaticWallAt, isWallAt } from "./map.js";
import { findPath, hasLineOfSight, worldToTile } from "./pathfinding.js";
import { isPointInCone } from "./spellGeometry.js";
import { rollDie } from "./dice.js";
import { merchants } from "./merchant.js";

export const enemies = [];

let nextEnemyId = 1;
let nextCentipedeChainId = 1;
let hasRequiredRareEnemySpawned = false;
const centipedeTrails = new Map();

const enemyTemplates = [
  {
    name: "Trasgo",
    portraitKey: "trasgo",
    portraitName: "trasgo",
    char: "g",
    color: "#ff4444",
    hp: 10,
    maxHp: 10,
    canCastMagicMissile: false,
    weight: 42,
  },
  {
    name: "Rata gigante",
    portraitKey: "rata_gigante",
    portraitName: "rata_gigante",
    char: "r",
    color: "#bb9966",
    hp: 7,
    maxHp: 7,
    canCastMagicMissile: false,
    weight: 24,
  },
  {
    name: "Esqueleto",
    portraitKey: "esqueleto",
    portraitName: "esqueleto",
    char: "s",
    color: "#dddddd",
    hp: 12,
    maxHp: 12,
    canCastMagicMissile: false,
    weight: 22,
  },
  {
    name: "Ciempiés",
    portraitKey: "ciempies",
    portraitName: "ciempies",
    char: "c",
    color: "#79cc55",
    hp: 9,
    maxHp: 9,
    canCastMagicMissile: false,
    kind: "centipede",
    weight: 3,
  },
  {
    name: "Dragón jefe",
    portraitKey: "dragon_jefe",
    portraitName: "dragon_jefe",
    char: "D",
    color: "#ff5533",
    hp: DRAGON_BOSS_HP,
    maxHp: DRAGON_BOSS_HP,
    canCastMagicMissile: false,
    kind: "dragon_boss",
    weight: 1,
  },
  {
    name: "Acólito hostil",
    portraitKey: "acolito_hostil",
    portraitName: "acolito_hostil",
    char: "m",
    color: "#cc66ff",
    hp: 8,
    maxHp: 8,
    canCastMagicMissile: true,
    weight: 12,
  },
];

export function spawnEnemiesForGeneratedRoom(room, difficulty = "easy") {
  if (!room || difficulty === "none" || difficulty === "merchant") {
    return 0;
  }

  let spawned = 0;

  // El enemigo raro obligatorio por piso no reemplaza a los encuentros comunes.
  // Antes, si aparecía dragón/ciempiés, la función retornaba y anulaba ratas,
  // trasgos y acólitos en esa sala. Ahora se suma al encuentro.
  spawned += trySpawnMandatoryRareEnemy(room, difficulty);

  if (spawned === 0 && shouldSpawnDragonBoss(room, difficulty)) {
    const point = getRandomPointInsideRoom(room, { marginTiles: 2, minDistanceTiles: 3 });

    if (point) {
      enemies.push(createEnemyFromTemplate(getTemplateByKind("dragon_boss"), point.x, point.y));
      hasRequiredRareEnemySpawned = true;
      spawned++;
    }
  }

  if (spawned === 0 && shouldSpawnCentipede(difficulty)) {
    const point = getRandomPointInsideRoom(room, { marginTiles: 1, minDistanceTiles: 3 });

    if (point) {
      spawnCentipede(point.x, point.y);
      hasRequiredRareEnemySpawned = true;
      spawned++;
    }
  }

  const count = getEnemyCountForDifficulty(difficulty);

  for (let i = 0; i < count; i++) {
    const point = getRandomPointInsideRoom(room);

    if (!point) {
      continue;
    }

    const enemy = createRandomEnemy(point.x, point.y);
    enemies.push(enemy);
    spawned++;
  }

  return spawned;
}

export function resetRareEnemyRequirement() {
  hasRequiredRareEnemySpawned = false;
}

function trySpawnMandatoryRareEnemy(room, difficulty) {
  if (hasRequiredRareEnemySpawned || difficulty === "none") {
    return 0;
  }

  const floorTiles = Math.max(0, room.width - 2) * Math.max(0, room.height - 2);
  const canFitDragon = floorTiles >= DRAGON_BOSS_ROOM_MIN_FLOOR_TILES;
  const preferDragon = difficulty === "boss" || difficulty === "deadly" || Math.random() < 0.45;

  if (canFitDragon && preferDragon) {
    const dragonPoint = getRandomPointInsideRoom(room, { marginTiles: 2, minDistanceTiles: 3 });

    if (dragonPoint) {
      enemies.push(createEnemyFromTemplate(getTemplateByKind("dragon_boss"), dragonPoint.x, dragonPoint.y));
      hasRequiredRareEnemySpawned = true;
      return 1;
    }
  }

  const centipedePoint = getRandomPointInsideRoom(room, { marginTiles: 1, minDistanceTiles: 3 });

  if (centipedePoint) {
    spawnCentipede(centipedePoint.x, centipedePoint.y);
    hasRequiredRareEnemySpawned = true;
    return 1;
  }

  if (canFitDragon) {
    const dragonPoint = getRandomPointInsideRoom(room, { marginTiles: 1, minDistanceTiles: 2 });

    if (dragonPoint) {
      enemies.push(createEnemyFromTemplate(getTemplateByKind("dragon_boss"), dragonPoint.x, dragonPoint.y));
      hasRequiredRareEnemySpawned = true;
      return 1;
    }
  }

  return 0;
}

export function updateEnemies(deltaTime) {
  for (const enemy of enemies) {
    if (enemy.hp <= 0 && !enemy.deathProcessed) {
      killEnemy(enemy);
    }

    updateEnemyCooldowns(enemy, deltaTime);
    updateEnemy(enemy, deltaTime);
  }
}

function createRandomEnemy(x, y) {
  const template = weightedRandom(enemyTemplates.filter((item) => !item.kind));
  return createEnemyFromTemplate(template, x, y);
}

function createEnemyFromTemplate(template, x, y) {
  const id = nextEnemyId++;
  const kind = template.kind ?? "normal";
  const radius = kind === "dragon_boss" ? DRAGON_BOSS_RADIUS : TILE_SIZE * 0.35;
  const drawSize = kind === "dragon_boss" ? TILE_SIZE * DRAGON_BOSS_SIZE_TILES : undefined;
  const angle = Math.random() * Math.PI * 2;

  const enemy = {
    id,
    kind,
    name: `${template.name} ${id}`,
    portraitKey: template.portraitKey,
    portraitName: template.portraitName,
    x,
    y,
    radius,
    drawSize,
    char: template.char,
    baseColor: template.color,
    color: template.color,
    hp: template.hp,
    maxHp: template.maxHp,
    attackCooldown: Math.random() * 0.75,
    spellCooldown: template.canCastMagicMissile ? 2 + Math.random() * 2 : 0,
    breathCooldown: kind === "dragon_boss" ? 2 + Math.random() * 2 : 0,
    actionWindupType: null,
    actionWindupRemaining: 0,
    canCastMagicMissile: template.canCastMagicMissile,
    hasSeenPlayer: false,
    lastKnownPlayerPosition: null,
    path: [],
    pathTargetTileKey: null,
    pathRecalcRemaining: 0,
    state: EnemyState.IDLE,
    angle,
  };

  return enemy;
}

function getEnemyCountForDifficulty(difficulty) {
  if (difficulty === "easy") return randomInt(1, 2);
  if (difficulty === "medium") return randomInt(2, 3);
  if (difficulty === "hard") return randomInt(3, 4);
  if (difficulty === "deadly") return randomInt(4, 5);
  if (difficulty === "boss") return randomInt(3, 5);
  return randomInt(1, 2);
}

function getRandomPointInsideRoom(room, options = {}) {
  const marginTiles = options.marginTiles ?? 1;
  const minDistanceTiles = options.minDistanceTiles ?? 2;
  const minRow = room.row + marginTiles;
  const maxRow = room.row + room.height - 1 - marginTiles;
  const minCol = room.col + marginTiles;
  const maxCol = room.col + room.width - 1 - marginTiles;

  if (minRow > maxRow || minCol > maxCol) {
    return null;
  }

  for (let attempt = 0; attempt < 30; attempt++) {
    const row = randomInt(minRow, maxRow);
    const col = randomInt(minCol, maxCol);
    const x = col * TILE_SIZE + TILE_SIZE / 2;
    const y = row * TILE_SIZE + TILE_SIZE / 2;

    const tooCloseToPlayer = Math.hypot(x - player.x, y - player.y) < TILE_SIZE * minDistanceTiles;
    const blockedByWall = isStaticWallAt(row, col);

    if (!tooCloseToPlayer && !blockedByWall) {
      return { x, y };
    }
  }

  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minCol; col <= maxCol; col++) {
      if (!isStaticWallAt(row, col)) {
        return {
          x: col * TILE_SIZE + TILE_SIZE / 2,
          y: row * TILE_SIZE + TILE_SIZE / 2,
        };
      }
    }
  }

  return null;
}

function updateEnemyCooldowns(enemy, deltaTime) {
  enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaTime);
  enemy.spellCooldown = Math.max(0, enemy.spellCooldown - deltaTime);
  enemy.breathCooldown = Math.max(0, (enemy.breathCooldown ?? 0) - deltaTime);
  enemy.actionWindupRemaining = Math.max(0, (enemy.actionWindupRemaining ?? 0) - deltaTime);
  enemy.pathRecalcRemaining = Math.max(0, (enemy.pathRecalcRemaining ?? 0) - deltaTime);
}

function updateEnemy(enemy, deltaTime) {
  if (enemy.state === EnemyState.DEAD) {
    return;
  }

  if (enemy.hp <= 0) {
    killEnemy(enemy);
    return;
  }

  const visibleTarget = selectVisibleTarget(enemy);
  updateEnemyMemory(enemy, visibleTarget);

  if (updateEnemyActionWindup(enemy, visibleTarget)) {
    return;
  }

  if (enemy.kind === "centipede_part") {
    updateCentipedePart(enemy, visibleTarget, deltaTime);
    return;
  }

  updateEnemyState(enemy, visibleTarget);

  if (enemy.state === EnemyState.IDLE) {
    driftAwayFromCrowd(enemy, deltaTime);
    return;
  }

  if (enemy.state === EnemyState.CHASE) {
    moveEnemyUsingPath(enemy, enemy.tacticalTargetPosition ?? getCurrentTargetPosition(enemy), ENEMY_SPEED, deltaTime);
    return;
  }

  if (enemy.state === EnemyState.ATTACK) {
    enemyAttack(enemy);
    return;
  }

  if (enemy.state === EnemyState.CAST) {
    enemyCastMagicMissile(enemy);
    return;
  }

  if (enemy.state === EnemyState.FLEE) {
    moveEnemyAwayFromPoint(enemy, enemy.currentTarget ?? player, ENEMY_FLEE_SPEED, deltaTime);
  }
}

function updateEnemyMemory(enemy, visibleTarget) {
  if (!visibleTarget) {
    return;
  }

  enemy.hasSeenPlayer = true;
  enemy.currentTarget = visibleTarget;
  enemy.lastKnownPlayerPosition = { x: visibleTarget.x, y: visibleTarget.y };
}

function updateEnemyState(enemy, visibleTarget) {
  enemy.tacticalTargetPosition = null;
  const target = visibleTarget ?? enemy.currentTarget ?? player;
  const distance = getDistance(enemy, target);
  const lowHp = enemy.hp / enemy.maxHp <= ENEMY_LOW_HP_PERCENT;

  if (!enemy.hasSeenPlayer && !visibleTarget) {
    enemy.state = EnemyState.IDLE;
    enemy.color = enemy.canCastMagicMissile ? "#664488" : "#884444";
    return;
  }

  if (lowHp) {
    enemy.state = EnemyState.FLEE;
    enemy.color = "#ffaa00";
    return;
  }

  if (enemy.kind === "dragon_boss") {
    updateDragonState(enemy, visibleTarget, distance);
    return;
  }

  if (enemy.canCastMagicMissile) {
    updateCasterState(enemy, visibleTarget, distance);
    return;
  }

  if (visibleTarget && isEnemyMeleeInRange(enemy, visibleTarget) && !isOverlappingAnotherEnemy(enemy)) {
    enemy.state = EnemyState.ATTACK;
    enemy.color = "#ff0000";
    return;
  }

  if (enemy.lastKnownPlayerPosition) {
    enemy.state = EnemyState.CHASE;
    enemy.color = "#ff4444";

    if (!visibleTarget && getDistance(enemy, enemy.lastKnownPlayerPosition) <= ENEMY_LOST_TARGET_DISTANCE) {
      forgetPlayer(enemy);
    }
    return;
  }

  enemy.state = EnemyState.IDLE;
  enemy.color = enemy.canCastMagicMissile ? "#664488" : "#884444";
}

function updateCasterState(enemy, visibleTarget, distance) {
  if (visibleTarget && distance < ENEMY_CASTER_MIN_DISTANCE_PIXELS) {
    enemy.state = EnemyState.FLEE;
    enemy.color = "#dd88ff";
    return;
  }

  if (canEnemyCastMagicMissile(enemy, visibleTarget, distance)) {
    if (!hasCasterWallClearance(enemy)) {
      enemy.tacticalTargetPosition = findCasterClearancePoint(enemy, visibleTarget);
      enemy.state = enemy.tacticalTargetPosition ? EnemyState.CHASE : EnemyState.FLEE;
      enemy.color = "#bb77ee";
      return;
    }

    enemy.state = EnemyState.CAST;
    enemy.color = "#cc66ff";
    return;
  }

  if (visibleTarget && distance < ENEMY_CASTER_PREFERRED_DISTANCE_PIXELS) {
    enemy.state = EnemyState.FLEE;
    enemy.color = "#dd88ff";
    return;
  }

  if (enemy.lastKnownPlayerPosition) {
    enemy.state = EnemyState.CHASE;
    enemy.color = "#cc66ff";

    if (!visibleTarget && getDistance(enemy, enemy.lastKnownPlayerPosition) <= ENEMY_LOST_TARGET_DISTANCE) {
      forgetPlayer(enemy);
    }
    return;
  }

  enemy.state = EnemyState.IDLE;
  enemy.color = "#664488";
}


function updateDragonState(enemy, visibleTarget, distance) {
  if (canDragonUseBreath(enemy, visibleTarget, distance)) {
    if (!hasCasterWallClearance(enemy)) {
      enemy.tacticalTargetPosition = findCasterClearancePoint(enemy, visibleTarget);
      enemy.state = enemy.tacticalTargetPosition ? EnemyState.CHASE : EnemyState.FLEE;
      enemy.color = "#dd5533";
      return;
    }

    enemy.state = EnemyState.CAST;
    enemy.color = "#ff3300";
    startEnemyActionWindup(enemy, "dragon_breath", visibleTarget);
    return;
  }

  if (visibleTarget && isEnemyMeleeInRange(enemy, visibleTarget) && !isOverlappingAnotherEnemy(enemy)) {
    enemy.state = EnemyState.ATTACK;
    enemy.color = "#ff0000";
    return;
  }

  if (enemy.lastKnownPlayerPosition) {
    enemy.state = EnemyState.CHASE;
    enemy.color = "#ff5533";

    if (!visibleTarget && getDistance(enemy, enemy.lastKnownPlayerPosition) <= ENEMY_LOST_TARGET_DISTANCE) {
      forgetPlayer(enemy);
    }
    return;
  }

  enemy.state = EnemyState.IDLE;
  enemy.color = "#884433";
}

function canDragonUseBreath(enemy, target, distanceToTarget) {
  return (
    enemy.kind === "dragon_boss" &&
    Boolean(target) &&
    (enemy.breathCooldown ?? 0) <= 0 &&
    distanceToTarget <= DRAGON_BOSS_BREATH_RANGE_PIXELS &&
    target.hp > 0
  );
}

function canEnemySeeTarget(enemy, target) {
  if (enemy.kind === "centipede_part" && !enemy.isCentipedeHead) {
    return false;
  }

  if (!target || target.hp <= 0 || target.state === EnemyState.DEAD) {
    return false;
  }

  const sightRange = enemy.canCastMagicMissile || enemy.kind === "dragon_boss"
    ? Math.max(ENEMY_MAGIC_MISSILE_RANGE_PIXELS, DRAGON_BOSS_BREATH_RANGE_PIXELS)
    : ENEMY_DETECTION_RANGE_PIXELS;

  if (getDistance(enemy, target) > sightRange) {
    return false;
  }

  if (!isEntityVisibleToPlayer(target, enemy)) {
    return false;
  }

  return hasLineOfSight(enemy, target);
}

function selectVisibleTarget(enemy) {
  const candidates = getEnemyTargetCandidates();
  const visible = candidates.filter((target) => canEnemySeeTarget(enemy, target));

  if (visible.length === 0) {
    return null;
  }

  return visible.sort((a, b) => getTargetPriorityScore(enemy, a) - getTargetPriorityScore(enemy, b))[0];
}

function getEnemyTargetCandidates() {
  return [player, ...merchants.filter((merchant) => {
    return merchant.hp > 0 && merchant.state !== EnemyState.DEAD && !merchant.isHostile;
  })];
}

function getTargetPriorityScore(enemy, target) {
  const distance = getDistance(enemy, target);
  const allyBias = target.isMerchant ? TILE_SIZE * 5 : 0;
  const hiredBias = target.isHired ? TILE_SIZE * 4 : 0;
  return distance - allyBias - hiredBias;
}

function canEnemyCastMagicMissile(enemy, target, distanceToTarget) {
  return (
    Boolean(target) &&
    enemy.canCastMagicMissile &&
    enemy.spellCooldown <= 0 &&
    distanceToTarget <= ENEMY_MAGIC_MISSILE_RANGE_PIXELS &&
    target.hp > 0
  );
}

function getCurrentTargetPosition(enemy) {
  return enemy.lastKnownPlayerPosition ?? { x: player.x, y: player.y };
}

function moveEnemyUsingPath(enemy, target, speed, deltaTime) {
  if (!target) {
    driftAwayFromCrowd(enemy, deltaTime);
    return;
  }

  const pathTarget = getNextPathPoint(enemy, target);
  const baseDirection = pathTarget ? getDirection(enemy, pathTarget) : getDirection(enemy, target);
  const direction = blendWithSeparation(enemy, baseDirection);

  moveEnemyByDirection(enemy, direction, speed, deltaTime);
}

function getNextPathPoint(enemy, target) {
  const targetTile = worldToTile(target);
  const targetTileKey = `${targetTile.row},${targetTile.col}`;

  if (
    !enemy.path ||
    enemy.path.length === 0 ||
    enemy.pathTargetTileKey !== targetTileKey ||
    enemy.pathRecalcRemaining <= 0
  ) {
    enemy.path = findPath(enemy, target, { avoidMerchantSafeZone: true });
    enemy.pathTargetTileKey = targetTileKey;
    enemy.pathRecalcRemaining = ENEMY_PATH_RECALC_INTERVAL;
  }

  while (enemy.path.length > 0 && getDistance(enemy, enemy.path[0]) <= ENEMY_PATH_NODE_REACHED_DISTANCE) {
    enemy.path.shift();
  }

  return enemy.path[0] ?? null;
}

function moveEnemyAwayFromPoint(enemy, point, speed, deltaTime) {
  const baseDirection = getDirection(point, enemy);
  const direction = blendWithSeparation(enemy, baseDirection);
  moveEnemyByDirection(enemy, direction, speed, deltaTime);
}

function driftAwayFromCrowd(enemy, deltaTime) {
  const separation = getSeparationVector(enemy);

  if (separation.x === 0 && separation.y === 0) {
    return;
  }

  moveEnemyByDirection(enemy, separation, ENEMY_SPEED * 0.45, deltaTime);
}

function moveEnemyByDirection(enemy, direction, speed, deltaTime) {
  const normalized = normalizeVector(direction.x, direction.y);

  if (normalized.x === 0 && normalized.y === 0) {
    return;
  }

  const nextX = enemy.x + normalized.x * speed * deltaTime;
  const nextY = enemy.y + normalized.y * speed * deltaTime;

  if (wouldEnterMerchantSafeZone(enemy, nextX, nextY)) {
    return;
  }

  // Los enemigos sólo colisionan con el mapa. Entre ellos pueden sobrepasarse,
  // pero la separación hace que no elijan amontonarse salvo que sea necesario.
  if (enemy.ignoreWallCollision) {
    enemy.x = nextX;
    enemy.y = nextY;
    return;
  }

  const previousX = enemy.x;
  const previousY = enemy.y;
  moveEntityWithCollision(enemy, nextX, nextY);

  if (wouldEnterMerchantSafeZone({ ...enemy, x: previousX, y: previousY }, enemy.x, enemy.y)) {
    enemy.x = previousX;
    enemy.y = previousY;
  }
}

function blendWithSeparation(enemy, baseDirection) {
  const separation = getSeparationVector(enemy);

  return normalizeVector(
    baseDirection.x + separation.x * ENEMY_SEPARATION_STRENGTH,
    baseDirection.y + separation.y * ENEMY_SEPARATION_STRENGTH
  );
}

function getSeparationVector(enemy) {
  let x = 0;
  let y = 0;

  for (const other of enemies) {
    if (other === enemy || other.state === EnemyState.DEAD || other.hp <= 0) {
      continue;
    }

    if (enemy.kind === "centipede_part" && other.kind === "centipede_part" && enemy.centipedeId === other.centipedeId) {
      continue;
    }

    const distance = getDistance(enemy, other);

    if (distance <= 0 || distance > ENEMY_SEPARATION_RANGE_PIXELS) {
      continue;
    }

    const pressure = (ENEMY_SEPARATION_RANGE_PIXELS - distance) / ENEMY_SEPARATION_RANGE_PIXELS;
    x += ((enemy.x - other.x) / distance) * pressure;
    y += ((enemy.y - other.y) / distance) * pressure;
  }

  return normalizeVector(x, y);
}



function initializeCentipedeTrail(centipedeId, parts) {
  const ordered = parts.slice().sort((a, b) => a.segmentIndex - b.segmentIndex);
  const trail = [];

  for (const part of ordered) {
    trail.push({ x: part.x, y: part.y, angle: part.angle });
  }

  // Relleno inicial para que las partes finales ya tengan historia que seguir.
  const tail = ordered[ordered.length - 1];
  if (tail) {
    for (let i = 0; i < CENTIPEDE_SEGMENT_COUNT * 3; i++) {
      trail.push({ x: tail.x, y: tail.y, angle: tail.angle });
    }
  }

  centipedeTrails.set(centipedeId, trail);
}

function recordCentipedeHeadPosition(head) {
  let trail = centipedeTrails.get(head.centipedeId);

  if (!trail) {
    trail = [{ x: head.x, y: head.y, angle: head.angle }];
    centipedeTrails.set(head.centipedeId, trail);
  }

  const previous = trail[0];

  if (!previous || Math.hypot(previous.x - head.x, previous.y - head.y) >= TILE_SIZE * 0.08) {
    trail.unshift({ x: head.x, y: head.y, angle: head.angle });
  } else if (previous) {
    previous.x = head.x;
    previous.y = head.y;
    previous.angle = head.angle;
  }

  trimCentipedeTrail(head.centipedeId);
}

function trimCentipedeTrail(centipedeId) {
  const trail = centipedeTrails.get(centipedeId);

  if (!trail || trail.length < 2) {
    return;
  }

  const maxDistance = CENTIPEDE_SEGMENT_SPACING * (CENTIPEDE_SEGMENT_COUNT + 4);
  let accumulated = 0;

  for (let i = 1; i < trail.length; i++) {
    accumulated += Math.hypot(trail[i - 1].x - trail[i].x, trail[i - 1].y - trail[i].y);

    if (accumulated > maxDistance) {
      trail.splice(i + 1);
      return;
    }
  }
}

function getCentipedeTrailPoint(centipedeId, distanceBehindHead) {
  const trail = centipedeTrails.get(centipedeId);

  if (!trail || trail.length === 0) {
    return null;
  }

  if (distanceBehindHead <= 0 || trail.length === 1) {
    return trail[0];
  }

  let accumulated = 0;

  for (let i = 1; i < trail.length; i++) {
    const from = trail[i - 1];
    const to = trail[i];
    const segmentDistance = Math.hypot(from.x - to.x, from.y - to.y);

    if (segmentDistance <= 0) {
      continue;
    }

    if (accumulated + segmentDistance >= distanceBehindHead) {
      const t = (distanceBehindHead - accumulated) / segmentDistance;
      return {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
        angle: Math.atan2(from.y - to.y, from.x - to.x),
      };
    }

    accumulated += segmentDistance;
  }

  return trail[trail.length - 1];
}

function rebuildCentipedeTrailFromParts(centipedeId) {
  const parts = enemies
    .filter((part) => part.kind === "centipede_part" && part.centipedeId === centipedeId && part.hp > 0 && part.state !== EnemyState.DEAD)
    .sort((a, b) => a.segmentIndex - b.segmentIndex);

  if (parts.length === 0) {
    centipedeTrails.delete(centipedeId);
    return;
  }

  initializeCentipedeTrail(centipedeId, parts);
}

function spawnCentipede(x, y) {
  const template = getTemplateByKind("centipede");
  const angle = Math.random() * Math.PI * 2;
  const centipedeId = nextCentipedeChainId++;
  const parts = [];

  for (let i = 0; i < CENTIPEDE_SEGMENT_COUNT; i++) {
    parts.push(createCentipedePart({
      template,
      centipedeId,
      segmentIndex: i,
      x: x - Math.cos(angle) * CENTIPEDE_SEGMENT_SPACING * i,
      y: y - Math.sin(angle) * CENTIPEDE_SEGMENT_SPACING * i,
      angle,
    }));
  }

  enemies.push(...parts);
  initializeCentipedeTrail(centipedeId, parts);
  return parts;
}

function createCentipedePart({ template, centipedeId, segmentIndex, x, y, angle }) {
  const id = nextEnemyId++;
  const isHead = segmentIndex === 0;

  return {
    id,
    kind: "centipede_part",
    centipedeId,
    segmentIndex,
    isCentipedeHead: isHead,
    name: isHead ? `Ciempiés ${centipedeId} cabeza` : `Ciempiés ${centipedeId} segmento ${segmentIndex + 1}`,
    portraitKey: template.portraitKey,
    portraitName: template.portraitName,
    x,
    y,
    radius: TILE_SIZE * 0.32,
    drawSize: isHead ? TILE_SIZE * 0.9 : TILE_SIZE * 0.72,
    char: isHead ? template.char : "o",
    baseColor: template.color,
    color: isHead ? template.color : "#5fa845",
    hp: template.hp,
    maxHp: template.maxHp,
    attackCooldown: isHead ? Math.random() * 0.75 : 0,
    spellCooldown: 0,
    breathCooldown: 0,
    actionWindupType: null,
    actionWindupRemaining: 0,
    canCastMagicMissile: false,
    hasSeenPlayer: false,
    lastKnownPlayerPosition: null,
    path: [],
    pathTargetTileKey: null,
    pathRecalcRemaining: 0,
    state: EnemyState.IDLE,
    angle,
    ignoreWallCollision: true,
  };
}

function updateCentipedePart(enemy, visibleTarget, deltaTime) {
  enemy.ignoreWallCollision = true;

  if (enemy.isCentipedeHead) {
    updateCentipedeHead(enemy, visibleTarget, deltaTime);
    return;
  }

  updateCentipedeBodyPart(enemy, deltaTime);
}

function updateCentipedeHead(enemy, visibleTarget, deltaTime) {
  if (!enemy.hasSeenPlayer && !visibleTarget) {
    enemy.state = EnemyState.IDLE;
    enemy.color = "#446633";
    return;
  }

  const target = visibleTarget ?? enemy.currentTarget ?? player;

  if (visibleTarget && isEnemyMeleeInRange(enemy, target) && enemy.attackCooldown <= 0) {
    enemy.state = EnemyState.ATTACK;
    enemy.color = "#99ee66";
    startEnemyActionWindup(enemy, "attack", target);
    return;
  }

  const moveTarget = enemy.lastKnownPlayerPosition ?? target;
  turnCentipedeToward(enemy, moveTarget, deltaTime);
  const nextX = enemy.x + Math.cos(enemy.angle) * CENTIPEDE_SPEED * deltaTime;
  const nextY = enemy.y + Math.sin(enemy.angle) * CENTIPEDE_SPEED * deltaTime;

  if (!wouldEnterMerchantSafeZone(enemy, nextX, nextY)) {
    enemy.x = nextX;
    enemy.y = nextY;
  } else {
    enemy.angle += Math.PI * 0.75 * deltaTime;
  }

  recordCentipedeHeadPosition(enemy);

  enemy.state = EnemyState.CHASE;
  enemy.color = "#79cc55";

  if (!visibleTarget && enemy.lastKnownPlayerPosition && getDistance(enemy, enemy.lastKnownPlayerPosition) <= ENEMY_LOST_TARGET_DISTANCE) {
    forgetPlayer(enemy);
  }
}

function updateCentipedeBodyPart(enemy, deltaTime) {
  const previous = getPreviousCentipedePart(enemy);

  if (!previous) {
    promoteCentipedePartToHead(enemy);
    rebuildCentipedeTrailFromParts(enemy.centipedeId);
    updateCentipedeHead(enemy, selectVisibleTarget(enemy), deltaTime);
    return;
  }

  enemy.state = previous.state;
  enemy.hasSeenPlayer = previous.hasSeenPlayer;
  enemy.lastKnownPlayerPosition = previous.lastKnownPlayerPosition ? { ...previous.lastKnownPlayerPosition } : null;
  enemy.color = "#5fa845";

  const trailPoint = getCentipedeTrailPoint(enemy.centipedeId, enemy.segmentIndex * CENTIPEDE_SEGMENT_SPACING);

  if (!trailPoint) {
    return;
  }

  // Movimiento transferido: cada segmento ocupa una posición histórica de la cabeza,
  // como la viborita/Snake. Así las partes finales nunca quedan inmóviles.
  if (!wouldEnterMerchantSafeZone(enemy, trailPoint.x, trailPoint.y)) {
    enemy.x = trailPoint.x;
    enemy.y = trailPoint.y;
  }

  enemy.angle = trailPoint.angle ?? Math.atan2(previous.y - enemy.y, previous.x - enemy.x);
}

function getPreviousCentipedePart(enemy) {
  return enemies.find((candidate) => {
    return (
      candidate.kind === "centipede_part" &&
      candidate.centipedeId === enemy.centipedeId &&
      candidate.segmentIndex === enemy.segmentIndex - 1 &&
      candidate.hp > 0 &&
      candidate.state !== EnemyState.DEAD
    );
  }) ?? null;
}

function promoteCentipedePartToHead(enemy) {
  enemy.isCentipedeHead = true;
  enemy.segmentIndex = 0;
  enemy.char = "c";
  enemy.drawSize = TILE_SIZE * 0.9;
  enemy.name = `Ciempiés ${enemy.centipedeId} cabeza`;
  enemy.attackCooldown = Math.max(enemy.attackCooldown ?? 0, 0.25);
  enemy.color = "#79cc55";
}

function splitCentipedeOnDeath(deadPart) {
  if (deadPart.kind !== "centipede_part") {
    return;
  }

  const livingParts = enemies
    .filter((part) => {
      return (
        part.kind === "centipede_part" &&
        part.centipedeId === deadPart.centipedeId &&
        part !== deadPart &&
        part.hp > 0 &&
        part.state !== EnemyState.DEAD
      );
    })
    .sort((a, b) => a.segmentIndex - b.segmentIndex);

  const frontParts = livingParts.filter((part) => part.segmentIndex < deadPart.segmentIndex);
  const rearParts = livingParts.filter((part) => part.segmentIndex > deadPart.segmentIndex);

  reindexCentipedeChain(frontParts, deadPart.centipedeId);

  if (rearParts.length > 0) {
    const newRearId = nextCentipedeChainId++;
    reindexCentipedeChain(rearParts, newRearId);
    rebuildCentipedeTrailFromParts(newRearId);
  }

  rebuildCentipedeTrailFromParts(deadPart.centipedeId);
}

function reindexCentipedeChain(parts, centipedeId) {
  parts
    .sort((a, b) => a.segmentIndex - b.segmentIndex)
    .forEach((part, index) => {
      part.centipedeId = centipedeId;
      part.segmentIndex = index;
      part.isCentipedeHead = index === 0;
      part.char = index === 0 ? "c" : "o";
      part.drawSize = index === 0 ? TILE_SIZE * 0.9 : TILE_SIZE * 0.72;
      part.name = index === 0 ? `Ciempiés ${centipedeId} cabeza` : `Ciempiés ${centipedeId} segmento ${index + 1}`;
      part.color = index === 0 ? "#79cc55" : "#5fa845";

      if (index === 0) {
        part.attackCooldown = Math.max(part.attackCooldown ?? 0, 0.35);
        part.actionWindupType = null;
        part.actionWindupRemaining = 0;
      } else {
        part.actionWindupType = null;
        part.actionWindupRemaining = 0;
      }
    });
}

function turnCentipedeToward(enemy, target, deltaTime) {
  const desiredAngle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
  const angleDelta = normalizeAngle(desiredAngle - enemy.angle);
  const applied = Math.max(-CENTIPEDE_TURN_SPEED * deltaTime, Math.min(CENTIPEDE_TURN_SPEED * deltaTime, angleDelta));
  enemy.angle += applied;
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}


function isEnemyMeleeInRange(enemy, target = enemy.currentTarget ?? player) {
  if (!target) {
    return false;
  }

  if (enemy.kind === "dragon_boss") {
    return getDistance(enemy, target) <= enemy.radius + target.radius + TILE_SIZE * 0.75;
  }

  if (enemy.kind === "centipede_part") {
    return enemy.isCentipedeHead && getDistance(enemy, target) <= enemy.radius + target.radius + TILE_SIZE * 0.45;
  }

  return isInAttackRange(enemy, target);
}

function enemyAttack(enemy) {
  if (enemy.attackCooldown > 0) {
    return;
  }

  const target = selectVisibleTarget(enemy) ?? enemy.currentTarget;
  startEnemyActionWindup(enemy, "attack", target);
}

function resolveEnemyAttack(enemy, target = enemy.currentTarget) {
  if (!target || target.hp <= 0 || target.state === EnemyState.DEAD) {
    return;
  }

  if (!isEnemyMeleeInRange(enemy, target)) {
    return;
  }

  if (!canEnemySeeTarget(enemy, target)) {
    return;
  }

  if (isOverlappingAnotherEnemy(enemy)) {
    gameState.message = `${enemy.name} intenta golpear, pero está cruzándose con otro enemigo.`;
    return;
  }

  const damage = getEnemyMeleeDamage(enemy);
  target.hp = Math.max(0, target.hp - damage);
  enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;

  if (target.hp <= 0) {
    gameState.message = `${enemy.name} golpea a ${getTargetDisplayName(target)} por ${damage} de daño. ${getTargetDisplayName(target)} cae.`;
    return;
  }

  gameState.message = `${enemy.name} golpea a ${getTargetDisplayName(target)} por ${damage} de daño.`;
}

function enemyCastMagicMissile(enemy) {
  if (enemy.spellCooldown > 0) {
    return;
  }

  const target = selectVisibleTarget(enemy) ?? enemy.currentTarget;

  if (!target || target.hp <= 0) {
    return;
  }

  if (!hasCasterWallClearance(enemy)) {
    enemy.tacticalTargetPosition = findCasterClearancePoint(enemy, target);
    enemy.state = EnemyState.CHASE;
    return;
  }

  startEnemyActionWindup(enemy, "magic_missile", target);
}

function resolveEnemyMagicMissile(enemy, target = enemy.currentTarget) {
  if (!target || !canEnemySeeTarget(enemy, target)) {
    return;
  }

  const spawned = spawnMagicMissileVolley(enemy, target);

  if (!spawned) {
    return;
  }

  enemy.spellCooldown = ENEMY_SPELL_COOLDOWN;
  gameState.message = `${enemy.name} conjura Misil mágico contra ${getTargetDisplayName(target)}.`;
}



function resolveDragonBreath(enemy, target = enemy.currentTarget) {
  if (!target || !canEnemySeeTarget(enemy, target)) {
    return;
  }

  const direction = getDirection(enemy, target);
  const damageRolls = rollMany(DRAGON_BOSS_BREATH_DAMAGE_DICE, DRAGON_BOSS_BREATH_DAMAGE_DIE);
  const damage = damageRolls.reduce((sum, roll) => sum + roll, 0);

  spawnDragonBreathFlames(enemy, direction);
  enemy.breathCooldown = DRAGON_BOSS_BREATH_COOLDOWN;

  const targets = getEnemyTargetCandidates().filter((candidate) => {
    return candidate.hp > 0 &&
      isPointInCone(enemy, direction, candidate, DRAGON_BOSS_BREATH_RANGE_PIXELS, DRAGON_BOSS_BREATH_CONE_ANGLE_RADIANS) &&
      hasLineOfSight(enemy, candidate);
  });

  if (targets.length === 0) {
    gameState.message = `${enemy.name} exhala una llamarada mayor, pero no alcanza a nadie.`;
    return;
  }

  for (const candidate of targets) {
    candidate.hp = Math.max(0, candidate.hp - damage);
  }

  gameState.message = `${enemy.name} exhala una llamarada mayor. Afecta a ${targets.map(getTargetDisplayName).join(", ")} por ${damage} de daño (${damageRolls.join(" + ")}).`;
}


function hasCasterWallClearance(entity) {
  return !hasWallNearPoint(entity, 1);
}

function findCasterClearancePoint(entity, target) {
  const originTile = worldToTile(entity);
  let best = null;
  let bestScore = Infinity;

  for (let radius = 1; radius <= 6; radius++) {
    for (let row = originTile.row - radius; row <= originTile.row + radius; row++) {
      for (let col = originTile.col - radius; col <= originTile.col + radius; col++) {
        if (isWallAt(row, col)) {
          continue;
        }

        const point = { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE + TILE_SIZE / 2 };

        if (isPointInMerchantSafeZone(point)) {
          continue;
        }

        if (hasWallNearPoint(point, 1)) {
          continue;
        }

        if (target && getDistance(point, target) > ENEMY_MAGIC_MISSILE_RANGE_PIXELS) {
          continue;
        }

        if (target && !hasLineOfSight(point, target)) {
          continue;
        }

        const score = getDistance(entity, point) + (target ? Math.abs(getDistance(point, target) - ENEMY_CASTER_PREFERRED_DISTANCE_PIXELS) * 0.15 : 0);

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

function wouldEnterMerchantSafeZone(enemy, nextX, nextY) {
  const currentInside = isPointInMerchantSafeZone(enemy);
  const nextInside = isPointInMerchantSafeZone({ x: nextX, y: nextY });
  return nextInside && !currentInside;
}

function getTargetDisplayName(target) {
  if (!target) {
    return "nadie";
  }

  if (target === player) {
    return "ti";
  }

  return target.name ?? "objetivo";
}

function getEnemyMeleeDamage(enemy) {
  if (enemy.kind === "dragon_boss") {
    return DRAGON_BOSS_MELEE_DAMAGE;
  }

  if (enemy.kind === "centipede_part") {
    return CENTIPEDE_ATTACK_DAMAGE;
  }

  return ENEMY_ATTACK_DAMAGE;
}

function rollMany(count, die) {
  const rolls = [];

  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(die));
  }

  return rolls;
}

function startEnemyActionWindup(enemy, type, target = enemy.currentTarget ?? null) {
  if (enemy.actionWindupType) {
    return;
  }

  enemy.actionWindupType = type;
  enemy.actionWindupTarget = target;
  enemy.actionWindupRemaining = ENEMY_ACTION_CAST_TIME;
  enemy.color = type === "magic_missile" ? "#ff99ff" : "#ff7777";

  if (type === "magic_missile") {
    gameState.message = `${enemy.name} empieza a conjurar Misil mágico contra ${getTargetDisplayName(target)}.`;
  } else if (type === "dragon_breath") {
    gameState.message = `${enemy.name} toma aire y prepara una llamarada mayor.`;
  } else {
    gameState.message = `${enemy.name} prepara un ataque.`;
  }
}

function updateEnemyActionWindup(enemy, visibleTarget) {
  if (!enemy.actionWindupType) {
    return false;
  }

  const type = enemy.actionWindupType;
  const target = enemy.actionWindupTarget ?? visibleTarget ?? enemy.currentTarget;

  if (enemy.actionWindupRemaining > 0) {
    enemy.state = type === "magic_missile" || type === "dragon_breath" ? EnemyState.CAST : EnemyState.ATTACK;
    return true;
  }

  enemy.actionWindupType = null;
  enemy.actionWindupTarget = null;

  if (type === "magic_missile") {
    if (target && enemy.spellCooldown <= 0) {
      resolveEnemyMagicMissile(enemy, target);
    }
    return true;
  }

  if (type === "dragon_breath") {
    if (target && (enemy.breathCooldown ?? 0) <= 0) {
      resolveDragonBreath(enemy, target);
    }
    return true;
  }

  if (target && enemy.attackCooldown <= 0) {
    resolveEnemyAttack(enemy, target);
  }

  return true;
}

function isOverlappingAnotherEnemy(enemy) {
  return enemies.some((other) => {
    if (other === enemy || other.state === EnemyState.DEAD || other.hp <= 0) {
      return false;
    }

    if (enemy.kind === "centipede_part" && other.kind === "centipede_part" && enemy.centipedeId === other.centipedeId) {
      return false;
    }

    return getDistance(enemy, other) < (enemy.radius + other.radius) * 0.9;
  });
}

function forgetPlayer(enemy) {
  enemy.hasSeenPlayer = false;
  enemy.lastKnownPlayerPosition = null;
  enemy.path = [];
  enemy.pathTargetTileKey = null;
}

export function killEnemy(enemy) {
  if (!enemy || enemy.deathProcessed) {
    return;
  }

  enemy.deathProcessed = true;
  enemy.hp = 0;
  enemy.state = EnemyState.DEAD;
  enemy.char = "%";
  enemy.color = "#777777";
  enemy.actionWindupType = null;
  enemy.actionWindupRemaining = 0;

  if (enemy.kind === "centipede_part") {
    splitCentipedeOnDeath(enemy);
  }
}


function shouldSpawnDragonBoss(room, difficulty) {
  const floorTiles = Math.max(0, room.width - 2) * Math.max(0, room.height - 2);
  const eligibleDifficulty = difficulty === "boss" || difficulty === "deadly";
  return eligibleDifficulty && floorTiles >= DRAGON_BOSS_ROOM_MIN_FLOOR_TILES && Math.random() < DRAGON_BOSS_SPAWN_CHANCE;
}

function shouldSpawnCentipede(difficulty) {
  const eligibleDifficulty = difficulty === "medium" || difficulty === "hard" || difficulty === "deadly" || difficulty === "boss";
  return eligibleDifficulty && Math.random() < CENTIPEDE_SPAWN_CHANCE;
}

function getTemplateByKind(kind) {
  return enemyTemplates.find((template) => template.kind === kind) ?? enemyTemplates[0];
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

export function cancelEnemySpellcasting(enemy) {
  if (!enemy || enemy.hp <= 0 || enemy.state === EnemyState.DEAD) {
    return false;
  }

  const counterableTypes = new Set(["magic_missile", "dragon_breath"]);

  if (!counterableTypes.has(enemy.actionWindupType)) {
    return false;
  }

  const interruptedType = enemy.actionWindupType;

  enemy.actionWindupType = null;
  enemy.actionWindupRemaining = 0;
  enemy.state = EnemyState.IDLE;

  if (interruptedType === "magic_missile") {
    enemy.spellCooldown = ENEMY_SPELL_COOLDOWN;
  }

  if (interruptedType === "dragon_breath") {
    enemy.breathCooldown = DRAGON_BOSS_BREATH_COOLDOWN;
  }

  enemy.color = enemy.canCastMagicMissile ? "#664488" : enemy.kind === "dragon_boss" ? "#b33a1f" : "#884444";
  return true;
}
