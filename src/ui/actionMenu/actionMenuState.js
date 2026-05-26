import { gameState } from "../../engine/state/gameState.js";

export function getActionMenuState() {
  return {
    selectedAction: gameState.selectedAction,
    selectedTargetId: gameState.selectedTargetId,
    selectedDodgeDirection: gameState.selectedDodgeDirection,
    selectedAimDirection: gameState.selectedAimDirection,
    selectedBoardPoint: gameState.selectedBoardPoint,
    selectedInventoryItemId: gameState.selectedInventoryItemId,
  };
}

export function clearActionMenuSelection() {
  gameState.selectedAction = null;
  gameState.selectedTargetId = null;
  gameState.selectedDodgeDirection = null;
  gameState.selectedAimDirection = null;
  gameState.selectedBoardPoint = null;
  gameState.selectedInventoryItemId = null;
}
