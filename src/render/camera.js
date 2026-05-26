import { getCameraOffset, screenToWorld, worldToScreen } from "./renderer.js";

export function getCamera() {
  return {
    offset: getCameraOffset(),
    worldToScreen,
    screenToWorld,
  };
}

export function getCameraPosition() {
  return getCameraOffset();
}

export { getCameraOffset, screenToWorld, worldToScreen };
