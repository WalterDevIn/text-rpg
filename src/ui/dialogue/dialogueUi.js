import { gameState } from "../../engine/state/gameState.js";

export function setDialogueMessage(message) {
  gameState.message = message;
}

export function getDialogueMessage() {
  return gameState.message ?? "";
}
