import { GameMode } from "../state/gameState.js";

export function updateGameClock(gameState, deltaTime) {
  if (gameState.mode !== GameMode.REAL_TIME) return;

  if (gameState.timeStopRemaining <= 0) {
    gameState.elapsedTime += deltaTime;
    return;
  }

  gameState.timeStopRemaining = Math.max(0, gameState.timeStopRemaining - deltaTime);
}

export function isWorldTimeStopped(gameState) {
  return (gameState.timeStopRemaining ?? 0) > 0;
}

export { GameMode } from "../state/gameState.js";
