import {
  TILE_SIZE,
  WALK_SPEED,
  RUN_SPEED,
  SPELL_CAST_TIME,
  SPELL_COOLDOWN,
  DODGE_DISTANCE_PIXELS,
  ARROW_INITIAL_QUANTITY,
} from "./constants.js";

import { getPlayerSpawnPoint } from "./map.js";
import { keys } from "./input.js";
import { canPlaceEntityAt, normalizeVector, moveEntityWithCollision } from "./physics.js";
import { ActionType, gameState } from "./state.js";
import { resolveSpell } from "./spells.js";
import { createInventoryItem, ItemId } from "./items.js";


const SPELL_LEVEL_BY_ACTION = {
  [ActionType.CAST_CURE_WOUNDS]: 1,
  [ActionType.CAST_MAGIC_MISSILE]: 1,
  [ActionType.CAST_BURNING_HANDS]: 1,
  [ActionType.CAST_SHIELD]: 1,
  [ActionType.CAST_VORTEX_WARP]: 2,
  [ActionType.CAST_FIREBALL]: 3,
  [ActionType.CAST_COUNTERSPELL]: 3,
  [ActionType.CAST_FIRE_BOLT]: 0,
  [ActionType.CAST_CHROMATIC_ORB]: 1,
  [ActionType.CAST_WALL_OF_FORCE]: 5,
  [ActionType.CAST_TIME_STOP]: 9,
};

function createWizardLevel20SpellSlots() {
  return {
    1: { max: 4, remaining: 4 },
    2: { max: 3, remaining: 3 },
    3: { max: 3, remaining: 3 },
    4: { max: 3, remaining: 3 },
    5: { max: 3, remaining: 3 },
    6: { max: 2, remaining: 2 },
    7: { max: 2, remaining: 2 },
    8: { max: 1, remaining: 1 },
    9: { max: 1, remaining: 1 },
  };
}

export function getSpellLevel(spell) {
  return SPELL_LEVEL_BY_ACTION[spell] ?? null;
}

export function hasSpellSlotFor(spell) {
  const level = getSpellLevel(spell);

  if (!level) {
    return true;
  }

  return (player.spellSlots?.[level]?.remaining ?? 0) > 0;
}

export function spendSpellSlotFor(spell) {
  const level = getSpellLevel(spell);

  if (!level) {
    return true;
  }

  const slot = player.spellSlots?.[level];

  if (!slot || slot.remaining <= 0) {
    return false;
  }

  slot.remaining -= 1;
  return true;
}

export function getSpellSlotLine(level) {
  const slot = player.spellSlots?.[level];

  if (!slot) {
    return `Nivel ${level}: 0/0`;
  }

  return `Nivel ${level}: ${slot.remaining}/${slot.max}`;
}

export function getSpellSlotSummary() {
  return Object.keys(player.spellSlots ?? {})
    .map(Number)
    .sort((a, b) => a - b)
    .map(getSpellSlotLine)
    .join(' | ');
}

const playerSpawnPoint = getPlayerSpawnPoint();

export const player = {
  id: "player",
  name: "Jugador",
  isPlayer: true,
  portraitKey: "jugador",
  portraitName: "jugador",
  x: playerSpawnPoint.x,
  y: playerSpawnPoint.y,
  radius: TILE_SIZE * 0.35,
  char: "@",
  color: "#00ff66",
  hp: 20,
  maxHp: 20,
  gold: 100,
  attackCooldown: 0,
  spellCooldown: 0,
  isCasting: false,
  castingSpell: null,
  castingTargetId: null,
  castingAimDirection: null,
  castingBoardPoint: null,
  castingRemaining: 0,
  shieldRemaining: 0,
  spellSlots: createWizardLevel20SpellSlots(),
  inventory: [
    createInventoryItem(ItemId.DAGGER),
    createInventoryItem(ItemId.LONGSWORD),
    createInventoryItem(ItemId.BOW),
    createInventoryItem(ItemId.ARROW, ARROW_INITIAL_QUANTITY),
    createInventoryItem(ItemId.POTION_OF_HEALING, 2),
    createInventoryItem(ItemId.SCROLL_MISTY_STEP),
    createInventoryItem(ItemId.SCROLL_DISINTEGRATE),
    createInventoryItem(ItemId.SCROLL_FORCECAGE),
  ],
};

export function updatePlayer(deltaTime, movementBlockers = []) {
  updatePlayerCooldowns(deltaTime);

  if (player.hp <= 0) {
    return;
  }

  updatePlayerMovement(deltaTime, movementBlockers);
  updatePlayerCasting(deltaTime);
}

function updatePlayerCooldowns(deltaTime) {
  player.attackCooldown = Math.max(0, player.attackCooldown - deltaTime);
  player.spellCooldown = Math.max(0, player.spellCooldown - deltaTime);
  player.shieldRemaining = Math.max(0, player.shieldRemaining - deltaTime);
}

function updatePlayerMovement(deltaTime, movementBlockers) {
  const movement = getPlayerMovementVector();

  if (movement.x === 0 && movement.y === 0) {
    return;
  }

  const speed = keys.run ? RUN_SPEED : WALK_SPEED;

  const nextX = player.x + movement.x * speed * deltaTime;
  const nextY = player.y + movement.y * speed * deltaTime;

  moveEntityWithCollision(player, nextX, nextY, {
    blockers: movementBlockers,
  });
}

function getPlayerMovementVector() {
  let x = 0;
  let y = 0;

  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) y -= 1;
  if (keys.down) y += 1;

  return normalizeVector(x, y);
}

function updatePlayerCasting(deltaTime) {
  if (!player.isCasting) {
    return;
  }

  player.castingRemaining = Math.max(0, player.castingRemaining - deltaTime);

  if (player.castingRemaining > 0) {
    return;
  }

  const resolvedSpell = player.castingSpell;

  resolveSpell(resolvedSpell, {
    caster: player,
    targetId: player.castingTargetId,
    aimDirection: player.castingAimDirection,
    boardPoint: player.castingBoardPoint,
  });

  if (!isReactionSpell(resolvedSpell)) {
    player.spellCooldown = SPELL_COOLDOWN;
  }

  player.isCasting = false;
  player.castingSpell = null;
  player.castingTargetId = null;
  player.castingAimDirection = null;
  player.castingBoardPoint = null;
  player.castingRemaining = 0;
}

export function startCasting(spell, options = {}) {
  if (player.hp <= 0) {
    gameState.message = "No puedes conjurar. Estás muerto.";
    return;
  }

  if (player.isCasting) {
    gameState.message = "Ya estás conjurando.";
    return;
  }

  const reactionSpell = isReactionSpell(spell);
  const spellLevel = getSpellLevel(spell);

  if (!hasSpellSlotFor(spell)) {
    gameState.message = `No tienes espacios de conjuro de nivel ${spellLevel} disponibles.`;
    return;
  }

  if (!reactionSpell && player.spellCooldown > 0) {
    gameState.message = `Todavía no puedes conjurar. Cooldown: ${player.spellCooldown.toFixed(1)}s.`;
    return;
  }

  if (spell === ActionType.CAST_MAGIC_MISSILE && !options.targetId) {
    gameState.message = "Misil mágico necesita un objetivo.";
    return;
  }

  if (spell === ActionType.CAST_BURNING_HANDS && !options.aimDirection) {
    gameState.message = "Manos ardientes necesita una dirección.";
    return;
  }

  if (spell === ActionType.CAST_WALL_OF_FORCE && !options.boardPoint) {
    gameState.message = "Muro de fuerza necesita un punto del tablero.";
    return;
  }

  if (spell === ActionType.CAST_FIREBALL && !options.boardPoint) {
    gameState.message = "Bola de fuego necesita un punto del tablero.";
    return;
  }

  if (spell === ActionType.CAST_VORTEX_WARP && (!options.targetId || !options.boardPoint)) {
    gameState.message = "Vortex Warp necesita objetivo y destino.";
    return;
  }

  if (spell === ActionType.CAST_COUNTERSPELL && !options.targetId) {
    gameState.message = "Counterspell necesita un usuario de magia enemigo.";
    return;
  }

  if (spell === ActionType.CAST_FIRE_BOLT && !options.aimDirection) {
    gameState.message = "Saeta de fuego necesita una dirección.";
    return;
  }

  if (spell === ActionType.CAST_CHROMATIC_ORB && !options.boardPoint) {
    gameState.message = "Orbe cromático necesita un punto hacia el cual empezar a seguir el mouse.";
    return;
  }

  if (!spendSpellSlotFor(spell)) {
    gameState.message = `No tienes espacios de conjuro de nivel ${spellLevel} disponibles.`;
    return;
  }

  if (reactionSpell) {
    resolveSpell(spell, {
      caster: player,
      targetId: options.targetId ?? null,
      aimDirection: options.aimDirection ?? null,
      boardPoint: options.boardPoint ?? null,
    });
    return;
  }

  player.isCasting = true;
  player.castingSpell = spell;
  player.castingTargetId = options.targetId ?? null;
  player.castingAimDirection = options.aimDirection ?? null;
  player.castingBoardPoint = options.boardPoint ?? null;
  player.castingRemaining = SPELL_CAST_TIME;

  if (spell === ActionType.CAST_CURE_WOUNDS) {
    gameState.message = "Empiezas a conjurar Sanar heridas. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_TIME_STOP) {
    gameState.message = "Empiezas a conjurar Detener el tiempo. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_MAGIC_MISSILE) {
    gameState.message = "Empiezas a conjurar Misil mágico. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_BURNING_HANDS) {
    gameState.message = "Empiezas a conjurar Manos ardientes. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_SHIELD) {
    gameState.message = "Escudo es una reacción: se lanza instantáneamente y no consume cooldown de conjuro.";
    return;
  }

  if (spell === ActionType.CAST_WALL_OF_FORCE) {
    gameState.message = "Empiezas a conjurar Muro de fuerza. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_FIREBALL) {
    gameState.message = "Empiezas a conjurar Bola de fuego. Se resolverá en 3 segundos y detonará 1 segundo después.";
    return;
  }

  if (spell === ActionType.CAST_VORTEX_WARP) {
    gameState.message = "Empiezas a conjurar Vortex Warp. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_COUNTERSPELL) {
    gameState.message = "Counterspell es una reacción: se lanza instantáneamente y no consume cooldown de conjuro.";
    return;
  }

  if (spell === ActionType.CAST_FIRE_BOLT) {
    gameState.message = "Empiezas a conjurar Saeta de fuego. Podés reapuntar con el mouse mientras casteás.";
    return;
  }

  if (spell === ActionType.CAST_CHROMATIC_ORB) {
    gameState.message = "Empiezas a conjurar Orbe cromático. El orbe seguirá el mouse con peso al lanzarse.";
  }
}

export function isReactionSpell(spell) {
  return spell === ActionType.CAST_SHIELD || spell === ActionType.CAST_COUNTERSPELL;
}

export function executeDodge(direction, movementBlockers = []) {
  if (player.hp <= 0) {
    gameState.message = "No puedes esquivar. Estás muerto.";
    return;
  }

  if (!direction) {
    gameState.message = "No elegiste dirección para esquivar.";
    return;
  }

  const vector = normalizeVector(direction.x, direction.y);

  if (vector.x === 0 && vector.y === 0) {
    gameState.message = "Dirección de esquiva inválida.";
    return;
  }

  const nextX = player.x + vector.x * DODGE_DISTANCE_PIXELS;
  const nextY = player.y + vector.y * DODGE_DISTANCE_PIXELS;

  if (!canPlaceEntityAt(player, nextX, nextY, { blockers: movementBlockers })) {
    gameState.message = "No puedes esquivar hacia ahí: el paso está bloqueado.";
    return;
  }

  player.x = nextX;
  player.y = nextY;
  gameState.message = "Esquivas 5 pies.";
}
