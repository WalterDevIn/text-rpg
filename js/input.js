import { GameMode, gameState } from "./state.js";

export const keys = {
  left: false,
  up: false,
  right: false,
  down: false,
  run: false,
  action: false,
};

function isMovementCode(event, code, arrowKey) {
  return event.code === code || event.key === arrowKey;
}

function isActionKey(event) {
  return event.code === "KeyF" || event.key.toLowerCase() === "f";
}

export function setupKeyboard({ closeActionMenuAndExecute, openActionMenu }) {
  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    // Usar event.code hace que el movimiento dependa de la posición física
    // de WASD, no de la letra generada por el layout activo. Esto mantiene
    // controles normales en QWERTY, Colemak, Dvorak, etc.
    if (isMovementCode(event, "KeyA", "ArrowLeft")) keys.left = true;
    if (isMovementCode(event, "KeyW", "ArrowUp")) keys.up = true;
    if (isMovementCode(event, "KeyD", "ArrowRight")) keys.right = true;
    if (isMovementCode(event, "KeyS", "ArrowDown")) keys.down = true;

    if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.key === "Shift") {
      keys.run = true;
    }

    if (isActionKey(event) && !keys.action) {
      keys.action = true;
      openActionMenu();
    }

    if (key === "escape" && gameState.mode === GameMode.ACTION_MENU) {
      gameState.selectedAction = null;
      gameState.selectedTargetId = null;
      gameState.selectedDodgeDirection = null;
      gameState.selectedAimDirection = null;
      gameState.selectedBoardPoint = null;
      gameState.selectedInventoryItemId = null;
      gameState.message = "Acción cancelada. Suelta F para reanudar.";
    }
  });

  document.addEventListener("keyup", (event) => {
    if (isMovementCode(event, "KeyA", "ArrowLeft")) keys.left = false;
    if (isMovementCode(event, "KeyW", "ArrowUp")) keys.up = false;
    if (isMovementCode(event, "KeyD", "ArrowRight")) keys.right = false;
    if (isMovementCode(event, "KeyS", "ArrowDown")) keys.down = false;

    if (event.code === "ShiftLeft" || event.code === "ShiftRight" || event.key === "Shift") {
      keys.run = false;
    }

    if (isActionKey(event)) {
      keys.action = false;
      closeActionMenuAndExecute();
    }
  });
}
