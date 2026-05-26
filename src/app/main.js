import { TILE_SIZE } from "../config/constants.js";
import { appState, AppScreen, setAppScreen, isGameRunningScreen } from "./appState.js";
import { setupScreenManager, showScreen, hideScreens, renderCurrentScreen } from "./screenManager.js";
import { createGameSession, destroyGameSession } from "./gameSession.js";
import { gameState, GameMode, ActionType, EnemyState } from "../engine/state/gameState.js";
import { setupKeyboard } from "../engine/systems/inputSystem.js";
import { setupRenderer, draw } from "../render/renderer.js";
import { setupUi, updateHud } from "../ui/ui.js";
import { player, updatePlayer, startCasting, executeDodge } from "../content/creatures/player.js";
import { enemies, updateEnemies, spawnEnemiesForGeneratedRoom, resetRareEnemyRequirement } from "../content/creatures/enemy.js";
import { executeSelectedAttack, getEnemiesInAttackRange } from "../engine/rules/dndCombatRules.js";
import { projectiles, updateProjectiles } from "../engine/projectiles/projectileSystem.js";
import { updateSpellEffects } from "../content/spells/spellCasting.js";
import { chests, groundItems, spawnRandomLootForRoom, updateItemPickup, useSelectedInventoryItem } from "../content/items/inventory.js";
import { getRooms, isEntityVisibleToPlayer, isSurfaceLayer, updateTemporaryWalls, updateDungeonGeneration } from "../engine/world/map.js";
import { merchants, spawnMerchantForRoom, updateMerchants } from "../content/creatures/merchant.js";
import { companions, updateCompanions } from "../content/companions/companions.js";
import {
  setupActionMenuUi,
  showActionMenu,
  hideActionMenu,
  updateActionOverlay,
} from "../ui/actionMenu/actionMenuUi.js";
import {
  beginEcsFrame,
  endEcsFrame,
  updateEcsOnlySystems,
} from "../engine/systems/ecsRuntimeSystem.js";
import { getMovementBlockerStateObjects } from "../engine/systems/movementSystem.js";
import { isWorldTimeStopped, updateGameClock } from "../engine/systems/timeSystem.js";
import { takeLongRest } from "../engine/rules/restRules.js";

const root = document.getElementById("rpg");
const canvas = document.getElementById("game-canvas");
const actionMenuLayer = document.getElementById("action-menu-layer");
const screenLayer = document.getElementById("screen-layer");

let lastTime = performance.now();

setupRenderer(canvas);
setupUi();

setupActionMenuUi({
  layerElement: actionMenuLayer,
  canvasElement: canvas,
  rootElement: root,
});

setupKeyboard({
  openActionMenu,
  closeActionMenuAndExecute,
  onEscapeInRealTime: pauseGame,
});

setupScreenManager({
  layerElement: screenLayer,
  rootElement: root,
  actions: {
    onNewGame: () => showScreen(AppScreen.CHARACTER_CREATION),
    onContinue: resumeGame,
    onOptions: () => {
      gameState.message = "Opciones todavía no implementadas.";
      renderCurrentScreen();
    },
    onBackToMainMenu: () => showScreen(AppScreen.MAIN_MENU),
    onCreateCharacter: (characterData) => {
      createGameSession(characterData);
      hideScreens();
    },
    onResumeGame: resumeGame,
    onExitToMainMenu: exitToMainMenu,
  },
});

requestAnimationFrame(gameLoop);

function gameLoop(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (isGameRunningScreen()) {
    beginEcsFrame(deltaTime);

    if (gameState.mode === GameMode.REAL_TIME) {
      update(deltaTime);
    }

    updateEcsOnlySystems(deltaTime);
    endEcsFrame();

    draw();
    updateHud();
    updateActionOverlay();
  }

  requestAnimationFrame(gameLoop);
}

function pauseGame() {
  if (!appState.hasActiveSession || appState.screen !== AppScreen.PLAYING) {
    return;
  }

  hideActionMenu();
  gameState.mode = GameMode.REAL_TIME;
  setAppScreen(AppScreen.PAUSED);
  renderCurrentScreen();
}

function resumeGame() {
  if (!appState.hasActiveSession) {
    showScreen(AppScreen.MAIN_MENU);
    return;
  }

  setAppScreen(AppScreen.PLAYING);
  gameState.mode = GameMode.REAL_TIME;
  hideScreens();
}

function exitToMainMenu() {
  hideActionMenu();
  destroyGameSession();
  showScreen(AppScreen.MAIN_MENU);
}

function update(deltaTime) {
  updateGameClock(gameState, deltaTime);

  const movementBlockers = getMovementBlockerStateObjects({ excludeEntityIds: ["player:player"] });

  updatePlayer(deltaTime, movementBlockers);
  updateItemPickup();
  resolveDoorCrossing();

  if (!isWorldTimeStopped(gameState)) {
    updateProjectiles(deltaTime);
    updateSpellEffects(deltaTime);
    updateTemporaryWalls(deltaTime);
    updateMerchants(deltaTime);
    updateCompanions(deltaTime, enemies, merchants.filter((merchant) => merchant.isHired && merchant.hp > 0));
    updateEnemies(deltaTime);
  }
}

function resolveDoorCrossing() {
  const generationResult = updateDungeonGeneration(player);

  if (!generationResult) {
    return;
  }

  if (generationResult.floorChanged) {
    const hiredMerchants = merchants.filter((merchant) => merchant.isHired && merchant.hp > 0);
    const activeCompanions = companions.filter((companion) => companion.hp > 0 && companion.state !== EnemyState.DEAD);

    enemies.length = 0;
    merchants.length = 0;
    groundItems.length = 0;
    chests.length = 0;
    projectiles.length = 0;
    companions.length = 0;
    resetRareEnemyRequirement();

    if (generationResult.spawnPoint) {
      player.x = generationResult.spawnPoint.x;
      player.y = generationResult.spawnPoint.y;
    }

    for (let i = 0; i < activeCompanions.length; i++) {
      const companion = activeCompanions[i];
      companion.x = player.x - (i + 1) * 0.75 * TILE_SIZE;
      companion.y = player.y + TILE_SIZE;
      companion.path = [];
      companion.pathTargetTileKey = null;
      companions.push(companion);
    }

    for (let i = 0; i < hiredMerchants.length; i++) {
      const merchant = hiredMerchants[i];
      merchant.x = player.x + (i + 1) * 0.75 * TILE_SIZE;
      merchant.y = player.y + TILE_SIZE;
      merchant.path = [];
      merchant.pathTargetTileKey = null;
      merchant.actionWindupType = null;
      merchant.actionWindupRemaining = 0;
      merchant.actionWindupTargetId = null;
      merchants.push(merchant);
    }

    const population = !isSurfaceLayer()
      ? populateCurrentDungeonFloor()
      : { enemies: 0, merchants: 0, loot: 0 };

    const allyCount = hiredMerchants.length + activeCompanions.length;
    const companionText = allyCount > 0
      ? ` Te acompañan ${allyCount} aliada(s).`
      : "";
    const populationText = !isSurfaceLayer()
      ? ` Piso generado: ${population.enemies} enemigo(s), ${population.merchants} vendedora(s), ${population.loot} botín(es).`
      : "";

    gameState.message = `${generationResult.message}${companionText}${populationText}`;
    return;
  }

  if (generationResult.difficulty === "merchant") {
    const merchant = spawnMerchantForRoom(generationResult.room);
    gameState.message = `${generationResult.message} ${merchant ? "Puedes acercarte y usar Comerciar." : ""}`;
    return;
  }

  const spawnedEnemies = spawnEnemiesForGeneratedRoom(
    generationResult.room,
    generationResult.difficulty
  );

  const spawnedItems = spawnRandomLootForRoom(generationResult.room);

  const enemyText = spawnedEnemies > 0
    ? ` Aparecen ${spawnedEnemies} enemigo(s) aleatorios.`
    : " No aparecen enemigos.";
  const itemText = spawnedItems > 0
    ? ` Hay ${spawnedItems} objeto(s) en la sala.`
    : "";

  gameState.message = `${generationResult.message}${enemyText}${itemText}`;
}


function populateCurrentDungeonFloor() {
  resetRareEnemyRequirement();

  const rooms = getRooms()
    .filter((room) => room.generatedFromTable && !room.spawnRoom)
    .sort((a, b) => Number(Boolean(b.bossRoom)) - Number(Boolean(a.bossRoom)));

  let spawnedEnemies = 0;
  let spawnedMerchants = 0;
  let spawnedLoot = 0;

  for (const room of rooms) {
    if (room.merchantRoom) {
      if (spawnMerchantForRoom(room)) {
        spawnedMerchants++;
      }
      continue;
    }

    if (room.difficulty && room.difficulty !== "none") {
      spawnedEnemies += spawnEnemiesForGeneratedRoom(room, room.difficulty);
    }

    spawnedLoot += spawnRandomLootForRoom(room);
  }

  return {
    enemies: spawnedEnemies,
    merchants: spawnedMerchants,
    loot: spawnedLoot,
  };
}

function openActionMenu() {
  if (!isGameRunningScreen()) {
    return;
  }

  gameState.mode = GameMode.ACTION_MENU;
  gameState.selectedAction = null;
  gameState.selectedTargetId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedAnalysisPoint = null;

  const targets = getEnemiesInAttackRange().filter((enemy) => isEntityVisibleToPlayer(enemy, player));

  if (targets.length > 0) {
    gameState.selectedAction = ActionType.ATTACK;
    gameState.selectedTargetId = targets[0].id;
  }

  gameState.message = "Tiempo detenido. Elegí una acción con los botones flotantes. Soltá F para confirmar.";

  showActionMenu();
}

function closeActionMenuAndExecute() {
  if (gameState.mode !== GameMode.ACTION_MENU) {
    return;
  }

  gameState.mode = GameMode.REAL_TIME;
  hideActionMenu();

  const livingEnemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.state !== EnemyState.DEAD);

  if (gameState.selectedAction === ActionType.ATTACK) {
    executeSelectedAttack();
  } else if (gameState.selectedAction === ActionType.CAST_CURE_WOUNDS) {
    startCasting(ActionType.CAST_CURE_WOUNDS, {
      targetId: gameState.selectedTargetId,
    });
  } else if (gameState.selectedAction === ActionType.CAST_TIME_STOP) {
    startCasting(ActionType.CAST_TIME_STOP);
  } else if (gameState.selectedAction === ActionType.CAST_MAGIC_MISSILE) {
    startCasting(ActionType.CAST_MAGIC_MISSILE, {
      targetId: gameState.selectedTargetId,
    });
  } else if (gameState.selectedAction === ActionType.CAST_BURNING_HANDS) {
    startCasting(ActionType.CAST_BURNING_HANDS, {
      aimDirection: gameState.selectedAimDirection,
    });
  } else if (gameState.selectedAction === ActionType.CAST_SHIELD) {
    startCasting(ActionType.CAST_SHIELD, {
      targetId: gameState.selectedTargetId,
    });
  } else if (gameState.selectedAction === ActionType.CAST_WALL_OF_FORCE) {
    startCasting(ActionType.CAST_WALL_OF_FORCE, {
      boardPoint: gameState.selectedBoardPoint,
      aimDirection: gameState.selectedAimDirection,
    });
  } else if (gameState.selectedAction === ActionType.CAST_FIREBALL) {
    startCasting(ActionType.CAST_FIREBALL, {
      boardPoint: gameState.selectedBoardPoint,
    });
  } else if (gameState.selectedAction === ActionType.CAST_VORTEX_WARP) {
    startCasting(ActionType.CAST_VORTEX_WARP, {
      targetId: gameState.selectedTargetId,
      boardPoint: gameState.selectedBoardPoint,
    });
  } else if (gameState.selectedAction === ActionType.CAST_COUNTERSPELL) {
    startCasting(ActionType.CAST_COUNTERSPELL, {
      targetId: gameState.selectedTargetId,
    });
  } else if (gameState.selectedAction === ActionType.CAST_FIRE_BOLT) {
    startCasting(ActionType.CAST_FIRE_BOLT, {
      aimDirection: gameState.selectedAimDirection,
    });
  } else if (gameState.selectedAction === ActionType.CAST_CHROMATIC_ORB) {
    startCasting(ActionType.CAST_CHROMATIC_ORB, {
      boardPoint: gameState.selectedBoardPoint,
    });
  } else if (gameState.selectedAction === ActionType.CAST_DANCING_LIGHTS) {
    startCasting(ActionType.CAST_DANCING_LIGHTS, {
      targetId: gameState.selectedTargetId,
      boardPoint: gameState.selectedBoardPoint,
    });
  } else if (gameState.selectedAction === ActionType.CAST_SHOCKING_GRASP) {
    startCasting(ActionType.CAST_SHOCKING_GRASP, {
      targetId: gameState.selectedTargetId,
    });
  } else if (gameState.selectedAction === ActionType.CAST_FALSE_LIFE) {
    startCasting(ActionType.CAST_FALSE_LIFE, {
      targetId: gameState.selectedTargetId,
    });
  } else if (gameState.selectedAction === ActionType.CAST_EXPEDITIOUS_RETREAT) {
    startCasting(ActionType.CAST_EXPEDITIOUS_RETREAT);
  } else if (gameState.selectedAction === ActionType.DODGE) {
    executeDodge(gameState.selectedDodgeDirection, livingEnemies);
  } else if (gameState.selectedAction === ActionType.USE_ITEM) {
    useSelectedInventoryItem({
      itemInstanceId: gameState.selectedInventoryItemId,
      targetId: gameState.selectedTargetId,
      boardPoint: gameState.selectedBoardPoint,
      aimDirection: gameState.selectedAimDirection,
    });
  } else if (gameState.selectedAction === ActionType.TRADE) {
    gameState.message = "Terminas de comerciar.";
  } else if (gameState.selectedAction === ActionType.LONG_REST) {
    const restResult = takeLongRest();
    gameState.message = restResult.message;
  } else {
    gameState.message = "No elegiste ninguna acción. El tiempo vuelve a moverse.";
  }

  gameState.selectedAction = null;
  gameState.selectedTargetId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedAnalysisPoint = null;
}


draw();
updateHud();
requestAnimationFrame(gameLoop);
