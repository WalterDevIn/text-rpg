import { initializeEcsRuntime, beginEcsFrame, updateEcsOnlySystems, endEcsFrame } from "../engine/systems/ecsRuntimeSystem.js";
import { setupPhysicalInput } from "../engine/systems/inputSystem.js";

export function createRuntimeServices({ canvas = null, inputTarget = window, camera = null, collections = {} } = {}) {
  const input = setupPhysicalInput({ target: inputTarget, canvas, camera });
  const ecs = initializeEcsRuntime(collections);

  return {
    input,
    ecs,
    updateSimulation(dt) {
      beginEcsFrame(dt);
      updateEcsOnlySystems(dt);
      endEcsFrame();
    },
  };
}
