import { ecsWorld } from "../../engine/ecs/entityManager.js";

export function getDebugSnapshot() {
  return {
    entityCount: ecsWorld.entities?.size ?? 0,
    entities: Array.from(ecsWorld.entities?.values?.() ?? []),
  };
}
