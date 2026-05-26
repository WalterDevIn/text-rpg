import { setActionIntent } from "../../engine/systems/actionIntentSystem.js";
import { gameState } from "../../engine/state/gameState.js";

export function buildSelectedActionIntent() {
  if (!gameState.selectedAction) return null;
  return {
    type: gameState.selectedAction,
    payload: {
      targetId: gameState.selectedTargetId,
      aimDirection: gameState.selectedAimDirection,
      boardPoint: gameState.selectedBoardPoint,
      inventoryItemId: gameState.selectedInventoryItemId,
      dodgeDirection: gameState.selectedDodgeDirection,
    },
  };
}

export function emitSelectedActionIntent(entityOrId = "player:player") {
  const intent = buildSelectedActionIntent();
  if (!intent) return false;
  return setActionIntent(entityOrId, intent.type, intent.payload);
}
