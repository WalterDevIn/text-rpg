import {
  beginHybridEcsFrame,
  endHybridEcsFrame,
  getHybridEcsRuntime,
  initializeHybridEcsRuntime,
  syncStateCollectionsToEcs,
} from "../ecs/stateEcsAdapter.js";
import { updateVelocityMovement } from "./movementSystem.js";
import { updateStatusEffects } from "./statusEffectSystem.js";
import { clearConsumedActionIntents } from "./actionIntentSystem.js";
import { handleSpellActionIntent } from "./spellSystem.js";
import { updateProjectileLifetimeEcs } from "./projectileSystem.js";
import { updateVisionComponents } from "./visionSystem.js";

export function initializeEcsRuntime(collections) {
  initializeHybridEcsRuntime(collections);
  return getHybridEcsRuntime();
}

export function beginEcsFrame(deltaTime = 0) {
  beginHybridEcsFrame();
  const runtime = getHybridEcsRuntime();
  updateVisionComponents(runtime.frameNumber);
  return runtime;
}

export function updateEcsOnlySystems(deltaTime = 0) {
  handleSpellActionIntent();
  updateVelocityMovement(deltaTime);
  updateProjectileLifetimeEcs(deltaTime);
  updateStatusEffects(deltaTime);
  clearConsumedActionIntents();
}

export function endEcsFrame() {
  endHybridEcsFrame();
  const runtime = getHybridEcsRuntime();
  updateVisionComponents(runtime.frameNumber);
  return runtime;
}

export function syncEcsNow() {
  const runtime = getHybridEcsRuntime();
  syncStateCollectionsToEcs(runtime.collections);
  return runtime;
}

export { getHybridEcsRuntime };
