import { GameMode, gameState } from "../state/gameState.js";

export const keys = {
  left: false,
  up: false,
  right: false,
  down: false,
  run: false,
  action: false,
};

let keyboardIsSetup = false;
let keyboardCallbacks = {
  closeActionMenuAndExecute: null,
  openActionMenu: null,
  onEscapeInRealTime: null,
};

export function resetKeyboardState() {
  keys.left = false;
  keys.up = false;
  keys.right = false;
  keys.down = false;
  keys.run = false;
  keys.action = false;
}

function isMovementCode(event, code, arrowKey) {
  return event.code === code || event.key === arrowKey;
}

function isActionKey(event) {
  return event.code === "KeyF" || event.key.toLowerCase() === "f";
}

export function setupKeyboard({ closeActionMenuAndExecute, openActionMenu, onEscapeInRealTime } = {}) {
  keyboardCallbacks = {
    closeActionMenuAndExecute: closeActionMenuAndExecute ?? keyboardCallbacks.closeActionMenuAndExecute,
    openActionMenu: openActionMenu ?? keyboardCallbacks.openActionMenu,
    onEscapeInRealTime: onEscapeInRealTime ?? keyboardCallbacks.onEscapeInRealTime,
  };

  if (keyboardIsSetup) {
    return;
  }

  keyboardIsSetup = true;

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
      keyboardCallbacks.openActionMenu?.();
    }

    if (key === "escape" && gameState.mode === GameMode.ACTION_MENU) {
      gameState.selectedAction = null;
      gameState.selectedTargetId = null;
      gameState.selectedDodgeDirection = null;
      gameState.selectedAimDirection = null;
      gameState.selectedBoardPoint = null;
      gameState.selectedInventoryItemId = null;
      gameState.message = "Acción cancelada. Suelta F para reanudar.";
      return;
    }

    if (key === "escape" && gameState.mode === GameMode.REAL_TIME) {
      keyboardCallbacks.onEscapeInRealTime?.();
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
      keyboardCallbacks.closeActionMenuAndExecute?.();
    }
  });
}


// Physical keyboard/mouse input is application state, not ECS.
// Physical keyboard/mouse input is intentionally not ECS.
// It is application state: it reads DOM events and exposes a compact snapshot.
// UI modules and player-control systems may translate this snapshot into ActionIntent components.

export function createInputState() {
  return {
    keysDown: new Set(),
    buttonsDown: new Set(),
    mouseScreen: { x: 0, y: 0 },
    mouseWorld: { x: 0, y: 0 },
    lastKey: null,
    lastButton: null,
  };
}

export function setupPhysicalInput({ target = window, canvas = null, camera = null } = {}) {
  const input = createInputState();

  target.addEventListener?.("keydown", (event) => {
    input.keysDown.add(event.key);
    input.lastKey = event.key;
  });

  target.addEventListener?.("keyup", (event) => {
    input.keysDown.delete(event.key);
  });

  const mouseTarget = canvas ?? target;

  mouseTarget.addEventListener?.("pointerdown", (event) => {
    input.buttonsDown.add(event.button);
    input.lastButton = event.button;
  });

  mouseTarget.addEventListener?.("pointerup", (event) => {
    input.buttonsDown.delete(event.button);
  });

  mouseTarget.addEventListener?.("pointermove", (event) => {
    const rect = canvas?.getBoundingClientRect?.();
    input.mouseScreen = rect
      ? { x: event.clientX - rect.left, y: event.clientY - rect.top }
      : { x: event.clientX, y: event.clientY };

    input.mouseWorld = camera?.screenToWorld
      ? camera.screenToWorld(input.mouseScreen)
      : { ...input.mouseScreen };
  });

  return input;
}

export function isKeyDown(input, key) {
  return input?.keysDown?.has(key) ?? false;
}

export function isButtonDown(input, button = 0) {
  return input?.buttonsDown?.has(button) ?? false;
}

// Keep DOM input isolated here so the rest of src/ does not confuse physical input with ECS simulation.

