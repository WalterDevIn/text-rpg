import {
  TILE_SIZE,
  WALK_SPEED,
  RUN_SPEED,
  SPELL_CAST_TIME,
  SPELL_COOLDOWN,
  DODGE_DISTANCE_PIXELS,
  EXPEDITIOUS_RETREAT_SPEED_MULTIPLIER,
} from "../../config/constants.js";

import { getPlayerSpawnPoint } from "../../engine/world/map.js";
import { keys } from "../../engine/systems/inputSystem.js";
import { canPlaceEntityAt, normalizeVector, moveEntityWithCollision } from "../../engine/world/collision.js";
import { ActionType, gameState } from "../../engine/state/gameState.js";
import { resolveSpell } from "../spells/spellCasting.js";
import { getSpellIdForActionType, SpellId } from "../spells/spellDefinitions.js";
import { createInventoryItem, ItemId } from "../items/items.js";
import {
  getBackgroundById,
  getClassById,
  getRaceById,
  getStartingEquipmentEntries,
  getStartingGold,
  normalizeCharacterDraft,
} from "../characters/characterOptions.js";


const SPELL_LEVEL_BY_ACTION = {
  [ActionType.CAST_CURE_WOUNDS]: 1,
  [ActionType.CAST_MAGIC_MISSILE]: 1,
  [ActionType.CAST_BURNING_HANDS]: 1,
  [ActionType.CAST_SHIELD]: 1,
  [ActionType.CAST_VORTEX_WARP]: 2,
  [ActionType.CAST_FIREBALL]: 3,
  [ActionType.CAST_COUNTERSPELL]: 3,
  [ActionType.CAST_FIRE_BOLT]: 0,
  [ActionType.CAST_DANCING_LIGHTS]: 0,
  [ActionType.CAST_SHOCKING_GRASP]: 0,
  [ActionType.CAST_FALSE_LIFE]: 1,
  [ActionType.CAST_EXPEDITIOUS_RETREAT]: 1,
  [ActionType.CAST_CHROMATIC_ORB]: 1,
  [ActionType.CAST_WALL_OF_FORCE]: 5,
  [ActionType.CAST_TIME_STOP]: 9,
};

function createWizardLevel1SpellSlots() {
  return {
    1: { max: 2, remaining: 2 },
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

function createStartingInventory(characterData = {}) {
  const entries = getStartingEquipmentEntries(characterData);
  const inventory = [];

  const draft = normalizeCharacterDraft(characterData);

  for (const entry of entries) {
    const item = createInventoryItem(entry.definitionId, entry.quantity ?? 1);

    if (entry.definitionId === ItemId.PLAYER_SPELLBOOK) {
      item.spellIds = [...(draft.spellbookSpellIds ?? [])];
      item.cantripIds = [...(draft.cantrips ?? [])];
    }

    inventory.push(item);
  }

  return inventory;
}

export function isPlayerSpellAvailable(actionType) {
  const spellId = getSpellIdForActionType(actionType);

  if (!spellId) {
    return false;
  }

  if ((player.cantrips ?? []).includes(spellId)) {
    return true;
  }

  return (player.spellbookSpellIds ?? []).includes(spellId);
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
  hp: 6,
  maxHp: 6,
  gold: 5,
  race: "Humano",
  raceId: "human",
  background: "Ermitaño",
  backgroundId: "hermit",
  className: "Mago",
  classId: "wizard",
  level: 1,
  attackCooldown: 0,
  spellCooldown: 0,
  isCasting: false,
  castingSpell: null,
  castingTargetId: null,
  castingAimDirection: null,
  castingBoardPoint: null,
  castingRemaining: 0,
  shieldRemaining: 0,
  shieldHp: 0,
  temporaryHp: 0,
  temporaryHpRemaining: 0,
  expeditiousRetreatRemaining: 0,
  concentration: null,
  spellSlots: createWizardLevel1SpellSlots(),
  cantrips: [SpellId.FIRE_BOLT, SpellId.DANCING_LIGHTS, SpellId.SHOCKING_GRASP],
  spellbookSpellIds: [],
  inventory: createStartingInventory(),
};

export function resetPlayerForNewGame(characterData = {}) {
  const spawn = getPlayerSpawnPoint();
  const draft = normalizeCharacterDraft(characterData);
  const race = getRaceById(draft.raceId);
  const background = getBackgroundById(draft.backgroundId);
  const classDefinition = getClassById(draft.classId);

  player.name = draft.name || "Jugador";
  player.race = race.name;
  player.raceId = race.id;
  player.background = background.name;
  player.backgroundId = background.id;
  player.className = classDefinition.name;
  player.classId = classDefinition.id;
  player.level = 1;
  player.x = spawn.x;
  player.y = spawn.y;
  player.hp = classDefinition.maxHp ?? 6;
  player.maxHp = classDefinition.maxHp ?? 6;
  player.gold = getStartingGold(draft);
  player.attackCooldown = 0;
  player.spellCooldown = 0;
  player.isCasting = false;
  player.castingSpell = null;
  player.castingTargetId = null;
  player.castingAimDirection = null;
  player.castingBoardPoint = null;
  player.castingRemaining = 0;
  player.shieldRemaining = 0;
  player.shieldHp = 0;
  player.temporaryHp = 0;
  player.temporaryHpRemaining = 0;
  player.expeditiousRetreatRemaining = 0;
  player.concentration = null;
  player.spellSlots = createWizardLevel1SpellSlots();
  player.cantrips = [...(draft.cantrips ?? classDefinition.fixedCantrips ?? [])];
  player.spellbookSpellIds = [...(draft.spellbookSpellIds ?? [])];
  player.inventory = createStartingInventory(draft);
  return player;
}

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
  if (player.shieldRemaining <= 0) player.shieldHp = 0;
  player.temporaryHpRemaining = Math.max(0, (player.temporaryHpRemaining ?? 0) - deltaTime);
  if (player.temporaryHpRemaining <= 0) player.temporaryHp = 0;
  player.expeditiousRetreatRemaining = Math.max(0, (player.expeditiousRetreatRemaining ?? 0) - deltaTime);
}

function updatePlayerMovement(deltaTime, movementBlockers) {
  const movement = getPlayerMovementVector();

  if (movement.x === 0 && movement.y === 0) {
    return;
  }

  const baseSpeed = keys.run ? RUN_SPEED : WALK_SPEED;
  const speed = player.expeditiousRetreatRemaining > 0 ? baseSpeed * EXPEDITIOUS_RETREAT_SPEED_MULTIPLIER : baseSpeed;

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
  const instantSpell = isInstantSpell(spell);
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

  if (spell === ActionType.CAST_DANCING_LIGHTS && !options.boardPoint && !options.targetId) {
    gameState.message = "Luces danzantes necesita un punto del tablero o una criatura objetivo.";
    return;
  }

  if (spell === ActionType.CAST_SHOCKING_GRASP && !options.targetId) {
    gameState.message = "Contacto electrizante necesita un enemigo a 5 pies.";
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

  if (instantSpell) {
    resolveSpell(spell, {
      caster: player,
      targetId: options.targetId ?? null,
      aimDirection: options.aimDirection ?? null,
      boardPoint: options.boardPoint ?? null,
    });

    if (!reactionSpell) {
      player.spellCooldown = SPELL_COOLDOWN;
    }

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

  if (spell === ActionType.CAST_DANCING_LIGHTS) {
    gameState.message = "Empiezas a conjurar Luces danzantes. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_SHOCKING_GRASP) {
    gameState.message = "Contacto electrizante es instantáneo.";
    return;
  }

  if (spell === ActionType.CAST_FALSE_LIFE) {
    gameState.message = "Empiezas a conjurar Vida falsa. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_EXPEDITIOUS_RETREAT) {
    gameState.message = "Retirada expeditiva es instantánea.";
    return;
  }

  if (spell === ActionType.CAST_CHROMATIC_ORB) {
    gameState.message = "Empiezas a conjurar Orbe cromático. El orbe seguirá el mouse con peso al lanzarse.";
  }
}

export function isReactionSpell(spell) {
  return spell === ActionType.CAST_SHIELD || spell === ActionType.CAST_COUNTERSPELL;
}

export function isInstantSpell(spell) {
  return isReactionSpell(spell) || spell === ActionType.CAST_SHOCKING_GRASP || spell === ActionType.CAST_EXPEDITIOUS_RETREAT;
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
