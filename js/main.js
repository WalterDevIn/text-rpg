import { TILE_SIZE } from "./constants.js";
import { gameState, GameMode, ActionType, EnemyState } from "./state.js";
import { setupKeyboard } from "./input.js";
import { setupRenderer, draw } from "./renderer.js";
import { setupUi, updateHud } from "./ui.js";
import { player, updatePlayer, startCasting, executeDodge } from "./player.js";
import { enemies, updateEnemies, spawnEnemiesForGeneratedRoom, resetRareEnemyRequirement } from "./enemy.js";
import { executeSelectedAttack, getEnemiesInAttackRange } from "./combat.js";
import { projectiles, updateProjectiles } from "./projectiles.js";
import { updateSpellEffects } from "./spells.js";
import { chests, groundItems, spawnRandomLootForRoom, updateItemPickup, useSelectedInventoryItem } from "./inventory.js";
import { isEntityVisibleToPlayer, updateTemporaryWalls, updateDungeonGeneration } from "./map.js";
import { merchants, getMerchantBlockers, spawnMerchantForRoom, updateMerchants } from "./merchant.js";
import {
  setupActionMenuUi,
  showActionMenu,
  hideActionMenu,
  updateActionOverlay,
} from "./actionMenuUi.js";

const root = document.getElementById("rpg");
const canvas = document.getElementById("game-canvas");
const output = document.getElementById("rpg-output");
const input = document.getElementById("rpg-input");
const enter = document.getElementById("rpg-input-enter");
const actionMenuLayer = document.getElementById("action-menu-layer");

let lastTime = performance.now();

setupRenderer(canvas);

setupUi({
  outputElement: output,
  inputElement: input,
  enterButton: enter,
});

setupActionMenuUi({
  layerElement: actionMenuLayer,
  canvasElement: canvas,
  rootElement: root,
});

setupKeyboard({
  openActionMenu,
  closeActionMenuAndExecute,
});

function gameLoop(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (gameState.mode === GameMode.REAL_TIME) {
    update(deltaTime);
  }

  draw();
  updateHud();
  updateActionOverlay();

  requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
  if (gameState.timeStopRemaining <= 0) {
    gameState.elapsedTime += deltaTime;
  }

  if (gameState.timeStopRemaining > 0) {
    gameState.timeStopRemaining = Math.max(0, gameState.timeStopRemaining - deltaTime);
  }

  const livingEnemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.state !== EnemyState.DEAD);
  const movementBlockers = livingEnemies.concat(getMerchantBlockers());

  updatePlayer(deltaTime, movementBlockers);
  updateItemPickup();
  resolveDoorCrossing();

  if (gameState.timeStopRemaining <= 0) {
    updateProjectiles(deltaTime);
    updateSpellEffects(deltaTime);
    updateTemporaryWalls(deltaTime);
    updateMerchants(deltaTime);
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

    enemies.length = 0;
    merchants.length = 0;
    groundItems.length = 0;
    chests.length = 0;
    projectiles.length = 0;
    resetRareEnemyRequirement();

    if (generationResult.spawnPoint) {
      player.x = generationResult.spawnPoint.x;
      player.y = generationResult.spawnPoint.y;
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

    const companionText = hiredMerchants.length > 0
      ? ` Te acompañan ${hiredMerchants.length} aliada(s).`
      : "";

    gameState.message = `${generationResult.message}${companionText}`;
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

function openActionMenu() {
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
    startCasting(ActionType.CAST_SHIELD);
  } else if (gameState.selectedAction === ActionType.CAST_WALL_OF_FORCE) {
    startCasting(ActionType.CAST_WALL_OF_FORCE, {
      boardPoint: gameState.selectedBoardPoint,
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
  } else if (gameState.selectedAction === ActionType.DODGE) {
    executeDodge(gameState.selectedDodgeDirection, livingEnemies);
  } else if (gameState.selectedAction === ActionType.USE_ITEM) {
    useSelectedInventoryItem({
      itemInstanceId: gameState.selectedInventoryItemId,
      targetId: gameState.selectedTargetId,
      boardPoint: gameState.selectedBoardPoint,
    });
  } else if (gameState.selectedAction === ActionType.TRADE) {
    gameState.message = "Terminas de comerciar.";
  } else if (gameState.selectedAction === ActionType.ANALYZE) {
    // Analizar se resuelve al seleccionar la opción, no al soltar F.
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
