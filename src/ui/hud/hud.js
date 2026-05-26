import { gameState } from "../../engine/state/gameState.js";
import { setupUi, updateHud } from "../ui.js";

export function setHudMessage(message) {
  gameState.message = message;
  updateHud();
}

export function getHudMessage() {
  return gameState.message ?? "";
}

export { setupUi, updateHud };
