import {
  BURNING_HANDS_DAMAGE_DICE,
  BURNING_HANDS_DAMAGE_DIE,
  BURNING_HANDS_RANGE_FEET,
  COUNTERSPELL_RANGE_PIXELS,
  CHROMATIC_ORB_DAMAGE_DICE,
  CHROMATIC_ORB_DAMAGE_DIE,
  CHROMATIC_ORB_RANGE_FEET,
  CHROMATIC_ORB_RANGE_PIXELS,
  FIREBALL_DAMAGE_DELAY,
  FIREBALL_DAMAGE_DICE,
  FIREBALL_DAMAGE_DIE,
  FIREBALL_RADIUS_FEET,
  FIREBALL_RADIUS_PIXELS,
  FIREBALL_RANGE_PIXELS,
  FIRE_BOLT_DAMAGE_DICE,
  FIRE_BOLT_DAMAGE_DIE,
  FIRE_BOLT_RANGE_FEET,
  FIRE_BOLT_RANGE_PIXELS,
  DANCING_LIGHTS_RANGE_FEET,
  DANCING_LIGHTS_RANGE_PIXELS,
  DANCING_LIGHTS_COUNT,
  SHOCKING_GRASP_RANGE_FEET,
  SHOCKING_GRASP_RANGE_PIXELS,
  SHOCKING_GRASP_INACTIVE_DURATION,
  SHOCKING_GRASP_DAMAGE_DICE,
  SHOCKING_GRASP_DAMAGE_DIE,
  FALSE_LIFE_TEMP_HP_DICE,
  FALSE_LIFE_TEMP_HP_DIE,
  FALSE_LIFE_TEMP_HP_BONUS,
  FALSE_LIFE_DURATION,
  EXPEDITIOUS_RETREAT_DURATION,
  HEALING_WORD_RANGE_FEET,
  HEALING_WORD_RANGE_PIXELS,
  SHIELD_DURATION,
  WALL_OF_FORCE_DURATION,
  WALL_OF_FORCE_PUSH_PIXELS,
  WALL_OF_FORCE_RANGE_PIXELS,
  VORTEX_WARP_RANGE_PIXELS,
  TILE_SIZE,
  SPELL_COOLDOWN,
} from "../../config/constants.js";

import { ActionType, EnemyState, gameState } from "../../engine/state/gameState.js";
import { player } from "../creatures/player.js";
import { cancelEnemySpellcasting, enemies, killEnemy } from "../creatures/enemy.js";
import { merchants } from "../creatures/merchant.js";
import { companions } from "../companions/companions.js";
import { rollDie } from "../../engine/rules/dice.js";
import { consumeFireballDetonations, spawnBurningHandsFlames, spawnChromaticOrbShot, clearDancingLightsForCaster, getDancingLights, spawnDancingLights, spawnFireballVisual, spawnFireBoltShotAtPoint, spawnMagicMissileVolley } from "../../engine/projectiles/projectileSystem.js";
import { MAGIC_MISSILE_RANGE_PIXELS } from "../../config/constants.js";
import { addTemporaryWall, clearTemporaryWalls, getTemporaryWalls, isStaticWallAt } from "../../engine/world/map.js";
import { canPlaceEntityAt, getDistance, getSurfaceDistance, normalizeVector } from "../../engine/world/collision.js";
import { getWallOfForceTiles, isPointInBurningHandsCone } from "./spellGeometry.js";
import { getSpellDefinitionByActionType } from "./spellDefinitions.js";

const pendingSpellEffects = [];


export function isConcentrationSpell(spell) {
  return Boolean(getSpellDefinitionByActionType(spell)?.concentration);
}

export function endConcentration(caster = player, reason = "manual") {
  if (!caster?.concentration?.spell) {
    return false;
  }

  const previousSpell = caster.concentration.spell;
  cleanupConcentrationEffect(caster, previousSpell);
  caster.concentration = null;

  if (caster === player) {
    const previousName = getSpellDefinitionByActionType(previousSpell)?.name ?? "conjuro";
    if (reason === "replaced") {
      gameState.infoMessage = gameState.infoMessage || `Concentración anterior finalizada: ${previousName}.`;
    }
  }

  return true;
}

function beginConcentration(caster, spell) {
  if (!isConcentrationSpell(spell)) {
    return;
  }

  const previousSpell = caster?.concentration?.spell ?? null;
  if (previousSpell && previousSpell !== spell) {
    endConcentration(caster, "replaced");
  }

  const definition = getSpellDefinitionByActionType(spell);
  caster.concentration = {
    spell,
    spellId: definition?.id ?? null,
    name: definition?.name ?? "Conjuro",
    startedAt: gameState.elapsedTime ?? 0,
  };
}


function synchronizeConcentrationState(caster) {
  const spell = caster?.concentration?.spell;
  if (!spell) {
    return;
  }

  if (spell === ActionType.CAST_DANCING_LIGHTS) {
    const hasLivingLights = getDancingLights().some((light) => light.caster === caster);
    if (!hasLivingLights) caster.concentration = null;
    return;
  }

  if (spell === ActionType.CAST_WALL_OF_FORCE) {
    if (getTemporaryWalls().length === 0) caster.concentration = null;
    return;
  }

  if (spell === ActionType.CAST_EXPEDITIOUS_RETREAT && (caster.expeditiousRetreatRemaining ?? 0) <= 0) {
    caster.concentration = null;
  }
}

function cleanupConcentrationEffect(caster, spell) {
  if (spell === ActionType.CAST_DANCING_LIGHTS) {
    clearDancingLightsForCaster(caster);
    return;
  }

  if (spell === ActionType.CAST_WALL_OF_FORCE) {
    clearTemporaryWalls();
    return;
  }

  if (spell === ActionType.CAST_EXPEDITIOUS_RETREAT) {
    caster.expeditiousRetreatRemaining = 0;
  }
}

export function updateSpellEffects(deltaTime) {
  for (const detonation of consumeFireballDetonations()) {
    resolveFireballDamage(detonation);
  }

  for (const effect of pendingSpellEffects) {
    effect.remaining = Math.max(0, effect.remaining - deltaTime);
  }

  for (let i = pendingSpellEffects.length - 1; i >= 0; i--) {
    const effect = pendingSpellEffects[i];

    if (effect.remaining > 0) {
      continue;
    }

    pendingSpellEffects.splice(i, 1);
    resolvePendingSpellEffect(effect);
  }

  synchronizeConcentrationState(player);
}

export function resolveSpell(spell, options = {}) {
  if (spell === ActionType.CAST_CURE_WOUNDS) {
    resolveCureWounds(options);
    return;
  }

  if (spell === ActionType.CAST_TIME_STOP) {
    resolveTimeStop();
    return;
  }

  if (spell === ActionType.CAST_MAGIC_MISSILE) {
    resolveMagicMissile(options);
    return;
  }

  if (spell === ActionType.CAST_BURNING_HANDS) {
    resolveBurningHands(options);
    return;
  }

  if (spell === ActionType.CAST_SHIELD) {
    resolveShield(options);
    return;
  }

  if (spell === ActionType.CAST_WALL_OF_FORCE) {
    resolveWallOfForce(options);
    return;
  }

  if (spell === ActionType.CAST_FIREBALL) {
    resolveFireball(options);
    return;
  }

  if (spell === ActionType.CAST_VORTEX_WARP) {
    resolveVortexWarp(options);
    return;
  }

  if (spell === ActionType.CAST_COUNTERSPELL) {
    resolveCounterspell(options);
    return;
  }

  if (spell === ActionType.CAST_FIRE_BOLT) {
    resolveFireBolt(options);
    return;
  }

  if (spell === ActionType.CAST_DANCING_LIGHTS) {
    resolveDancingLights(options);
    return;
  }

  if (spell === ActionType.CAST_SHOCKING_GRASP) {
    resolveShockingGrasp(options);
    return;
  }

  if (spell === ActionType.CAST_FALSE_LIFE) {
    resolveFalseLife(options);
    return;
  }

  if (spell === ActionType.CAST_EXPEDITIOUS_RETREAT) {
    resolveExpeditiousRetreat(options);
    return;
  }

  if (spell === ActionType.CAST_CHROMATIC_ORB) {
    resolveChromaticOrb(options);
  }
}

function resolveCureWounds(options = {}) {
  const caster = options.caster ?? player;
  const target = findLivingCreature(options.targetId) ?? player;

  if (getSurfaceDistance(caster, target) > HEALING_WORD_RANGE_PIXELS) {
    gameState.message = `Sanar heridas falla: el objetivo está fuera de ${HEALING_WORD_RANGE_FEET} pies.`;
    return;
  }

  const healing = rollDie(8);
  const previousHp = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + healing);

  const healedAmount = target.hp - previousHp;
  const targetName = target === player ? "ti" : target.name;

  gameState.message = `Sanar heridas se completa sobre ${targetName}. Recupera ${healedAmount} PG. Tirada: 1d8 = ${healing}.`;
}

function resolveTimeStop() {
  const d4 = rollDie(4);
  const duration = (d4 + 1) * 6;

  gameState.timeStopRemaining = duration;

  gameState.message = `Detener el tiempo se completa. Tirada: 1d4 = ${d4}. El tiempo se detiene ${duration} segundos para todos menos para ti.`;
}

function resolveMagicMissile(options) {
  const caster = options.caster ?? player;
  const target = findMagicMissileTarget(options.targetId);

  if (!target) {
    gameState.message = "Misil mágico falla: no hay objetivo válido.";
    return;
  }

  if (getSurfaceDistance(caster, target) > MAGIC_MISSILE_RANGE_PIXELS) {
    gameState.message = `${target.name} está fuera del rango de Misil mágico.`;
    return;
  }

  spawnMagicMissileVolley(caster, target);
  gameState.message = `Misil mágico se completa. Tres misiles persiguen a ${target.name}.`;
}

function resolveBurningHands(options) {
  const caster = options.caster ?? player;
  const direction = normalizeVector(options.aimDirection?.x ?? 0, options.aimDirection?.y ?? 0);

  if (direction.x === 0 && direction.y === 0) {
    gameState.message = "Manos ardientes falla: no hay dirección válida.";
    return;
  }

  const damageRolls = rollMany(BURNING_HANDS_DAMAGE_DICE, BURNING_HANDS_DAMAGE_DIE);
  const damage = damageRolls.reduce((sum, roll) => sum + roll, 0);

  const flameOrigin = {
    x: caster.x,
    y: caster.y,
    radius: caster.radius,
  };

  const spawned = spawnBurningHandsFlames(flameOrigin, direction, getLivingEnemies());

  pendingSpellEffects.push({
    kind: "burning_hands_damage",
    remaining: 1,
    caster: flameOrigin,
    direction,
    damage,
    damageRolls,
  });

  gameState.message = spawned
    ? `Manos ardientes se lanza. Las llamas se expanden y el daño se aplicará en 1 segundo. Tirada preparada: ${formatRolls(damageRolls)} = ${damage}.`
    : "Manos ardientes falla: no se pudo crear el efecto visual.";
}

function resolveShield(options = {}) {
  const caster = options.caster ?? player;
  const target = findLivingCreature(options.targetId) ?? caster;

  if (getSurfaceDistance(caster, target) > HEALING_WORD_RANGE_PIXELS) {
    gameState.message = `Escudo falla: el objetivo está fuera de ${HEALING_WORD_RANGE_FEET} pies.`;
    return;
  }

  target.shieldRemaining = SHIELD_DURATION;
  target.shieldHp = target.maxHp ?? target.hp ?? 1;
  const targetName = target === player ? "ti" : target.name;
  gameState.message = `Escudo envuelve a ${targetName}. Bloquea hasta ${target.shieldHp} de daño durante ${SHIELD_DURATION}s.`;
}

function resolveWallOfForce(options) {
  const caster = options.caster ?? player;
  const point = options.boardPoint;

  if (!point) {
    gameState.message = "Muro de fuerza falla: no hay punto elegido.";
    return;
  }

  if (getDistance(caster, point) > WALL_OF_FORCE_RANGE_PIXELS) {
    gameState.message = "Muro de fuerza falla: el punto está fuera de rango.";
    return;
  }

  const wallTiles = getWallOfForceTiles(caster, point);
  const placedTiles = [];

  for (const tile of wallTiles) {
    if (isStaticWallAt(tile.row, tile.col)) {
      continue;
    }

    if (addTemporaryWall(tile.row, tile.col, WALL_OF_FORCE_DURATION)) {
      placedTiles.push(tile);
    }
  }

  if (placedTiles.length === 0) {
    gameState.message = "Muro de fuerza falla: no hay espacio válido para crear el muro.";
    return;
  }

  beginConcentration(caster, ActionType.CAST_WALL_OF_FORCE);
  pushEnemiesOutOfWall(placedTiles, caster);
  gameState.message = `Muro de fuerza se completa. ${placedTiles.length} bloques amarillos alineados a la grilla duran ${WALL_OF_FORCE_DURATION} segundos.`;
}


function resolveFireball(options) {
  const caster = options.caster ?? player;
  const point = options.boardPoint;

  if (!point) {
    gameState.message = "Bola de fuego falla: no hay punto elegido.";
    return;
  }

  if (getDistance(caster, point) > FIREBALL_RANGE_PIXELS) {
    gameState.message = "Bola de fuego falla: el punto está fuera de rango.";
    return;
  }

  const damageRolls = rollMany(FIREBALL_DAMAGE_DICE, FIREBALL_DAMAGE_DIE);
  const damage = damageRolls.reduce((sum, roll) => sum + roll, 0);

  const launched = spawnFireballVisual(caster, point, {
    damage,
    damageRolls,
  });

  if (!launched) {
    gameState.message = "Bola de fuego falla: no se pudo formar la esfera de fuego.";
    return;
  }

  gameState.message = `Bola de fuego se lanza. La esfera debe llegar al destino o chocar contra una pared para explotar. Tirada preparada: ${formatRolls(damageRolls)} = ${damage}.`;
}

function resolveVortexWarp(options) {
  const caster = options.caster ?? player;
  const target = findLivingCreature(options.targetId);
  const point = options.boardPoint;

  if (!target) {
    gameState.message = "Vortex Warp falla: no hay criatura elegida.";
    return;
  }

  if (!point) {
    gameState.message = "Vortex Warp falla: no hay destino elegido.";
    return;
  }

  if (getSurfaceDistance(caster, target) > VORTEX_WARP_RANGE_PIXELS || getDistance(caster, point) > VORTEX_WARP_RANGE_PIXELS) {
    gameState.message = "Vortex Warp falla: objetivo o destino fuera de 90 pies.";
    return;
  }

  if (!canPlaceEntityAt(target, point.x, point.y)) {
    gameState.message = "Vortex Warp falla: el destino está bloqueado.";
    return;
  }

  target.x = point.x;
  target.y = point.y;
  target.path = [];
  target.pathTargetTileKey = null;
  gameState.message = `Vortex Warp retuerce el espacio y mueve a ${target === player ? "ti" : target.name}.`;
}

function resolveFireBolt(options) {
  const caster = options.caster ?? player;
  const direction = normalizeVector(options.aimDirection?.x ?? 0, options.aimDirection?.y ?? 0);

  if (direction.x === 0 && direction.y === 0) {
    gameState.message = "Saeta de fuego falla: no hay dirección válida.";
    return;
  }

  const point = {
    x: caster.x + direction.x * FIRE_BOLT_RANGE_PIXELS,
    y: caster.y + direction.y * FIRE_BOLT_RANGE_PIXELS,
  };

  const damageRolls = rollMany(FIRE_BOLT_DAMAGE_DICE, FIRE_BOLT_DAMAGE_DIE);
  const damage = damageRolls.reduce((sum, roll) => sum + roll, 0);
  const launched = spawnFireBoltShotAtPoint(caster, point, {
    targets: getLivingEnemies(),
    damage,
    rollText: `${formatRolls(damageRolls)} = ${damage}`,
  });

  if (!launched) {
    gameState.message = "Saeta de fuego falla: no se pudo crear el proyectil.";
    return;
  }

  gameState.message = `Saeta de fuego se lanza como una x ardiente. Alcance ${FIRE_BOLT_RANGE_FEET} pies. Tirada preparada: ${formatRolls(damageRolls)} = ${damage}.`;
}



function resolveDancingLights(options = {}) {
  const caster = options.caster ?? player;
  const followTarget = findLivingCreature(options.targetId);
  const point = followTarget ?? options.boardPoint ?? gameState.mouseWorldPoint;

  if (!point) {
    gameState.message = "Luces danzantes falla: no hay punto elegido.";
    return;
  }

  if (getDistance(caster, point) > DANCING_LIGHTS_RANGE_PIXELS) {
    gameState.message = `Luces danzantes falla: el objetivo está fuera de ${DANCING_LIGHTS_RANGE_FEET} pies.`;
    return;
  }

  const spawned = spawnDancingLights(caster, point, { followTarget });
  if (!spawned) {
    gameState.message = "Luces danzantes falla: no se pudieron invocar los orbes.";
    return;
  }

  beginConcentration(caster, ActionType.CAST_DANCING_LIGHTS);
  gameState.message = followTarget
    ? `Luces danzantes crea ${DANCING_LIGHTS_COUNT} orbes que siguen a ${followTarget.name ?? "la criatura"} durante 60 segundos.`
    : `Luces danzantes crea ${DANCING_LIGHTS_COUNT} orbes de luz durante 60 segundos.`;
}

function resolveShockingGrasp(options = {}) {
  const caster = options.caster ?? player;
  const target = findLivingEnemy(options.targetId);

  if (!target) {
    gameState.message = "Contacto electrizante falla: no hay enemigo válido.";
    return;
  }

  if (getSurfaceDistance(caster, target) > SHOCKING_GRASP_RANGE_PIXELS) {
    gameState.message = `Contacto electrizante falla: el objetivo debe estar a ${SHOCKING_GRASP_RANGE_FEET} pies.`;
    return;
  }

  const rolls = rollMany(SHOCKING_GRASP_DAMAGE_DICE, SHOCKING_GRASP_DAMAGE_DIE);
  const damage = rolls.reduce((sum, roll) => sum + roll, 0);
  target.hp = Math.max(0, target.hp - damage);
  target.inactiveRemaining = Math.max(target.inactiveRemaining ?? 0, SHOCKING_GRASP_INACTIVE_DURATION);
  target.actionWindupType = null;
  target.actionWindupRemaining = 0;
  target.color = "#66ccff";

  if (caster === player) {
    player.spellCooldown = Math.max(player.spellCooldown ?? 0, SPELL_COOLDOWN);
  }

  if (target.hp <= 0) {
    killEnemy(target);
    gameState.message = `Contacto electrizante mata a ${target.name}. Daño: ${formatRolls(rolls)} = ${damage}.`;
    return;
  }

  gameState.message = `Contacto electrizante golpea a ${target.name} por ${damage} e inactiva al objetivo ${SHOCKING_GRASP_INACTIVE_DURATION}s. Tirada: ${formatRolls(rolls)} = ${damage}.`;
}

function resolveFalseLife(options = {}) {
  const caster = options.caster ?? player;
  const target = findLivingCreature(options.targetId) ?? caster;

  if (getSurfaceDistance(caster, target) > HEALING_WORD_RANGE_PIXELS) {
    gameState.message = `Vida falsa falla: el objetivo está fuera de ${HEALING_WORD_RANGE_FEET} pies.`;
    return;
  }

  const rolls = rollMany(FALSE_LIFE_TEMP_HP_DICE, FALSE_LIFE_TEMP_HP_DIE);
  const temporaryHp = rolls.reduce((sum, roll) => sum + roll, 0) + FALSE_LIFE_TEMP_HP_BONUS;
  const previousTemporaryHp = target.temporaryHp ?? 0;
  target.temporaryHp = Math.max(previousTemporaryHp, temporaryHp);
  target.temporaryHpRemaining = Math.max(target.temporaryHpRemaining ?? 0, FALSE_LIFE_DURATION);
  const targetName = target === player ? "ti" : target.name;
  gameState.message = `Vida falsa afecta a ${targetName}: PG temporales ${previousTemporaryHp} → ${target.temporaryHp}. Tirada: ${formatRolls(rolls)} + ${FALSE_LIFE_TEMP_HP_BONUS} = ${temporaryHp}.`;
}

function resolveExpeditiousRetreat(options = {}) {
  const caster = options.caster ?? player;
  caster.expeditiousRetreatRemaining = EXPEDITIOUS_RETREAT_DURATION;
  beginConcentration(caster, ActionType.CAST_EXPEDITIOUS_RETREAT);
  gameState.message = `Retirada expeditiva se activa instantáneamente. Tu velocidad aumenta durante ${EXPEDITIOUS_RETREAT_DURATION}s.`;
}

function resolveChromaticOrb(options) {
  const caster = options.caster ?? player;
  const point = options.boardPoint ?? gameState.mouseWorldPoint;

  if (!point) {
    gameState.message = "Orbe cromático falla: no hay punto inicial.";
    return;
  }

  if (getDistance(caster, point) > CHROMATIC_ORB_RANGE_PIXELS) {
    gameState.message = "Orbe cromático falla: el punto inicial está fuera de rango.";
    return;
  }

  const damageRolls = rollMany(CHROMATIC_ORB_DAMAGE_DICE, CHROMATIC_ORB_DAMAGE_DIE);
  const damage = damageRolls.reduce((sum, roll) => sum + roll, 0);
  const launched = spawnChromaticOrbShot(caster, point, {
    targets: getLivingEnemies(),
    damage,
    rollText: `${formatRolls(damageRolls)} = ${damage}`,
  });

  if (!launched) {
    gameState.message = "Orbe cromático falla: no se pudo formar el orbe.";
    return;
  }

  gameState.message = `Orbe cromático se lanza y seguirá el mouse con inercia. Alcance ${CHROMATIC_ORB_RANGE_FEET} pies. Tirada preparada: ${formatRolls(damageRolls)} = ${damage}.`;
}

function resolveCounterspell(options) {
  const caster = options.caster ?? player;
  const target = findLivingCreature(options.targetId);

  if (!target) {
    gameState.message = "Counterspell falla: no hay usuario de magia elegido.";
    return;
  }

  if (getSurfaceDistance(caster, target) > COUNTERSPELL_RANGE_PIXELS) {
    gameState.message = "Counterspell falla: el objetivo está fuera de 60 pies.";
    return;
  }

  if (!cancelEnemySpellcasting(target)) {
    gameState.message = `${target.name} no está lanzando un efecto mágico que puedas contrarrestar.`;
    return;
  }

  gameState.message = `Counterspell interrumpe la magia de ${target.name} y activa su cooldown de lanzamiento.`;
}

function resolvePendingSpellEffect(effect) {
  if (effect.kind === "burning_hands_damage") {
    resolveBurningHandsDamage(effect);
    return;
  }

  if (effect.kind === "fireball_damage") {
    resolveFireballDamage(effect);
  }
}

function resolveBurningHandsDamage(effect) {
  const affectedEnemies = damageEnemiesInBurningHandsCone(
    effect.caster,
    effect.direction,
    effect.damage
  );

  if (affectedEnemies.length === 0) {
    gameState.message = `Manos ardientes se resuelve. No hay enemigos dentro del cono de ${BURNING_HANDS_RANGE_FEET} pies. Daño: ${formatRolls(effect.damageRolls)} = ${effect.damage}.`;
    return;
  }

  gameState.message = `Manos ardientes se resuelve. ${affectedEnemies.length} enemigo(s) reciben ${effect.damage} de daño. Tirada: ${formatRolls(effect.damageRolls)} = ${effect.damage}.`;
}


function resolveFireballDamage(effect) {
  const affectedEnemies = [];

  for (const enemy of getLivingEnemies()) {
    if (getDistance(effect.point, enemy) > FIREBALL_RADIUS_PIXELS + enemy.radius) {
      continue;
    }

    enemy.hp = Math.max(0, enemy.hp - effect.damage);
    affectedEnemies.push(enemy);

    if (enemy.hp <= 0) {
      killEnemy(enemy);
    }
  }

  if (affectedEnemies.length === 0) {
    gameState.message = `Bola de fuego explota en un radio de ${FIREBALL_RADIUS_FEET} pies. No alcanza enemigos. Daño: ${formatRolls(effect.damageRolls)} = ${effect.damage}.`;
    return;
  }

  gameState.message = `Bola de fuego explota. ${affectedEnemies.length} enemigo(s) reciben ${effect.damage} de daño. Tirada: ${formatRolls(effect.damageRolls)} = ${effect.damage}.`;
}

function damageEnemiesInBurningHandsCone(caster, direction, damage) {
  const affectedEnemies = [];

  for (const enemy of getLivingEnemies()) {
    if (!isPointInBurningHandsCone(caster, direction, enemy)) {
      continue;
    }

    enemy.hp = Math.max(0, enemy.hp - damage);
    affectedEnemies.push(enemy);

    if (enemy.hp <= 0) {
      killEnemy(enemy);
    }
  }

  return affectedEnemies;
}

function rollMany(count, die) {
  const rolls = [];

  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(die));
  }

  return rolls;
}

function formatRolls(rolls) {
  return rolls.join(" + ");
}

function pushEnemiesOutOfWall(placedTiles, caster) {
  const livingEnemies = getLivingEnemies();

  for (const enemy of livingEnemies) {
    const enemyCol = Math.floor(enemy.x / TILE_SIZE);
    const enemyRow = Math.floor(enemy.y / TILE_SIZE);
    const insideWall = placedTiles.some((tile) => tile.row === enemyRow && tile.col === enemyCol);

    if (!insideWall) {
      continue;
    }

    pushEnemyAwayFromCaster(enemy, caster);
  }
}

function pushEnemyAwayFromCaster(enemy, caster) {
  const baseDirection = normalizeVector(enemy.x - caster.x, enemy.y - caster.y);
  const fallbackDirection = baseDirection.x === 0 && baseDirection.y === 0 ? { x: 1, y: 0 } : baseDirection;
  const candidates = [
    fallbackDirection,
    rotateVector(fallbackDirection, Math.PI / 4),
    rotateVector(fallbackDirection, -Math.PI / 4),
    rotateVector(fallbackDirection, Math.PI / 2),
    rotateVector(fallbackDirection, -Math.PI / 2),
    rotateVector(fallbackDirection, Math.PI),
  ];

  for (const direction of candidates) {
    const nextX = enemy.x + direction.x * WALL_OF_FORCE_PUSH_PIXELS;
    const nextY = enemy.y + direction.y * WALL_OF_FORCE_PUSH_PIXELS;

    if (canPlaceEntityAt(enemy, nextX, nextY)) {
      enemy.x = nextX;
      enemy.y = nextY;
      return;
    }
  }
}

function rotateVector(vector, angle) {
  return normalizeVector(
    vector.x * Math.cos(angle) - vector.y * Math.sin(angle),
    vector.x * Math.sin(angle) + vector.y * Math.cos(angle)
  );
}

function findLivingCreature(targetId) {
  if (!targetId || targetId === "player") {
    return player.hp > 0 ? player : null;
  }

  if (typeof targetId === "string" && targetId.startsWith("enemy:")) {
    const id = Number(targetId.slice("enemy:".length));
    return enemies.find((enemy) => enemy.id === id && enemy.state !== EnemyState.DEAD && enemy.hp > 0) ?? null;
  }

  if (typeof targetId === "string" && targetId.startsWith("merchant:")) {
    const id = Number(targetId.slice("merchant:".length));
    return merchants.find((merchant) => merchant.id === id && merchant.hp > 0) ?? null;
  }

  if (typeof targetId === "string" && targetId.startsWith("companion:")) {
    const id = Number(targetId.slice("companion:".length));
    return companions.find((companion) => companion.id === id && companion.hp > 0 && companion.state !== EnemyState.DEAD) ?? null;
  }

  return enemies.find((enemy) => enemy.id === targetId && enemy.state !== EnemyState.DEAD && enemy.hp > 0)
    ?? merchants.find((merchant) => merchant.id === targetId && merchant.hp > 0)
    ?? companions.find((companion) => companion.id === targetId && companion.hp > 0 && companion.state !== EnemyState.DEAD)
    ?? null;
}

function findLivingEnemy(targetId) {
  return enemies.find((enemy) => enemy.id === targetId && enemy.state !== EnemyState.DEAD && enemy.hp > 0) ?? null;
}

function findMagicMissileTarget(targetId) {
  return enemies.find((enemy) => {
    return enemy.id === targetId && enemy.state !== EnemyState.DEAD && enemy.hp > 0;
  });
}

function getLivingEnemies() {
  return enemies.filter((enemy) => enemy.state !== EnemyState.DEAD && enemy.hp > 0);
}
