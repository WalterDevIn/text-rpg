import { TILE_SIZE } from "../config/constants.js";
import { appState, AppScreen, setAppScreen } from "./appState.js";
import { gameState, GameMode } from "../engine/state/gameState.js";
import { setCurrentFloor, setDungeonSeed, getPlayerSpawnPoint } from "../engine/world/map.js";
import { resetKeyboardState } from "../engine/systems/inputSystem.js";
import { initializeEcsRuntime } from "../engine/systems/ecsRuntimeSystem.js";
import { player, resetPlayerForNewGame } from "../content/creatures/player.js";
import { enemies, resetRareEnemyRequirement } from "../content/creatures/enemy.js";
import { merchants } from "../content/creatures/merchant.js";
import { projectiles } from "../engine/projectiles/projectileSystem.js";
import { chests, groundItems } from "../content/items/inventory.js";
import { companions, resetCompanionsForNewGame } from "../content/companions/companions.js";

export function createRandomWorldSeed() {
  const cryptoApi = globalThis.crypto;

  if (cryptoApi?.getRandomValues) {
    const values = new Uint32Array(2);
    cryptoApi.getRandomValues(values);
    return `mundo-${Date.now().toString(36)}-${values[0].toString(36)}-${values[1].toString(36)}`;
  }

  return `mundo-${Date.now().toString(36)}-${Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(36)}`;
}

export function createGameSession(characterData = {}) {
  destroyGameSession({ keepScreen: true });

  const seed = createRandomWorldSeed();
  gameState.worldSeed = seed;
  setCurrentFloor(0);
  setDungeonSeed(seed);

  clearSimulationCollections();
  resetRareEnemyRequirement();
  resetKeyboardState();
  resetGameStateSelections();
  resetPlayerForNewGame(characterData);

  const spawn = getPlayerSpawnPoint();
  player.x = spawn.x;
  player.y = spawn.y;
  resetCompanionsForNewGame();

  initializeEcsRuntime({
    player,
    enemies,
    projectiles,
    merchants,
    groundItems,
    chests,
    companions,
  });

  appState.hasActiveSession = true;
  appState.lastCharacterDraft = { ...characterData };
  setAppScreen(AppScreen.PLAYING);
  gameState.mode = GameMode.REAL_TIME;
  gameState.message = "Explora el bosque. Mantén F para detener el tiempo y elegir una acción.";

  return { seed, character: characterData };
}

export function destroyGameSession({ keepScreen = false } = {}) {
  clearSimulationCollections();
  resetRareEnemyRequirement();
  resetKeyboardState();
  resetGameStateSelections();

  player.isCasting = false;
  player.castingSpell = null;
  player.concentration = null;
  player.castingTargetId = null;
  player.castingAimDirection = null;
  player.castingBoardPoint = null;
  player.castingRemaining = 0;
  player.attackCooldown = 0;
  player.spellCooldown = 0;
  player.shieldRemaining = 0;
  player.shieldHp = 0;
  player.temporaryHp = 0;
  player.temporaryHpRemaining = 0;
  player.expeditiousRetreatRemaining = 0;

  gameState.mode = GameMode.REAL_TIME;
  gameState.message = "";
  appState.hasActiveSession = false;

  initializeEcsRuntime({
    player,
    enemies,
    projectiles,
    merchants,
    groundItems,
    chests,
    companions,
  });

  if (!keepScreen) {
    setAppScreen(AppScreen.MAIN_MENU);
  }
}

function clearSimulationCollections() {
  enemies.length = 0;
  merchants.length = 0;
  projectiles.length = 0;
  groundItems.length = 0;
  chests.length = 0;
  companions.length = 0;
}

function resetGameStateSelections() {
  gameState.selectedAction = null;
  gameState.selectedTargetId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;
  gameState.selectedInventoryItemId = null;
  gameState.selectedAnalysisPoint = null;
  gameState.mouseWorldPoint = null;
  gameState.infoMessage = "";
  gameState.infoPortraitKey = null;
  gameState.timeStopRemaining = 0;
  gameState.elapsedTime = 0;
  gameState.loadedChunkKeys = [];
  gameState.exploredTilesByLayer = {};
}
