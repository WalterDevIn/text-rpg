import {
  ATTACK_RANGE_FEET,
  BOW_ATTACK_RANGE_PIXELS,
  BURNING_HANDS_CONE_ANGLE_RADIANS,
  BURNING_HANDS_RANGE_FEET,
  BURNING_HANDS_RANGE_PIXELS,
  DODGE_DISTANCE_PIXELS,
  COUNTERSPELL_RANGE_FEET,
  COUNTERSPELL_RANGE_PIXELS,
  CHROMATIC_ORB_RANGE_FEET,
  CHROMATIC_ORB_RANGE_PIXELS,
  FIREBALL_RADIUS_PIXELS,
  FIREBALL_RANGE_FEET,
  FIREBALL_RANGE_PIXELS,
  FIRE_BOLT_RANGE_FEET,
  FIRE_BOLT_RANGE_PIXELS,
  HEALING_WORD_RANGE_FEET,
  HEALING_WORD_RANGE_PIXELS,
  MAGIC_MISSILE_RANGE_FEET,
  MISTY_STEP_RANGE_PIXELS,
  TILE_SIZE,
  WALL_OF_FORCE_RANGE_FEET,
  WALL_OF_FORCE_RANGE_PIXELS,
  VORTEX_WARP_RANGE_FEET,
  VORTEX_WARP_RANGE_PIXELS,
} from "./constants.js";

import { player, hasSpellSlotFor, getSpellSlotLine } from "./player.js";
import {
  getEnemiesInAttackRange,
  getEnemiesInItemRange,
  getEnemiesInMagicMissileRange,
  getEnemiesInWeaponRange,
  getLivingEnemies,
} from "./combat.js";
import { canPlaceEntityAt, getDistance, getSurfaceDistance, normalizeVector } from "./physics.js";
import { ActionType, GameMode, gameState } from "./state.js";
import {
  DUNGEON_DOOR_CHAR,
  DUNGEON_FLOOR_CHAR,
  DUNGEON_STAIRS_CHAR,
  DUNGEON_STAIRS_UP_CHAR,
  DUNGEON_WALL_CHAR,
  getTemporaryWalls,
  getTorchAt,
  isEntityVisibleToPlayer,
  isTemporaryWallAt,
  map,
  mapCols,
  mapRows,
} from "./map.js";
import { worldToScreen, screenToWorld } from "./renderer.js";
import { getForcecageTiles, getWallOfForceTiles } from "./spellGeometry.js";
import {
  chests,
  groundItems,
  findChestAtPoint,
  getInventoryItemByInstanceId,
  getInventoryItems,
  getInventoryWeapons,
  getItemRangePixels,
  getUsableInventoryItems,
  getUsableItemTargeting,
  lootChestAtPoint,
  pickupTorchAtPoint,
} from "./inventory.js";
import { getItemDefinition, ItemId, ItemTargeting, ItemType } from "./items.js";
import {
  buyMerchantItem,
  hireMerchant,
  getMerchantInventory,
  getVisibleNearbyMerchant,
  isTimeStoppedForMerchant,
  merchants,
} from "./merchant.js";
import { requestCreaturePortrait } from "./portraits.js";

let layer = null;
let canvas = null;
let root = null;

let submenuType = null;
let shouldAnimateMainButtons = false;
const draggableSubmenuPositions = new Map();
let activeSubmenuDrag = null;
const SUBMENU_PAGE_SIZE = 4;
const submenuPages = new Map();

export function setupActionMenuUi({ layerElement, canvasElement, rootElement }) {
  layer = layerElement;
  canvas = canvasElement;
  root = rootElement;

  layer.addEventListener("pointerdown", handleBoardPointerDown);
  canvas.addEventListener("pointerdown", handleBoardPointerDown);
  layer.addEventListener("pointermove", handleBoardPointerMove);
  canvas.addEventListener("pointermove", handleBoardPointerMove);
}

export function showActionMenu() {
  submenuType = null;
  shouldAnimateMainButtons = true;
  renderActionMenu();
}

export function hideActionMenu() {
  if (!layer) return;

  layer.innerHTML = "";
  submenuType = null;
}

export function updateActionOverlay() {
  if (!layer) return;

  if (gameState.mode === GameMode.ACTION_MENU) {
    return;
  }

  if (!player.isCasting || !isReaimableCastingSpell(player.castingSpell)) {
    if (submenuType === null) {
      layer.innerHTML = "";
    }
    return;
  }

  layer.innerHTML = "";
  renderCastingAimPreview();
}

function renderActionMenu() {
  if (!layer || !canvas || !root) return;

  layer.innerHTML = "";

  const playerScreenPosition = getPlayerScreenPosition();

  const mainButtons = [
    {
      id: "attack",
      label: "Atacar",
      iconClass: "fa-solid fa-khanda",
      action: openAttackWeaponSubmenu,
      selected: gameState.selectedAction === ActionType.ATTACK,
    },
    {
      id: "cast",
      label: "Conjurar",
      iconClass: "fa-solid fa-wand-sparkles",
      action: openSpellSubmenu,
      selected: isCastActionSelected(),
    },
    {
      id: "use_item",
      label: "Usar objeto",
      iconClass: "fa-solid fa-flask-vial",
      action: openUseItemSubmenu,
      selected: gameState.selectedAction === ActionType.USE_ITEM,
    },
    {
      id: "analyze",
      label: "Analizar",
      iconClass: "fa-solid fa-magnifying-glass",
      action: openAnalyzeTargeting,
      selected: gameState.selectedAction === ActionType.ANALYZE,
    },
    {
      id: "dodge",
      label: "Esquivar",
      iconClass: "fa-solid fa-person-running",
      action: openDodgeTargeting,
      selected: gameState.selectedAction === ActionType.DODGE,
    },
  ];

  if (getVisibleNearbyMerchant()) {
    mainButtons.push({
      id: "trade",
      label: "Comerciar",
      iconClass: "fa-solid fa-coins",
      action: openTradeSubmenu,
      selected: gameState.selectedAction === ActionType.TRADE,
    });

    mainButtons.push({
      id: "dialogue",
      label: "Dialogar",
      iconClass: "fa-solid fa-comments",
      action: openDialogueSubmenu,
      selected: submenuType === "dialogue",
    });
  }

  const animateMainButtons = shouldAnimateMainButtons;
  shouldAnimateMainButtons = false;
  placeButtonsAroundPoint(mainButtons, playerScreenPosition, 98, animateMainButtons);

  if (submenuType === "attack_weapons") {
    renderWeaponSubmenu(playerScreenPosition);
  }

  if (submenuType === "weapon_targets") {
    const weapon = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
    const weaponDefinition = getItemDefinition(weapon);
    renderTargetingHelp({
      text: `Elegí un enemigo en el tablero. Arma: ${weaponDefinition?.name ?? "—"}. Alcance: ${weaponDefinition?.rangeFeet ?? ATTACK_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderTargetIndicators(getVisibleTargets(getEnemiesInWeaponRange(weapon)), {
      variant: "attack",
      onSelect: selectAttackTarget,
    });
  }

  if (submenuType === "weapon_aim") {
    const weapon = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
    const weaponDefinition = getItemDefinition(weapon);
    renderTargetingHelp({
      text: `Tocá un punto del tablero para elegir la dirección del disparo. Arma: ${weaponDefinition?.name ?? "—"}. Alcance: ${weaponDefinition?.rangeFeet ?? ATTACK_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderWeaponAimPreview(weapon);
  }

  if (submenuType === "spell") {
    renderSpellSubmenu(playerScreenPosition);
  }

  if (submenuType === "cure_wounds_targets") {
    renderTargetingHelp({
      text: `Elegí cualquier criatura visible. Rango: ${HEALING_WORD_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderTargetIndicators(getCureWoundsTargets(), {
      variant: "healing",
      onSelect: selectCureWoundsTarget,
    });
  }

  if (submenuType === "magic_missile_targets") {
    renderTargetingHelp({
      text: `Elegí un enemigo en el tablero. Rango: ${MAGIC_MISSILE_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderTargetIndicators(getVisibleTargets(getEnemiesInMagicMissileRange()), {
      variant: "magic-missile",
      onSelect: selectMagicMissileTarget,
    });
  }

  if (submenuType === "burning_hands_aim") {
    renderTargetingHelp({
      text: `Tocá un punto del tablero para orientar el cono. Alcance: ${BURNING_HANDS_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderBurningHandsPreview();
  }

  if (submenuType === "fire_bolt_aim") {
    renderTargetingHelp({
      text: `Tocá un punto del tablero para disparar Saeta de fuego. Alcance: ${FIRE_BOLT_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderFireBoltPreview();
  }

  if (submenuType === "chromatic_orb_point") {
    renderTargetingHelp({
      text: `Tocá un punto del tablero. Al lanzarse, el Orbe cromático seguirá el mouse con inercia. Rango: ${CHROMATIC_ORB_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderChromaticOrbPreview();
  }

  if (submenuType === "wall_of_force_point") {
    renderTargetingHelp({
      text: `Tocá un punto del tablero para crear el muro. Rango: ${WALL_OF_FORCE_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderWallOfForcePreview();
  }

  if (submenuType === "fireball_point") {
    renderTargetingHelp({
      text: `Tocá un punto del tablero para Bola de fuego. Rango: ${FIREBALL_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderFireballPreview();
  }

  if (submenuType === "vortex_warp_targets") {
    renderTargetingHelp({
      text: `Elegí el enemigo que querés mover. Rango: ${VORTEX_WARP_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderTargetIndicators(getVisibleTargets(getEnemiesInVortexWarpRange()), {
      variant: "vortex",
      onSelect: selectVortexWarpTarget,
    });
  }

  if (submenuType === "vortex_warp_point") {
    renderTargetingHelp({
      text: `Tocá el destino para mover al enemigo. Rango desde ti: ${VORTEX_WARP_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderVortexWarpPreview();
  }

  if (submenuType === "counterspell_targets") {
    renderTargetingHelp({
      text: `Elegí un enemigo que esté casteando magia. Rango: ${COUNTERSPELL_RANGE_FEET} pies.`,
      center: playerScreenPosition,
    });
    renderTargetIndicators(getVisibleTargets(getCounterspellTargets()), {
      variant: "counterspell",
      onSelect: selectCounterspellTarget,
    });
  }

  if (submenuType === "items") {
    renderUseItemSubmenu(playerScreenPosition);
  }

  if (submenuType === "trade") {
    renderTradeSubmenu(playerScreenPosition);
  }

  if (submenuType === "dialogue") {
    renderDialogueSubmenu(playerScreenPosition);
  }

  if (submenuType === "item_enemy_targets") {
    const item = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
    const definition = getItemDefinition(item);
    renderTargetingHelp({
      text: `Elegí un enemigo en el tablero. Objeto: ${definition?.name ?? "—"}. Alcance: ${definition?.rangeFeet ?? 0} pies.`,
      center: playerScreenPosition,
    });
    renderTargetIndicators(getVisibleTargets(getEnemiesInItemRange(item)), {
      variant: definition?.id === ItemId.SCROLL_DISINTEGRATE ? "disintegrate" : "item",
      onSelect: selectItemTarget,
    });
  }

  if (submenuType === "item_point") {
    const item = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
    const definition = getItemDefinition(item);
    renderTargetingHelp({
      text: `Tocá un punto del tablero. Objeto: ${definition?.name ?? "—"}. Rango: ${definition?.rangeFeet ?? 0} pies.`,
      center: playerScreenPosition,
    });
    renderItemPointPreview(item);
  }

  if (submenuType === "analyze") {
    renderTargetingHelp({
      text: "Tocá una pared, puerta, objeto, criatura, NPC, tu personaje o casilla para analizarla.",
      center: playerScreenPosition,
    });
    renderAnalysisSelectionPreview();
  }

  if (submenuType === "dodge") {
    renderTargetingHelp({
      text: "Tocá un punto del tablero. La esquiva usa esa dirección y mueve 5 pies.",
      center: playerScreenPosition,
    });
    renderDodgePreview();
  }
}

function isCastActionSelected() {
  return (
    gameState.selectedAction === ActionType.CAST_CURE_WOUNDS ||
    gameState.selectedAction === ActionType.CAST_TIME_STOP ||
    gameState.selectedAction === ActionType.CAST_MAGIC_MISSILE ||
    gameState.selectedAction === ActionType.CAST_BURNING_HANDS ||
    gameState.selectedAction === ActionType.CAST_SHIELD ||
    gameState.selectedAction === ActionType.CAST_WALL_OF_FORCE ||
    gameState.selectedAction === ActionType.CAST_FIREBALL ||
    gameState.selectedAction === ActionType.CAST_VORTEX_WARP ||
    gameState.selectedAction === ActionType.CAST_COUNTERSPELL ||
    gameState.selectedAction === ActionType.CAST_FIRE_BOLT ||
    gameState.selectedAction === ActionType.CAST_CHROMATIC_ORB
  );
}

function placeButtonsAroundPoint(buttons, center, radius, animate = false) {
  const count = buttons.length;

  for (let i = 0; i < count; i++) {
    const angle = getRadialAngle(i, count);
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;

    const button = createOrbButton(buttons[i]);

    if (animate) {
      button.style.left = `${center.x}px`;
      button.style.top = `${center.y}px`;
      button.style.opacity = "0";
      button.style.transform = "translate(-50%, -50%) scale(0.25)";
      button.style.transition = "left 140ms ease-out, top 140ms ease-out, opacity 110ms ease-out, transform 140ms ease-out";
      button.style.transitionDelay = `${i * 32}ms`;

      layer.appendChild(button);

      requestAnimationFrame(() => {
        button.style.left = `${x}px`;
        button.style.top = `${y}px`;
        button.style.opacity = "1";
        button.style.transform = "translate(-50%, -50%) scale(1)";
      });
    } else {
      button.style.left = `${x}px`;
      button.style.top = `${y}px`;
      button.style.opacity = "1";
      button.style.transform = "translate(-50%, -50%) scale(1)";
      layer.appendChild(button);
    }
  }
}

function getRadialAngle(index, total) {
  if (total === 1) {
    return -Math.PI / 2;
  }

  if (total === 2) {
    return index === 0 ? Math.PI : 0;
  }

  return -Math.PI / 2 + index * ((Math.PI * 2) / total);
}

function createOrbButton(config) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "action-orb";
  button.style.position = "absolute";

  if (config.selected) {
    button.classList.add("selected");
  }

  button.title = config.label;
  button.innerHTML = `<i class="${config.iconClass}"></i>`;

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    config.action();
  });

  return button;
}

function openAttackWeaponSubmenu() {
  submenuType = "attack_weapons";
  gameState.selectedAction = null;
  clearAllSelections();
  gameState.message = "Elegí un arma de tu inventario para atacar.";
  renderActionMenu();
}

function openSpellSubmenu() {
  submenuType = "spell";
  gameState.selectedAction = null;
  clearAllSelections();
  gameState.message = "Elegí un conjuro.";
  renderActionMenu();
}

function openUseItemSubmenu() {
  submenuType = "items";
  gameState.selectedAction = null;
  clearAllSelections();
  gameState.message = "Elegí un objeto consumible de tu inventario.";
  renderActionMenu();
}

function openDodgeTargeting() {
  submenuType = "dodge";
  gameState.selectedAction = ActionType.DODGE;
  clearTargetAndSpellSelections();
  gameState.selectedInventoryItemId = null;
  gameState.message = "Tocá un punto del tablero para elegir la dirección de esquiva.";
  renderActionMenu();
}

function openAnalyzeTargeting() {
  submenuType = "analyze";
  gameState.selectedAction = ActionType.ANALYZE;
  clearAllSelections();
  gameState.infoMessage = "Analizar: selecciona algo visible en el tablero.";
  renderActionMenu();
}

function openTradeSubmenu() {
  const merchant = getVisibleNearbyMerchant();

  if (!merchant) {
    gameState.message = "No hay una vendedora cerca.";
    return;
  }

  submenuType = "trade";
  gameState.selectedAction = ActionType.TRADE;
  clearAllSelections();
  gameState.message = isTimeStoppedForMerchant()
    ? "El tiempo está detenido: accedes al inventario real de la vendedora. Precio: 0 po."
    : "Comercias con la vendedora arcana.";
  renderActionMenu();
}

function openDialogueSubmenu() {
  const merchant = getVisibleNearbyMerchant();

  if (!merchant) {
    gameState.message = "No hay una vendedora cerca con quien dialogar.";
    return;
  }

  submenuType = "dialogue";
  gameState.selectedAction = null;
  clearAllSelections();
  gameState.message = "Dialogas con la vendedora arcana.";
  renderActionMenu();
}

function renderWeaponSubmenu(center) {
  const submenu = createSubmenu({
    title: "Elegir arma",
    x: center.x,
    y: center.y + 160,
  });

  const weapons = getInventoryWeapons();

  renderPaginatedList({
    submenu,
    pageKey: "attack_weapons",
    items: weapons,
    emptyText: "No tienes armas.",
    renderItem: (weapon) => {
      const definition = getItemDefinition(weapon);
      const button = document.createElement("button");

      button.type = "button";
      button.className = "action-submenu-button";

      if (gameState.selectedInventoryItemId === weapon.instanceId) {
        button.classList.add("selected");
      }

      button.textContent = `${definition.name}${weapon.quantity > 1 ? ` x${weapon.quantity}` : ""}`;
      button.title = definition.description ?? definition.name;

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        chooseWeaponForAttack(weapon);
      });

      return button;
    },
  });

  layer.appendChild(submenu);
}

function chooseWeaponForAttack(weapon) {
  const definition = getItemDefinition(weapon);

  gameState.selectedAction = ActionType.ATTACK;
  gameState.selectedInventoryItemId = weapon.instanceId;
  clearTargetAndSpellSelections(false);

  if (definition.ranged) {
    submenuType = "weapon_aim";
    gameState.message = `Arma elegida: ${definition.name}. Tocá un punto del tablero para elegir la dirección del disparo.`;
    renderActionMenu();
    return;
  }

  submenuType = "weapon_targets";
  const targets = getVisibleTargets(getEnemiesInWeaponRange(weapon));

  if (targets.length > 0) {
    gameState.selectedTargetId = targets[0].id;
    gameState.message = `Arma elegida: ${definition.name}. Tocá un enemigo marcado o soltá F para atacar a ${targets[0].name}.`;
  } else {
    gameState.selectedTargetId = null;
    gameState.message = `Arma elegida: ${definition.name}. No hay enemigos a ${definition.rangeFeet} pies.`;
  }

  renderActionMenu();
}

function renderSpellSubmenu(center) {
  const submenu = createSubmenu({
    title: "Elegir conjuro",
    x: center.x,
    y: center.y + 160,
  });

  const spells = [
    {
      name: "Sanar heridas",
      level: 1,
      description: `Cura 1d8 PG a cualquier criatura visible a ${HEALING_WORD_RANGE_FEET} pies. Casteo 3s; luego cooldown 3s.`,
      actionType: ActionType.CAST_CURE_WOUNDS,
      targeting: "creature",
    },
    {
      name: "Detener el tiempo",
      level: 9,
      description: "Detiene el tiempo (1d4 + 1) * 6s. Casteo 3s; luego cooldown 3s.",
      actionType: ActionType.CAST_TIME_STOP,
    },
    {
      name: "Misil mágico",
      level: 1,
      description: `3 misiles teleguiados. Rango ${MAGIC_MISSILE_RANGE_FEET} pies. Casteo 3s; luego cooldown 3s.`,
      actionType: ActionType.CAST_MAGIC_MISSILE,
      targeting: "enemy",
    },
    {
      name: "Saeta de fuego",
      level: 0,
      description: `Truco. Dispara una x ígnea en línea recta. Alcance ${FIRE_BOLT_RANGE_FEET} pies. Daño 4d10. Casteo 3s; luego cooldown 3s.`,
      actionType: ActionType.CAST_FIRE_BOLT,
      targeting: "fire_bolt_direction",
    },

    {
      name: "Orbe cromático",
      level: 1,
      description: `Orbe pesado que sigue el mouse. Alcance ${CHROMATIC_ORB_RANGE_FEET} pies. Daño 3d8. Casteo 3s; luego cooldown 3s.`,
      actionType: ActionType.CAST_CHROMATIC_ORB,
      targeting: "chromatic_orb_point",
    },
    {
      name: "Manos ardientes",
      level: 1,
      description: `Cono de ${BURNING_HANDS_RANGE_FEET} pies. Apunta con mouse. Casteo 3s; luego cooldown 3s.`,
      actionType: ActionType.CAST_BURNING_HANDS,
      targeting: "direction",
    },
    {
      name: "Escudo",
      level: 1,
      description: "Reacción instantánea; barrera 6s; bloquea Misil mágico. Sin cooldown.",
      actionType: ActionType.CAST_SHIELD,
    },
    {
      name: "Muro de fuerza",
      level: 5,
      description: "Crea bloques amarillos temporales. Apunta con mouse. Casteo 3s; luego cooldown 3s.",
      actionType: ActionType.CAST_WALL_OF_FORCE,
      targeting: "point",
    },
    {
      name: "Bola de fuego",
      level: 3,
      description: `Explosión de 10 pies. Daño 8d6 si la esfera llega o choca. Rango ${FIREBALL_RANGE_FEET} pies.`,
      actionType: ActionType.CAST_FIREBALL,
      targeting: "fireball_point",
    },
    {
      name: "Vortex Warp",
      level: 2,
      description: `Mueve un enemigo a un punto elegido dentro de ${VORTEX_WARP_RANGE_FEET} pies.`,
      actionType: ActionType.CAST_VORTEX_WARP,
      targeting: "vortex_enemy",
    },
    {
      name: "Counterspell",
      level: 3,
      description: "Reacción instantánea; interrumpe acólitos, dragón u otro casteo mágico enemigo. Sin cooldown.",
      actionType: ActionType.CAST_COUNTERSPELL,
      targeting: "counterspell_enemy",
    },
  ];

  renderPaginatedList({
    submenu,
    pageKey: "spell",
    items: spells,
    emptyText: "No hay conjuros disponibles.",
    renderItem: (spell) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "action-submenu-button";

      if (gameState.selectedAction === spell.actionType) {
        button.classList.add("selected");
      }

      const hasSlot = hasSpellSlotFor(spell.actionType);
      const levelText = spell.level === 0 ? "truco" : `nivel ${spell.level ?? "?"}`;
      button.textContent = `${spell.name} · ${levelText}${hasSlot ? "" : " · sin espacios"}`;
      button.title = spell.level === 0
        ? `${spell.description}\nNo consume espacios de conjuro.`
        : `${spell.description}\nEspacios: ${getSpellSlotLine(spell.level)}`;

      if (!hasSlot) {
        button.classList.add("disabled");
        button.setAttribute("aria-disabled", "true");
        button.style.opacity = "0.55";
        button.style.cursor = "not-allowed";
      }

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();

        if (!hasSlot) {
          gameState.message = `No tienes espacios de conjuro de nivel ${spell.level} disponibles para ${spell.name}.`;
          renderActionMenu();
          return;
        }

        chooseSpell(spell);
        renderActionMenu();
      });

      return button;
    },
  });

  layer.appendChild(submenu);
}

function renderUseItemSubmenu(center) {
  const submenu = createSubmenu({
    title: "Inventario / usar objeto",
    x: center.x,
    y: center.y + 160,
  });

  const items = getInventoryItems();

  renderPaginatedList({
    submenu,
    pageKey: "items",
    items,
    emptyText: "Inventario vacío.",
    renderItem: (item) => {
      const definition = getItemDefinition(item);
      const button = document.createElement("button");
      const quantity = item.quantity > 1 ? ` x${item.quantity}` : "";
      const usable = definition?.type === ItemType.POTION || definition?.type === ItemType.SCROLL;
      button.type = "button";
      button.className = "action-submenu-button";

      if (gameState.selectedInventoryItemId === item.instanceId) {
        button.classList.add("selected");
      }

      if (!usable) {
        button.classList.add("disabled");
        button.setAttribute("aria-disabled", "true");
        button.style.opacity = "0.72";
        button.style.cursor = "default";
      }

      button.textContent = `${definition?.name ?? item.definitionId}${quantity}`;
      button.title = definition?.description ?? "";

      if (usable) {
        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          event.stopPropagation();
          chooseUsableItem(item);
        });
      }

      return button;
    },
  });

  layer.appendChild(submenu);
}

function renderTradeSubmenu(center) {
  const merchant = getVisibleNearbyMerchant();
  const submenu = createSubmenu({
    title: merchant ? `Comerciar: ${merchant.name}` : "Comerciar",
    x: center.x,
    y: center.y + 160,
  });

  if (!merchant) {
    const empty = document.createElement("div");
    empty.className = "action-submenu-empty";
    empty.textContent = "La vendedora ya no está cerca.";
    submenu.appendChild(empty);
    layer.appendChild(submenu);
    return;
  }

  const inventory = getMerchantInventory(merchant).filter((stock) => stock.quantity > 0);
  const timeStopped = isTimeStoppedForMerchant();
  const note = document.createElement("div");
  note.className = "action-submenu-empty";
  note.textContent = timeStopped
    ? "Detener el tiempo activo: inventario real, precio 0 po. Todo lo tomado entra a tu inventario."
    : `Oro disponible: ${player.gold} po. Inventario limitado.`;
  submenu.appendChild(note);

  renderPaginatedList({
    submenu,
    pageKey: `trade_${merchant.id}_${timeStopped ? "real" : "shop"}`,
    items: inventory.map((stock, filteredIndex) => ({ stock, filteredIndex })),
    emptyText: "No hay mercancía disponible.",
    renderItem: ({ stock }) => {
      const definition = getItemDefinition(stock.definitionId);
      const button = document.createElement("button");
      const price = timeStopped ? 0 : stock.price;

      button.type = "button";
      button.className = "action-submenu-button";
      button.textContent = `${definition?.name ?? stock.definitionId} x${stock.quantity} — ${price} po`;
      button.title = definition?.description ?? "";

      button.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const realIndex = getMerchantInventory(merchant).indexOf(stock);
        buyMerchantItem(merchant.id, realIndex);
        renderActionMenu();
      });

      return button;
    },
  });

  layer.appendChild(submenu);
}

function renderDialogueSubmenu(center) {
  const merchant = getVisibleNearbyMerchant();
  const submenu = createSubmenu({
    title: merchant ? `Dialogar: ${merchant.name}` : "Dialogar",
    x: center.x,
    y: center.y + 160,
  });

  if (!merchant) {
    const empty = document.createElement("div");
    empty.className = "action-submenu-empty";
    empty.textContent = "La vendedora ya no está cerca.";
    submenu.appendChild(empty);
    layer.appendChild(submenu);
    return;
  }

  const text = document.createElement("div");
  text.className = "action-submenu-empty";
  text.style.whiteSpace = "pre-line";
  text.textContent = getMerchantDialogueText(merchant);
  submenu.appendChild(text);

  const options = [
    {
      label: "Preguntar por pergaminos",
      response: "La vendedora baja la voz: ‘Sólo vendo copias de viaje. Los originales, mis notas y el oro no salen de mi bolsa.’",
    },
    {
      label: "Preguntar por la mazmorra",
      response: "‘Las puertas cambian de intención cuando las cruzas. Si una cámara parece vacía, mira las paredes: la piedra recuerda mejor que la gente.’",
    },
    {
      label: "Preguntar por su bolsa",
      response: "Su mano cae sobre la bolsa de vacío. ‘Eso no es mercancía. Ni siquiera mi sombra debería tocarla sin permiso.’",
    },
  ];

  if (!merchant.isHired) {
    const hireButton = document.createElement("button");
    hireButton.type = "button";
    hireButton.className = "action-submenu-button";
    hireButton.textContent = "Contratarla como acompañante — 50 po";
    hireButton.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hireMerchant(merchant.id);
      renderActionMenu();
    });
    submenu.appendChild(hireButton);
  }

  for (const option of options) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "action-submenu-button";
    button.textContent = option.label;
    button.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      gameState.infoMessage = `DIÁLOGO: ${merchant.name}\n${option.response}`;
      renderActionMenu();
    });
    submenu.appendChild(button);
  }

  layer.appendChild(submenu);
}

function getMerchantDialogueText(merchant) {
  if (isTimeStoppedForMerchant()) {
    return "La vendedora está suspendida en el tiempo. Su expresión no cambia. Puedes observarla, pero no dialogar realmente mientras el tiempo está detenido.";
  }

  return [
    "La vendedora arcana te mira por encima de sus pergaminos.",
    "‘Compro tiempo con papel y tinta. Si quieres poder, paga antes de leer.’",
    `Estado: ${merchant.hp}/${merchant.maxHp} PG. Actitud: ${merchant.isHired ? "acompañante contratada" : "no hostil"}.`,
  ].join("\n");
}

function chooseUsableItem(item) {
  const definition = getItemDefinition(item);
  const targeting = getUsableItemTargeting(item);

  gameState.selectedAction = ActionType.USE_ITEM;
  gameState.selectedInventoryItemId = item.instanceId;
  gameState.selectedTargetId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;

  if (targeting === ItemTargeting.ENEMY) {
    submenuType = "item_enemy_targets";
    const targets = getVisibleTargets(getEnemiesInItemRange(item));

    if (targets.length > 0) {
      gameState.selectedTargetId = targets[0].id;
      gameState.message = `Objeto elegido: ${definition.name}. Tocá un enemigo marcado o soltá F para usarlo contra ${targets[0].name}.`;
    } else {
      gameState.message = `Objeto elegido: ${definition.name}. No hay enemigos a ${definition.rangeFeet} pies.`;
    }

    renderActionMenu();
    return;
  }

  if (targeting === ItemTargeting.POINT) {
    submenuType = "item_point";
    gameState.message = `Objeto elegido: ${definition.name}. Tocá un punto del tablero.`;
    renderActionMenu();
    return;
  }

  submenuType = "items";
  gameState.message = `Objeto elegido: ${definition.name}. Soltá F para usarlo.`;
  renderActionMenu();
}

function chooseSpell(spell) {
  gameState.selectedInventoryItemId = null;

  if (spell.targeting === "creature") {
    submenuType = "cure_wounds_targets";
    gameState.selectedAction = spell.actionType;
    clearNonTargetSelections();

    const targets = getCureWoundsTargets();
    gameState.selectedTargetId = targets[0]?.id ?? "player";
    gameState.message = targets.length > 0
      ? `Conjuro elegido: ${spell.name}. Tocá la criatura que querés curar.`
      : `Conjuro elegido: ${spell.name}. No hay criaturas visibles en rango.`;
    return;
  }

  if (spell.targeting === "enemy") {
    submenuType = "magic_missile_targets";
    gameState.selectedAction = spell.actionType;
    clearNonTargetSelections();

    const targets = getVisibleTargets(getEnemiesInMagicMissileRange());
    if (targets.length > 0) {
      gameState.selectedTargetId = targets[0].id;
      gameState.message = `Conjuro elegido: ${spell.name}. Tocá un enemigo marcado o soltá F para apuntar a ${targets[0].name}.`;
    } else {
      gameState.message = `Conjuro elegido: ${spell.name}. No hay enemigos en rango.`;
    }
    return;
  }

  if (spell.targeting === "fire_bolt_direction") {
    submenuType = "fire_bolt_aim";
    gameState.selectedAction = spell.actionType;
    clearAllSelections();
    gameState.message = `Conjuro elegido: ${spell.name}. Tocá un punto para disparar en esa dirección.`;
    return;
  }

  if (spell.targeting === "direction") {
    submenuType = "burning_hands_aim";
    gameState.selectedAction = spell.actionType;
    clearAllSelections();
    gameState.message = `Conjuro elegido: ${spell.name}. Tocá un punto para orientar el cono.`;
    return;
  }

  if (spell.targeting === "point") {
    submenuType = "wall_of_force_point";
    gameState.selectedAction = spell.actionType;
    clearAllSelections();
    gameState.message = `Conjuro elegido: ${spell.name}. Tocá el punto donde crear el muro.`;
    return;
  }

  if (spell.targeting === "fireball_point") {
    submenuType = "fireball_point";
    gameState.selectedAction = spell.actionType;
    clearAllSelections();
    gameState.message = `Conjuro elegido: ${spell.name}. Tocá el punto donde explotará.`;
    return;
  }

  if (spell.targeting === "chromatic_orb_point") {
    submenuType = "chromatic_orb_point";
    gameState.selectedAction = spell.actionType;
    clearAllSelections();
    gameState.message = `Conjuro elegido: ${spell.name}. Tocá un punto inicial; mientras casteás podrás seguir guiándolo con el mouse.`;
    return;
  }

  if (spell.targeting === "vortex_enemy") {
    submenuType = "vortex_warp_targets";
    gameState.selectedAction = spell.actionType;
    clearNonTargetSelections();
    const targets = getVisibleTargets(getEnemiesInVortexWarpRange());
    gameState.selectedTargetId = targets[0]?.id ?? null;
    gameState.message = targets.length > 0
      ? `Conjuro elegido: ${spell.name}. Tocá el enemigo que querés mover.`
      : `Conjuro elegido: ${spell.name}. No hay enemigos en rango.`;
    return;
  }

  if (spell.targeting === "counterspell_enemy") {
    submenuType = "counterspell_targets";
    gameState.selectedAction = spell.actionType;
    clearNonTargetSelections();
    const targets = getVisibleTargets(getCounterspellTargets());
    gameState.selectedTargetId = targets[0]?.id ?? null;
    gameState.message = targets.length > 0
      ? `Conjuro elegido: ${spell.name}. Tocá el casteador enemigo.`
      : `Conjuro elegido: ${spell.name}. No hay casteos enemigos visibles para contrarrestar.`;
    return;
  }

  gameState.selectedAction = spell.actionType;
  clearAllSelections();
  gameState.message = spell.actionType === ActionType.CAST_SHIELD || spell.actionType === ActionType.CAST_COUNTERSPELL
    ? `Conjuro elegido: ${spell.name}. Soltá F para lanzarlo instantáneamente como reacción.`
    : `Conjuro elegido: ${spell.name}. Soltá F para empezar el casteo.`;
}

function renderTargetingHelp({ text, center }) {
  const panel = document.createElement("div");
  panel.className = "action-targeting-help";
  panel.textContent = text;
  panel.style.position = "absolute";
  panel.style.left = `${center.x}px`;
  panel.style.top = `${center.y + 150}px`;
  panel.style.transform = "translateX(-50%)";
  panel.style.padding = "8px 10px";
  panel.style.border = "1px solid rgba(255, 255, 255, 0.35)";
  panel.style.borderRadius = "8px";
  panel.style.background = "rgba(0, 0, 0, 0.72)";
  panel.style.color = "white";
  panel.style.font = "13px monospace";
  panel.style.pointerEvents = "none";
  panel.style.whiteSpace = "nowrap";

  layer.appendChild(panel);
}

function renderTargetIndicators(targets, { variant, onSelect }) {
  if (targets.length === 0) {
    return;
  }

  for (const target of targets) {
    const position = getEntityScreenPosition(target);
    const indicator = document.createElement("button");
    const size = Math.max(TILE_SIZE * 0.9, target.radius * 2 + 14);
    const isSelected = gameState.selectedTargetId === target.id;

    indicator.type = "button";
    indicator.className = `action-target-indicator ${variant}`;
    indicator.title = `${target.name} | ${target.hp}/${target.maxHp} PG`;
    indicator.style.position = "absolute";
    indicator.style.left = `${position.x}px`;
    indicator.style.top = `${position.y}px`;
    indicator.style.width = `${size}px`;
    indicator.style.height = `${size}px`;
    indicator.style.transform = "translate(-50%, -50%)";
    indicator.style.borderRadius = "999px";
    indicator.style.border = isSelected ? "3px solid #ffffff" : getIndicatorBorder(variant);
    indicator.style.background = "rgba(255, 255, 255, 0.04)";
    indicator.style.boxShadow = isSelected
      ? "0 0 14px rgba(255, 255, 255, 0.95)"
      : getIndicatorShadow(variant);
    indicator.style.cursor = "pointer";
    indicator.style.padding = "0";

    indicator.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      onSelect(target);
    });

    layer.appendChild(indicator);
  }
}

function getIndicatorBorder(variant) {
  if (variant === "magic-missile") return "2px solid #7fdbff";
  if (variant === "disintegrate") return "2px solid #66ff99";
  if (variant === "ranged-attack") return "2px solid #c9974d";
  if (variant === "item") return "2px solid #cc99ff";
  if (variant === "vortex") return "2px solid #99ccff";
  if (variant === "counterspell") return "2px solid #ffffff";
  if (variant === "healing") return "2px solid #55ff99";
  return "2px solid #ffdd66";
}

function getIndicatorShadow(variant) {
  if (variant === "magic-missile") return "0 0 10px rgba(127, 219, 255, 0.75)";
  if (variant === "disintegrate") return "0 0 10px rgba(102, 255, 153, 0.85)";
  if (variant === "ranged-attack") return "0 0 10px rgba(201, 151, 77, 0.75)";
  if (variant === "item") return "0 0 10px rgba(204, 153, 255, 0.75)";
  if (variant === "vortex") return "0 0 10px rgba(153, 204, 255, 0.85)";
  if (variant === "counterspell") return "0 0 12px rgba(255, 255, 255, 0.95)";
  if (variant === "healing") return "0 0 10px rgba(85, 255, 153, 0.85)";
  return "0 0 10px rgba(255, 221, 102, 0.75)";
}

function selectAttackTarget(target) {
  gameState.selectedAction = ActionType.ATTACK;
  gameState.selectedTargetId = target.id;
  gameState.selectedBoardPoint = null;
  clearNonTargetSelections();
  gameState.message = `Objetivo elegido: ${target.name}. Soltá F para atacar.`;
  renderActionMenu();
}

function selectAttackPoint(boardPoint, weaponDefinition) {
  gameState.selectedAction = ActionType.ATTACK;
  gameState.selectedTargetId = null;
  gameState.selectedBoardPoint = boardPoint;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.message = `Dirección de disparo elegida para ${weaponDefinition?.name ?? "el arco"}. Soltá F para disparar.`;
  renderActionMenu();
}

function selectCureWoundsTarget(target) {
  gameState.selectedAction = ActionType.CAST_CURE_WOUNDS;
  gameState.selectedTargetId = target.id;
  clearNonTargetSelections();
  gameState.selectedInventoryItemId = null;
  gameState.message = `Objetivo elegido para Sanar heridas: ${target.name}. Soltá F para conjurar.`;
  renderActionMenu();
}

function selectMagicMissileTarget(target) {
  gameState.selectedAction = ActionType.CAST_MAGIC_MISSILE;
  gameState.selectedTargetId = target.id;
  clearNonTargetSelections();
  gameState.selectedInventoryItemId = null;
  gameState.message = `Objetivo elegido: ${target.name}. Soltá F para conjurar Misil mágico.`;
  renderActionMenu();
}


function selectCounterspellTarget(target) {
  gameState.selectedAction = ActionType.CAST_COUNTERSPELL;
  gameState.selectedTargetId = target.id;
  clearNonTargetSelections();
  gameState.selectedInventoryItemId = null;
  gameState.message = `Counterspell preparado contra ${target.name}. Soltá F para interrumpirlo como reacción.`;
  renderActionMenu();
}

function selectVortexWarpTarget(target) {
  gameState.selectedAction = ActionType.CAST_VORTEX_WARP;
  gameState.selectedTargetId = target.id;
  gameState.selectedBoardPoint = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  submenuType = "vortex_warp_point";
  gameState.message = `Objetivo elegido: ${target.name}. Ahora tocá el destino dentro de 90 pies.`;
  renderActionMenu();
}

function selectVortexWarpPoint(boardPoint) {
  gameState.selectedAction = ActionType.CAST_VORTEX_WARP;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = boardPoint;

  if (getDistance(player, boardPoint) > VORTEX_WARP_RANGE_PIXELS) {
    gameState.message = "Destino elegido, pero está fuera del rango de Vortex Warp.";
  } else {
    gameState.message = "Destino elegido para Vortex Warp. Soltá F para empezar el casteo.";
  }

  renderActionMenu();
}

function selectFireballPoint(boardPoint) {
  gameState.selectedAction = ActionType.CAST_FIREBALL;
  gameState.selectedTargetId = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = boardPoint;

  if (getDistance(player, boardPoint) > FIREBALL_RANGE_PIXELS) {
    gameState.message = "Punto elegido, pero está fuera del rango de Bola de fuego.";
  } else {
    gameState.message = "Punto elegido para Bola de fuego. Soltá F para empezar el casteo.";
  }

  renderActionMenu();
}

function selectItemTarget(target) {
  const item = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
  const definition = getItemDefinition(item);

  gameState.selectedAction = ActionType.USE_ITEM;
  gameState.selectedTargetId = target.id;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;
  gameState.message = `Objetivo elegido: ${target.name}. Soltá F para usar ${definition?.name ?? "el objeto"}.`;
  renderActionMenu();
}


function getCureWoundsTargets() {
  const creatures = [
    createCreatureTarget(player, "player"),
    ...getLivingEnemies().map((enemy) => createCreatureTarget(enemy, `enemy:${enemy.id}`)),
    ...getVisibleMerchants().filter((merchant) => merchant.hp > 0).map((merchant) => createCreatureTarget(merchant, `merchant:${merchant.id}`)),
  ];

  return creatures.filter((target) => {
    if (getSurfaceDistance(player, target) > HEALING_WORD_RANGE_PIXELS) {
      return false;
    }

    if (target.entity !== player && !isEntityVisibleToPlayer(target.entity, player)) {
      return false;
    }

    return target.hp > 0;
  });
}

function createCreatureTarget(entity, id) {
  return {
    id,
    entity,
    name: entity === player ? "Jugador" : entity.name,
    x: entity.x,
    y: entity.y,
    radius: entity.radius,
    hp: entity.hp,
    maxHp: entity.maxHp,
  };
}

function getEnemiesInVortexWarpRange() {
  return getLivingEnemies().filter((enemy) => getSurfaceDistance(player, enemy) <= VORTEX_WARP_RANGE_PIXELS);
}

function getCounterspellTargets() {
  return getLivingEnemies().filter((enemy) => {
    if (getSurfaceDistance(player, enemy) > COUNTERSPELL_RANGE_PIXELS) {
      return false;
    }

    return enemy.actionWindupType === "magic_missile" || enemy.actionWindupType === "dragon_breath";
  });
}

function renderFireballPreview() {
  if (!gameState.selectedBoardPoint) {
    return;
  }

  const inRange = getDistance(player, gameState.selectedBoardPoint) <= FIREBALL_RANGE_PIXELS;
  renderCirclePreview(gameState.selectedBoardPoint, FIREBALL_RADIUS_PIXELS, inRange, "#ff6600");
}

function renderVortexWarpPreview() {
  if (!gameState.selectedBoardPoint) {
    return;
  }

  const inRange = getDistance(player, gameState.selectedBoardPoint) <= VORTEX_WARP_RANGE_PIXELS;
  renderCirclePreview(gameState.selectedBoardPoint, TILE_SIZE * 0.6, inRange, "#99ccff");
}

function renderCirclePreview(point, radiusPixels, inRange, color) {
  const position = getBoardPointScreenPosition(point);
  const marker = document.createElement("div");

  marker.style.position = "absolute";
  marker.style.left = `${position.x}px`;
  marker.style.top = `${position.y}px`;
  marker.style.width = `${radiusPixels * 2}px`;
  marker.style.height = `${radiusPixels * 2}px`;
  marker.style.transform = "translate(-50%, -50%)";
  marker.style.borderRadius = "999px";
  marker.style.border = inRange ? `2px solid ${color}` : "2px solid #ff3333";
  marker.style.background = inRange ? "rgba(255, 102, 0, 0.12)" : "rgba(255, 0, 0, 0.14)";
  marker.style.boxShadow = inRange ? `0 0 14px ${color}` : "0 0 12px rgba(255, 0, 0, 0.75)";
  marker.style.pointerEvents = "none";

  layer.appendChild(marker);
}

function renderAnalysisSelectionPreview() {
  if (!gameState.selectedAnalysisPoint) {
    return;
  }

  const position = getBoardPointScreenPosition(gameState.selectedAnalysisPoint);
  const marker = document.createElement("div");

  marker.style.position = "absolute";
  marker.style.left = `${position.x}px`;
  marker.style.top = `${position.y}px`;
  marker.style.width = `${TILE_SIZE}px`;
  marker.style.height = `${TILE_SIZE}px`;
  marker.style.transform = "translate(-50%, -50%)";
  marker.style.borderRadius = "999px";
  marker.style.border = "2px solid #ffffff";
  marker.style.boxShadow = "0 0 12px rgba(255, 255, 255, 0.85)";
  marker.style.pointerEvents = "none";

  layer.appendChild(marker);
}

function analyzeBoardPoint(boardPoint) {
  gameState.selectedAnalysisPoint = boardPoint;
  gameState.selectedAction = ActionType.ANALYZE;

  const creature = findVisibleCreatureAtPoint(boardPoint);
  gameState.infoPortraitKey = creature ? requestCreaturePortrait(creature) : null;
  gameState.infoMessage = buildAnalysisInfo(boardPoint, creature);
  gameState.message = "Analizas el elemento seleccionado.";
  renderActionMenu();
}

function buildAnalysisInfo(boardPoint, alreadyFoundCreature = null) {
  const creature = alreadyFoundCreature ?? findVisibleCreatureAtPoint(boardPoint);

  if (creature) {
    return describeCreature(creature);
  }

  const chest = findVisibleChestAtPoint(boardPoint);

  if (chest) {
    const contents = chest.opened
      ? "vacío"
      : chest.contents.map((entry) => {
          const definition = getItemDefinition(entry.definitionId);
          return `${definition?.name ?? entry.definitionId}${entry.quantity > 1 ? ` x${entry.quantity}` : ""}`;
        }).join(", ");

    return [
      "ANÁLISIS: cofre",
      `Estado: ${chest.opened ? "abierto" : "cerrado"}.`,
      `Contenido estimado: ${contents || "desconocido"}.`,
      "Interacción: haz click estando a 5 pies para lootearlo.",
    ].join("\n");
  }

  const item = findVisibleGroundItemAtPoint(boardPoint);

  if (item) {
    const definition = getItemDefinition(item);
    return [
      "ANÁLISIS: objeto",
      `Nombre: ${definition?.name ?? item.definitionId}.`,
      `Cantidad: ${item.quantity ?? 1}.`,
      `Descripción: ${definition?.description ?? "Sin descripción."}`,
    ].join("\n");
  }

  const row = Math.floor(boardPoint.y / TILE_SIZE);
  const col = Math.floor(boardPoint.x / TILE_SIZE);

  if (row < 0 || row >= mapRows || col < 0 || col >= mapCols) {
    return "ANÁLISIS: fuera del mapa.";
  }

  const torch = getTorchAt(row, col);

  if (torch) {
    return [
      "ANÁLISIS: antorcha",
      "Fuente de luz activa.",
      "Puedes tomarla caminando sobre su casilla y volver a colocarla desde Usar objeto.",
    ].join("\n");
  }

  if (isTemporaryWallAt(row, col)) {
    const wall = getTemporaryWalls().find((candidate) => candidate.row === row && candidate.col === col);
    return `ANÁLISIS: muro temporal de fuerza\nBloque amarillo sólido. Duración restante: ${wall?.remaining?.toFixed(1) ?? "?"}s.`;
  }

  const tile = map[row][col];

  if (tile === DUNGEON_WALL_CHAR) {
    return "ANÁLISIS: pared\nBloque sólido. No se puede atravesar. Bloquea visión y movimiento.";
  }

  if (tile === DUNGEON_DOOR_CHAR) {
    return "ANÁLISIS: puerta\nUmbral transitable. Al cruzarla puede generar una nueva zona de mazmorra.";
  }

  if (tile === DUNGEON_STAIRS_CHAR) {
    return "ANÁLISIS: escaleras descendentes\nBajan al siguiente piso. Tus acompañantes contratadas bajarán contigo.";
  }

  if (tile === DUNGEON_STAIRS_UP_CHAR) {
    return "ANÁLISIS: escaleras ascendentes\nSuben al piso anterior. Tus acompañantes contratadas subirán contigo.";
  }

  if (tile === DUNGEON_FLOOR_CHAR) {
    return "ANÁLISIS: suelo\nEspacio navegable.";
  }

  return `ANÁLISIS: terreno desconocido (${tile}).`;
}

function findVisibleCreatureAtPoint(point) {
  const candidates = [player, ...getLivingEnemies(), ...getVisibleMerchants()];

  return candidates.find((entity) => {
    if (entity !== player && !isEntityVisibleToPlayer(entity, player)) {
      return false;
    }

    return Math.hypot(point.x - entity.x, point.y - entity.y) <= Math.max(entity.radius + TILE_SIZE * 0.35, TILE_SIZE * 0.55);
  }) ?? null;
}

function getVisibleMerchants() {
  return merchants.filter((merchant) => isEntityVisibleToPlayer(merchant, player));
}

function findVisibleChestAtPoint(point) {
  return chests.find((chest) => {
    return isEntityVisibleToPlayer(chest, player) &&
      Math.hypot(point.x - chest.x, point.y - chest.y) <= Math.max(chest.radius + TILE_SIZE * 0.35, TILE_SIZE * 0.55);
  }) ?? null;
}

function findVisibleGroundItemAtPoint(point) {
  return groundItems.find((item) => {
    return isEntityVisibleToPlayer(item, player) &&
      Math.hypot(point.x - item.x, point.y - item.y) <= Math.max(item.radius + TILE_SIZE * 0.35, TILE_SIZE * 0.5);
  }) ?? null;
}

function describeCreature(creature) {
  if (creature === player) {
    return [
      "FICHA: personaje jugador",
      `Nombre: ${player.name}.`,
      `PG: ${player.hp}/${player.maxHp}.`,
      `Oro: ${player.gold} po.`,
      `Defensas activas: ${player.shieldRemaining > 0 ? `Escudo (${player.shieldRemaining.toFixed(1)}s)` : "ninguna"}.`,
      `Recursos: ataque CD ${(player.attackCooldown ?? 0).toFixed(1)}s; conjuros CD ${(player.spellCooldown ?? 0).toFixed(1)}s.`,
    ].join("\n");
  }

  if (creature.name === "Vendedora arcana" || creature.name === "Vendedora arcana aliada") {
    const hostility = creature.isHostile
      ? "hostil"
      : creature.isHired
        ? "aliada contratada"
        : "no hostil";

    return [
      "FICHA: humanoide arcana",
      `Nombre: ${creature.name}.`,
      `Actitud: ${hostility}.`,
      `PG: ${creature.hp}/${creature.maxHp}.`,
      creature.isHired
        ? "Rol táctico: acompañante; prioriza sobrevivir y usa Misil mágico contra enemigos visibles."
        : "Rol social: mercader arcana; puede comerciar o dialogar mientras no sea hostil.",
      `Magia observable: Misil mágico; cooldown ${(creature.spellCooldown ?? 0).toFixed(1)}s.`,
    ].join("\n");
  }

  if (creature.kind === "dragon_boss") {
    const hostility = creature.isHostile === false ? "no hostil" : "hostil";

    return [
      "FICHA: dragón jefe",
      `Nombre: ${creature.name ?? "Dragón"}.`,
      `Actitud: ${hostility}.`,
      `PG: ${creature.hp}/${creature.maxHp}.`,
      "Tamaño: enorme para la escala local; ocupa aproximadamente 3 casillas.",
      `Acciones: mordida/garras en melee; llamarada mayor de cono.`,
      `Recursos: ataque CD ${(creature.attackCooldown ?? 0).toFixed(1)}s; aliento CD ${(creature.breathCooldown ?? 0).toFixed(1)}s.`,
    ].join("\n");
  }

  if (creature.kind === "centipede_part") {
    const role = creature.isCentipedeHead ? "cabeza activa" : "segmento corporal";
    const hostility = creature.isHostile === false ? "no hostil" : "hostil";

    return [
      "FICHA: monstruosidad segmentada",
      `Nombre: ${creature.name ?? "Ciempiés"}.`,
      `Actitud: ${hostility}.`,
      `Rol anatómico: ${role}.`,
      `PG de esta parte: ${creature.hp}/${creature.maxHp}.`,
      "Movimiento: avanza por segmentos; puede atravesar bloques sólidos.",
      creature.isCentipedeHead
        ? `Acción: ataque de cabeza; cooldown ${(creature.attackCooldown ?? 0).toFixed(1)}s.`
        : "Acción: no ataca salvo que llegue a convertirse en cabeza.",
      "Rasgo: si muere una parte intermedia, la cadena posterior puede formar otro ciempiés.",
    ].join("\n");
  }

  const hostileText = creature.isHostile === false ? "no hostil" : "hostil";
  const magicText = creature.canCastMagicMissile
    ? `Magia observable: Misil mágico; cooldown ${(creature.spellCooldown ?? 0).toFixed(1)}s.`
    : "Magia observable: ninguna detectada.";

  return [
    "FICHA: criatura",
    `Nombre: ${creature.name ?? "enemigo"}.`,
    `Actitud: ${hostileText}.`,
    `PG: ${creature.hp}/${creature.maxHp}.`,
    `Estado táctico: ${creature.state ?? "desconocido"}.`,
    `Ataque: cooldown ${(creature.attackCooldown ?? 0).toFixed(1)}s.`,
    magicText,
  ].join("\n");
}

function renderDodgePreview() {
  if (!gameState.selectedDodgeDirection) {
    return;
  }

  renderLinePreview({
    direction: gameState.selectedDodgeDirection,
    distancePixels: DODGE_DISTANCE_PIXELS,
    color: "rgba(0, 255, 102, 0.75)",
    markerBorder: "2px solid #00ff66",
    markerShadow: "0 0 10px rgba(0, 255, 102, 0.75)",
  });
}

function renderBurningHandsPreview() {
  if (!gameState.selectedAimDirection) {
    return;
  }

  renderConePreview(gameState.selectedAimDirection);
}

function renderFireBoltPreview() {
  if (!gameState.selectedAimDirection) {
    return;
  }

  renderLinePreview({
    direction: gameState.selectedAimDirection,
    distancePixels: FIRE_BOLT_RANGE_PIXELS,
    color: "rgba(255, 80, 0, 0.75)",
    markerBorder: "2px solid #ff5000",
    markerShadow: "0 0 10px rgba(255, 80, 0, 0.85)",
  });
}

function renderChromaticOrbPreview() {
  if (!gameState.selectedBoardPoint) {
    return;
  }

  const inRange = getDistance(player, gameState.selectedBoardPoint) <= CHROMATIC_ORB_RANGE_PIXELS;
  renderCirclePreview(gameState.selectedBoardPoint, TILE_SIZE * 0.45, inRange, "#66d9ff");
}


function renderWallOfForcePreview() {
  if (!gameState.selectedBoardPoint) {
    return;
  }

  const inRange = getDistance(player, gameState.selectedBoardPoint) <= WALL_OF_FORCE_RANGE_PIXELS;
  const tiles = getWallOfForceTiles(player, gameState.selectedBoardPoint);
  renderTilePreview(tiles, inRange, "#ffdd00");
}

function renderWeaponAimPreview(weapon) {
  if (!gameState.selectedBoardPoint) {
    return;
  }

  const definition = getItemDefinition(weapon);
  const direction = normalizeVector(gameState.selectedBoardPoint.x - player.x, gameState.selectedBoardPoint.y - player.y);

  renderLinePreview({
    direction,
    distancePixels: definition?.rangePixels ?? BOW_ATTACK_RANGE_PIXELS,
    color: "rgba(201, 151, 77, 0.75)",
    markerBorder: "2px solid #c9974d",
    markerShadow: "0 0 10px rgba(201, 151, 77, 0.75)",
  });
}

function renderItemPointPreview(item) {
  if (!gameState.selectedBoardPoint) {
    return;
  }

  const definition = getItemDefinition(item);
  const inRange = getDistance(player, gameState.selectedBoardPoint) <= getItemRangePixels(item);

  if (definition?.id === ItemId.SCROLL_FORCECAGE) {
    renderTilePreview(getForcecageTiles(gameState.selectedBoardPoint), inRange, "#cc99ff");
    return;
  }

  const direction = normalizeVector(gameState.selectedBoardPoint.x - player.x, gameState.selectedBoardPoint.y - player.y);
  const previewDistance = definition?.id === ItemId.TORCH
    ? getItemRangePixels(item)
    : Math.min(getDistance(player, gameState.selectedBoardPoint), MISTY_STEP_RANGE_PIXELS);
  const previewInRange = definition?.id === ItemId.TORCH || inRange;

  renderLinePreview({
    direction,
    distancePixels: previewDistance,
    color: previewInRange ? "rgba(153, 221, 255, 0.75)" : "rgba(255, 51, 51, 0.75)",
    markerBorder: previewInRange ? "2px solid #99ddff" : "2px solid #ff3333",
    markerShadow: previewInRange ? "0 0 10px rgba(153, 221, 255, 0.75)" : "0 0 10px rgba(255, 51, 51, 0.75)",
  });
}

function renderTilePreview(tiles, inRange, color) {
  for (const tile of tiles) {
    const position = getBoardPointScreenPosition({
      x: tile.col * TILE_SIZE + TILE_SIZE / 2,
      y: tile.row * TILE_SIZE + TILE_SIZE / 2,
    });
    const marker = document.createElement("div");

    marker.style.position = "absolute";
    marker.style.left = `${position.x}px`;
    marker.style.top = `${position.y}px`;
    marker.style.width = `${TILE_SIZE}px`;
    marker.style.height = `${TILE_SIZE}px`;
    marker.style.transform = "translate(-50%, -50%)";
    marker.style.border = inRange ? `2px solid ${color}` : "2px solid #ff3333";
    marker.style.background = inRange ? "rgba(255, 255, 255, 0.15)" : "rgba(255, 0, 0, 0.18)";
    marker.style.boxShadow = inRange ? `0 0 12px ${color}` : "0 0 12px rgba(255, 0, 0, 0.75)";
    marker.style.pointerEvents = "none";

    layer.appendChild(marker);
  }
}

function renderLinePreview({ direction, distancePixels, color, markerBorder, markerShadow }) {
  const vector = normalizeVector(direction.x, direction.y);

  if (vector.x === 0 && vector.y === 0) {
    return;
  }

  const target = {
    x: player.x + vector.x * distancePixels,
    y: player.y + vector.y * distancePixels,
  };

  const playerPosition = getPlayerScreenPosition();
  const targetPosition = getBoardPointScreenPosition(target);
  const distance = Math.hypot(targetPosition.x - playerPosition.x, targetPosition.y - playerPosition.y);
  const angle = Math.atan2(targetPosition.y - playerPosition.y, targetPosition.x - playerPosition.x);

  const line = document.createElement("div");
  line.style.position = "absolute";
  line.style.left = `${playerPosition.x}px`;
  line.style.top = `${playerPosition.y}px`;
  line.style.width = `${distance}px`;
  line.style.height = "2px";
  line.style.transformOrigin = "0 50%";
  line.style.transform = `rotate(${angle}rad)`;
  line.style.background = color;
  line.style.pointerEvents = "none";

  const marker = document.createElement("div");
  marker.style.position = "absolute";
  marker.style.left = `${targetPosition.x}px`;
  marker.style.top = `${targetPosition.y}px`;
  marker.style.width = `${TILE_SIZE * 0.75}px`;
  marker.style.height = `${TILE_SIZE * 0.75}px`;
  marker.style.transform = "translate(-50%, -50%)";
  marker.style.borderRadius = "999px";
  marker.style.border = markerBorder;
  marker.style.boxShadow = markerShadow;
  marker.style.pointerEvents = "none";

  layer.appendChild(line);
  layer.appendChild(marker);
}

function renderConePreview(direction) {
  const vector = normalizeVector(direction.x, direction.y);

  if (vector.x === 0 && vector.y === 0) {
    return;
  }

  const playerPosition = getPlayerScreenPosition();
  const angle = Math.atan2(vector.y, vector.x);
  const left = angle - BURNING_HANDS_CONE_ANGLE_RADIANS / 2;
  const right = angle + BURNING_HANDS_CONE_ANGLE_RADIANS / 2;
  const points = [
    playerPosition,
    {
      x: playerPosition.x + Math.cos(left) * BURNING_HANDS_RANGE_PIXELS,
      y: playerPosition.y + Math.sin(left) * BURNING_HANDS_RANGE_PIXELS,
    },
    {
      x: playerPosition.x + Math.cos(right) * BURNING_HANDS_RANGE_PIXELS,
      y: playerPosition.y + Math.sin(right) * BURNING_HANDS_RANGE_PIXELS,
    },
  ];

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.left = "0";
  svg.style.top = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";
  svg.style.pointerEvents = "none";

  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
  polygon.setAttribute("fill", "rgba(255, 51, 0, 0.20)");
  polygon.setAttribute("stroke", "rgba(255, 80, 0, 0.95)");
  polygon.setAttribute("stroke-width", "2");

  svg.appendChild(polygon);
  layer.appendChild(svg);
}


function isReaimableCastingSpell(spell) {
  return spell === ActionType.CAST_FIREBALL ||
    spell === ActionType.CAST_FIRE_BOLT ||
    spell === ActionType.CAST_CHROMATIC_ORB ||
    spell === ActionType.CAST_BURNING_HANDS;
}

function renderCastingAimPreview() {
  const playerScreenPosition = getPlayerScreenPosition();

  if (player.castingSpell === ActionType.CAST_BURNING_HANDS) {
    renderTargetingHelp({
      text: `Casteando Manos ardientes. Mové el mouse para reapuntar el cono. Descarga: ${Math.max(0, player.castingRemaining).toFixed(1)}s.`,
      center: playerScreenPosition,
    });

    const direction = player.castingAimDirection ?? gameState.selectedAimDirection;

    if (direction) {
      renderConePreview(direction);
    }

    return;
  }

  if (player.castingSpell === ActionType.CAST_FIREBALL) {
    renderTargetingHelp({
      text: `Casteando Bola de fuego. Mové el mouse para reapuntar. Detonación: ${Math.max(0, player.castingRemaining).toFixed(1)}s.`,
      center: playerScreenPosition,
    });

    const point = player.castingBoardPoint ?? gameState.selectedBoardPoint ?? gameState.mouseWorldPoint;

    if (point) {
      const inRange = getDistance(player, point) <= FIREBALL_RANGE_PIXELS;
      renderCirclePreview(point, FIREBALL_RADIUS_PIXELS, inRange, "#ff6600");
    }

    return;
  }

  if (player.castingSpell === ActionType.CAST_FIRE_BOLT) {
    renderTargetingHelp({
      text: `Casteando Saeta de fuego. Mové el mouse para reapuntar la línea. Disparo: ${Math.max(0, player.castingRemaining).toFixed(1)}s.`,
      center: playerScreenPosition,
    });

    const direction = player.castingAimDirection ?? gameState.selectedAimDirection;

    if (direction) {
      renderLinePreview({
        direction,
        distancePixels: FIRE_BOLT_RANGE_PIXELS,
        color: "rgba(255, 80, 0, 0.75)",
        markerBorder: "2px solid #ff5000",
        markerShadow: "0 0 10px rgba(255, 80, 0, 0.85)",
      });
    }

    return;
  }

  if (player.castingSpell === ActionType.CAST_CHROMATIC_ORB) {
    renderTargetingHelp({
      text: `Casteando Orbe cromático. Mové el mouse para reapuntar el punto que seguirá el orbe. Lanzamiento: ${Math.max(0, player.castingRemaining).toFixed(1)}s.`,
      center: playerScreenPosition,
    });

    const point = player.castingBoardPoint ?? gameState.selectedBoardPoint ?? gameState.mouseWorldPoint;

    if (point) {
      const inRange = getDistance(player, point) <= CHROMATIC_ORB_RANGE_PIXELS;
      renderCirclePreview(point, TILE_SIZE * 0.45, inRange, "#66d9ff");
      const direction = normalizeVector(point.x - player.x, point.y - player.y);

      if (direction.x !== 0 || direction.y !== 0) {
        renderLinePreview({
          direction,
          distancePixels: Math.min(getDistance(player, point), CHROMATIC_ORB_RANGE_PIXELS),
          color: "rgba(102, 217, 255, 0.55)",
          markerBorder: "2px solid #66d9ff",
          markerShadow: "0 0 10px rgba(102, 217, 255, 0.75)",
        });
      }
    }
  }
}

function handleBoardPointerMove(event) {
  const boardPoint = getBoardPointFromPointer(event);

  if (!boardPoint) {
    return;
  }

  gameState.mouseWorldPoint = boardPoint;

  if (player.isCasting) {
    updateCastingAimFromBoardPoint(boardPoint);
    return;
  }

  if (updateLiveTargetingPreviewFromBoardPoint(boardPoint)) {
    renderActionMenu();
  }
}

function updateLiveTargetingPreviewFromBoardPoint(boardPoint) {
  if (submenuType === "burning_hands_aim") {
    const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

    if (direction.x === 0 && direction.y === 0) {
      return false;
    }

    gameState.selectedAction = ActionType.CAST_BURNING_HANDS;
    gameState.selectedTargetId = null;
    gameState.selectedInventoryItemId = null;
    gameState.selectedDodgeDirection = null;
    gameState.selectedAimDirection = direction;
    gameState.selectedBoardPoint = null;
    return true;
  }

  if (submenuType === "fire_bolt_aim") {
    const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

    if (direction.x === 0 && direction.y === 0) {
      return false;
    }

    gameState.selectedAction = ActionType.CAST_FIRE_BOLT;
    gameState.selectedTargetId = null;
    gameState.selectedInventoryItemId = null;
    gameState.selectedDodgeDirection = null;
    gameState.selectedAimDirection = direction;
    gameState.selectedBoardPoint = null;
    return true;
  }

  if (submenuType === "fireball_point") {
    gameState.selectedAction = ActionType.CAST_FIREBALL;
    gameState.selectedTargetId = null;
    gameState.selectedInventoryItemId = null;
    gameState.selectedDodgeDirection = null;
    gameState.selectedAimDirection = null;
    gameState.selectedBoardPoint = boardPoint;
    return true;
  }

  if (submenuType === "chromatic_orb_point") {
    gameState.selectedAction = ActionType.CAST_CHROMATIC_ORB;
    gameState.selectedTargetId = null;
    gameState.selectedInventoryItemId = null;
    gameState.selectedDodgeDirection = null;
    gameState.selectedAimDirection = null;
    gameState.selectedBoardPoint = boardPoint;
    return true;
  }

  return false;
}

function updateCastingAimFromBoardPoint(boardPoint) {
  if (!player.isCasting) {
    return;
  }

  if (player.castingSpell === ActionType.CAST_BURNING_HANDS) {
    const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

    if (direction.x !== 0 || direction.y !== 0) {
      player.castingAimDirection = direction;
      gameState.selectedAimDirection = direction;
    }

    return;
  }

  if (player.castingSpell === ActionType.CAST_FIREBALL) {
    player.castingBoardPoint = boardPoint;
    gameState.selectedBoardPoint = boardPoint;
    return;
  }

  if (player.castingSpell === ActionType.CAST_FIRE_BOLT) {
    const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

    if (direction.x !== 0 || direction.y !== 0) {
      player.castingAimDirection = direction;
      gameState.selectedAimDirection = direction;
    }

    return;
  }

  if (player.castingSpell === ActionType.CAST_CHROMATIC_ORB) {
    player.castingBoardPoint = boardPoint;
    gameState.selectedBoardPoint = boardPoint;
  }
}

function handleBoardPointerDown(event) {
  if (event.target.closest("button") || event.target.closest(".action-submenu")) {
    return;
  }

  const boardPoint = getBoardPointFromPointer(event);

  if (!boardPoint) {
    return;
  }

  if (!isBoardTargetingActive()) {
    if (pickupTorchAtPoint(boardPoint) || lootChestAtPoint(boardPoint)) {
      event.preventDefault();
      event.stopPropagation();
    }

    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (submenuType === "dodge") {
    selectDodgeDirectionFromPoint(boardPoint);
    return;
  }

  if (submenuType === "analyze") {
    analyzeBoardPoint(boardPoint);
    return;
  }

  if (submenuType === "weapon_targets") {
    const weapon = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
    const targets = getVisibleTargets(getEnemiesInWeaponRange(weapon));
    const closestTarget = findClosestClickedTarget(boardPoint, targets);

    if (closestTarget) {
      selectAttackTarget(closestTarget);
      return;
    }

    gameState.message = "No tocaste un enemigo válido. Elegí uno marcado en el tablero.";
    renderActionMenu();
    return;
  }

  if (submenuType === "weapon_aim") {
    const weapon = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
    const definition = getItemDefinition(weapon);
    selectAttackPoint(boardPoint, definition);
    return;
  }

  if (submenuType === "cure_wounds_targets") {
    selectClosestBoardTarget(boardPoint, getCureWoundsTargets(), selectCureWoundsTarget);
    return;
  }

  if (submenuType === "magic_missile_targets") {
    selectClosestBoardTarget(boardPoint, getVisibleTargets(getEnemiesInMagicMissileRange()), selectMagicMissileTarget);
    return;
  }

  if (submenuType === "counterspell_targets") {
    selectClosestBoardTarget(boardPoint, getVisibleTargets(getCounterspellTargets()), selectCounterspellTarget);
    return;
  }

  if (submenuType === "vortex_warp_targets") {
    selectClosestBoardTarget(boardPoint, getVisibleTargets(getEnemiesInVortexWarpRange()), selectVortexWarpTarget);
    return;
  }

  if (submenuType === "vortex_warp_point") {
    selectVortexWarpPoint(boardPoint);
    return;
  }

  if (submenuType === "item_enemy_targets") {
    const item = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
    selectClosestBoardTarget(boardPoint, getVisibleTargets(getEnemiesInItemRange(item)), selectItemTarget);
    return;
  }

  if (submenuType === "burning_hands_aim") {
    selectAimDirectionFromPoint(boardPoint);
    return;
  }

  if (submenuType === "fire_bolt_aim") {
    selectFireBoltDirectionFromPoint(boardPoint);
    return;
  }

  if (submenuType === "wall_of_force_point") {
    selectWallPoint(boardPoint);
    return;
  }

  if (submenuType === "fireball_point") {
    selectFireballPoint(boardPoint);
    return;
  }

  if (submenuType === "chromatic_orb_point") {
    selectChromaticOrbPoint(boardPoint);
    return;
  }

  if (submenuType === "item_point") {
    selectItemPoint(boardPoint);
  }
}

function isBoardTargetingActive() {
  return (
    submenuType === "dodge" ||
    submenuType === "analyze" ||
    submenuType === "weapon_targets" ||
    submenuType === "weapon_aim" ||
    submenuType === "cure_wounds_targets" ||
    submenuType === "magic_missile_targets" ||
    submenuType === "counterspell_targets" ||
    submenuType === "vortex_warp_targets" ||
    submenuType === "vortex_warp_point" ||
    submenuType === "item_enemy_targets" ||
    submenuType === "burning_hands_aim" ||
    submenuType === "fire_bolt_aim" ||
    submenuType === "chromatic_orb_point" ||
    submenuType === "wall_of_force_point" ||
    submenuType === "fireball_point" ||
    submenuType === "item_point"
  );
}

function selectDodgeDirectionFromPoint(boardPoint) {
  const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

  if (direction.x === 0 && direction.y === 0) {
    gameState.message = "Elegí un punto distinto al centro del jugador.";
    return;
  }

  const livingEnemies = getLivingEnemies();
  const nextX = player.x + direction.x * DODGE_DISTANCE_PIXELS;
  const nextY = player.y + direction.y * DODGE_DISTANCE_PIXELS;

  gameState.selectedAction = ActionType.DODGE;
  gameState.selectedTargetId = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = direction;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;

  if (!canPlaceEntityAt(player, nextX, nextY, { blockers: livingEnemies })) {
    gameState.message = "Dirección elegida, pero el destino está bloqueado. Podés tocar otro punto o soltar F para intentar igual.";
  } else {
    gameState.message = "Dirección de esquiva elegida. Soltá F para moverte 5 pies.";
  }

  renderActionMenu();
}

function selectAimDirectionFromPoint(boardPoint) {
  const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

  if (direction.x === 0 && direction.y === 0) {
    gameState.message = "Elegí un punto distinto al centro del jugador.";
    return;
  }

  gameState.selectedAction = ActionType.CAST_BURNING_HANDS;
  gameState.selectedTargetId = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = direction;
  gameState.selectedBoardPoint = null;
  gameState.message = "Dirección elegida para Manos ardientes. Soltá F para empezar el casteo.";

  renderActionMenu();
}

function selectFireBoltDirectionFromPoint(boardPoint) {
  const direction = normalizeVector(boardPoint.x - player.x, boardPoint.y - player.y);

  if (direction.x === 0 && direction.y === 0) {
    gameState.message = "Elegí un punto distinto al centro del jugador.";
    return;
  }

  gameState.selectedAction = ActionType.CAST_FIRE_BOLT;
  gameState.selectedTargetId = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = direction;
  gameState.selectedBoardPoint = null;
  gameState.message = "Dirección elegida para Saeta de fuego. Soltá F para empezar el casteo.";

  renderActionMenu();
}


function selectChromaticOrbPoint(boardPoint) {
  gameState.selectedAction = ActionType.CAST_CHROMATIC_ORB;
  gameState.selectedTargetId = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = boardPoint;

  if (getDistance(player, boardPoint) > CHROMATIC_ORB_RANGE_PIXELS) {
    gameState.message = "Punto elegido, pero está fuera del rango de Orbe cromático.";
  } else {
    gameState.message = "Punto inicial elegido para Orbe cromático. Soltá F para empezar el casteo.";
  }

  renderActionMenu();
}

function selectWallPoint(boardPoint) {
  gameState.selectedAction = ActionType.CAST_WALL_OF_FORCE;
  gameState.selectedTargetId = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = boardPoint;

  if (getDistance(player, boardPoint) > WALL_OF_FORCE_RANGE_PIXELS) {
    gameState.message = "Punto elegido, pero está fuera de rango. Tocá otro punto o soltá F para intentar igual.";
  } else {
    gameState.message = "Punto elegido para Muro de fuerza. Soltá F para empezar el casteo.";
  }

  renderActionMenu();
}

function selectItemPoint(boardPoint) {
  const item = getInventoryItemByInstanceId(gameState.selectedInventoryItemId);
  const definition = getItemDefinition(item);

  gameState.selectedAction = ActionType.USE_ITEM;
  gameState.selectedTargetId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = boardPoint;

  if (definition?.id === ItemId.TORCH) {
    gameState.message = "Dirección elegida para colocar la antorcha a 5 pies. Soltá F para usarla.";
  } else if (getDistance(player, boardPoint) > getItemRangePixels(item)) {
    gameState.message = `Punto elegido, pero está fuera de rango para ${definition?.name ?? "el objeto"}.`;
  } else {
    gameState.message = `Punto elegido para ${definition?.name ?? "el objeto"}. Soltá F para usarlo.`;
  }

  renderActionMenu();
}

function selectClosestBoardTarget(boardPoint, targets, onSelect) {
  const closestTarget = findClosestClickedTarget(boardPoint, targets);

  if (!closestTarget) {
    gameState.message = "No tocaste un enemigo válido. Elegí uno marcado en el tablero.";
    renderActionMenu();
    return;
  }

  onSelect(closestTarget);
}

function findClosestClickedTarget(boardPoint, targets) {
  let closestTarget = null;
  let closestDistance = Infinity;

  for (const target of targets) {
    const distance = Math.hypot(boardPoint.x - target.x, boardPoint.y - target.y);
    const clickRadius = Math.max(TILE_SIZE * 0.75, target.radius + TILE_SIZE * 0.35);

    if (distance <= clickRadius && distance < closestDistance) {
      closestTarget = target;
      closestDistance = distance;
    }
  }

  return closestTarget;
}


function renderPaginatedList({ submenu, pageKey, items, emptyText, renderItem }) {
  if (!items || items.length === 0) {
    const empty = document.createElement("div");
    empty.className = "action-submenu-empty";
    empty.textContent = emptyText;
    submenu.appendChild(empty);
    submenuPages.set(pageKey, 0);
    return;
  }

  const totalPages = Math.max(1, Math.ceil(items.length / SUBMENU_PAGE_SIZE));
  const currentPage = Math.min(submenuPages.get(pageKey) ?? 0, totalPages - 1);
  submenuPages.set(pageKey, currentPage);

  const startIndex = currentPage * SUBMENU_PAGE_SIZE;
  const pageItems = items.slice(startIndex, startIndex + SUBMENU_PAGE_SIZE);

  for (const item of pageItems) {
    submenu.appendChild(renderItem(item));
  }

  if (items.length > SUBMENU_PAGE_SIZE) {
    const pager = document.createElement("div");
    pager.className = "action-submenu-pager";
    pager.style.display = "flex";
    pager.style.alignItems = "center";
    pager.style.justifyContent = "space-between";
    pager.style.gap = "8px";
    pager.style.marginTop = "6px";

    const previous = createPagerButton("‹ Anterior", currentPage <= 0, () => {
      submenuPages.set(pageKey, Math.max(0, currentPage - 1));
      renderActionMenu();
    });

    const label = document.createElement("div");
    label.className = "action-submenu-empty";
    label.textContent = `${currentPage + 1}/${totalPages}`;
    label.style.margin = "0";
    label.style.flex = "0 0 auto";

    const next = createPagerButton("Siguiente ›", currentPage >= totalPages - 1, () => {
      submenuPages.set(pageKey, Math.min(totalPages - 1, currentPage + 1));
      renderActionMenu();
    });

    pager.appendChild(previous);
    pager.appendChild(label);
    pager.appendChild(next);
    submenu.appendChild(pager);
  }
}

function createPagerButton(label, disabled, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "action-submenu-button";
  button.textContent = label;
  button.disabled = disabled;
  button.style.flex = "1 1 0";
  button.style.padding = "6px 8px";
  button.style.opacity = disabled ? "0.45" : "1";

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!disabled) {
      onClick();
    }
  });

  return button;
}

function getInventoryTypeText(type) {
  if (type === ItemType.WEAPON) return "arma";
  if (type === ItemType.AMMO) return "munición / pertenencia";
  if (type === ItemType.POTION) return "poción";
  if (type === ItemType.SCROLL) return "pergamino";
  return "objeto";
}

function createSubmenu({ title, x, y }) {
  const submenu = document.createElement("div");
  const savedPosition = draggableSubmenuPositions.get(title);
  const initialX = savedPosition?.x ?? x;
  const initialY = savedPosition?.y ?? y;
  submenu.className = "action-submenu";
  submenu.dataset.submenuTitle = title;
  submenu.style.position = "absolute";
  submenu.style.left = `${initialX}px`;
  submenu.style.top = `${initialY}px`;
  submenu.style.overflow = "visible";
  submenu.style.width = "min(420px, calc(100vw - 24px))";
  submenu.style.maxWidth = "calc(100vw - 24px)";
  submenu.style.touchAction = "none";
  submenu.style.resize = "none";
  submenu.style.zIndex = "40";

  const titleElement = document.createElement("div");

  titleElement.className = "action-submenu-title";
  titleElement.textContent = `${title} · arrastrar`;
  titleElement.style.position = "sticky";
  titleElement.style.top = "0";
  titleElement.style.zIndex = "1";
  titleElement.style.cursor = "grab";
  titleElement.style.userSelect = "none";
  titleElement.style.touchAction = "none";

  titleElement.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startSubmenuDrag(event, submenu, titleElement, title);
  });

  submenu.appendChild(titleElement);

  return submenu;
}

function startSubmenuDrag(event, submenu, titleElement, title) {
  const rect = submenu.getBoundingClientRect();

  activeSubmenuDrag = {
    submenu,
    title,
    offsetX: event.clientX - rect.left,
    offsetY: event.clientY - rect.top,
  };

  titleElement.setPointerCapture?.(event.pointerId);
  titleElement.style.cursor = "grabbing";

  const handlePointerMove = (moveEvent) => {
    if (!activeSubmenuDrag || activeSubmenuDrag.submenu !== submenu) {
      return;
    }

    moveEvent.preventDefault();
    const nextPosition = getClampedSubmenuPosition(
      moveEvent.clientX - activeSubmenuDrag.offsetX,
      moveEvent.clientY - activeSubmenuDrag.offsetY,
      submenu
    );

    submenu.style.left = `${nextPosition.x}px`;
    submenu.style.top = `${nextPosition.y}px`;
    draggableSubmenuPositions.set(title, nextPosition);
  };

  const stopDrag = (upEvent) => {
    upEvent.preventDefault();
    upEvent.stopPropagation();
    titleElement.releasePointerCapture?.(event.pointerId);
    titleElement.style.cursor = "grab";
    activeSubmenuDrag = null;
    window.removeEventListener("pointermove", handlePointerMove, true);
    window.removeEventListener("pointerup", stopDrag, true);
    window.removeEventListener("pointercancel", stopDrag, true);
  };

  window.addEventListener("pointermove", handlePointerMove, true);
  window.addEventListener("pointerup", stopDrag, true);
  window.addEventListener("pointercancel", stopDrag, true);
}

function getClampedSubmenuPosition(x, y, submenu) {
  const margin = 8;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const rect = submenu.getBoundingClientRect();
  const width = rect.width || 320;
  const height = rect.height || 240;

  return {
    x: Math.min(Math.max(margin, x), Math.max(margin, viewportWidth - width - margin)),
    y: Math.min(Math.max(margin, y), Math.max(margin, viewportHeight - height - margin)),
  };
}

function clearAllSelections() {
  gameState.selectedTargetId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;
  gameState.selectedInventoryItemId = null;
}

function clearNonTargetSelections() {
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;
}

function clearTargetAndSpellSelections(clearInventory = true) {
  gameState.selectedTargetId = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;

  if (clearInventory) {
    gameState.selectedInventoryItemId = null;
  }
}

function getVisibleTargets(targets) {
  return targets.filter((target) => isEntityVisibleToPlayer(target, player));
}

function getPlayerScreenPosition() {
  return getEntityScreenPosition(player);
}

function getEntityScreenPosition(entity) {
  return getBoardPointScreenPosition({ x: entity.x, y: entity.y });
}

function getBoardPointScreenPosition(point) {
  const canvasRect = canvas.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();

  const screen = worldToScreen(point);

  return {
    x: canvasRect.left - rootRect.left + screen.x,
    y: canvasRect.top - rootRect.top + screen.y,
  };
}

function getBoardPointFromPointer(event) {
  const canvasRect = canvas.getBoundingClientRect();
  const rawX = event.clientX - canvasRect.left;
  const rawY = event.clientY - canvasRect.top;
  const x = rawX * (canvas.width / canvasRect.width);
  const y = rawY * (canvas.height / canvasRect.height);

  if (rawX < 0 || rawY < 0 || rawX > canvasRect.width || rawY > canvasRect.height) {
    return null;
  }

  return screenToWorld({ x, y });
}
