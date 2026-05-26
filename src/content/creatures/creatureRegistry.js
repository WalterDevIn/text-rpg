import { creatureDefinitions, getCreatureDefinition, listCreatureDefinitions } from "./creatureDefinitions.js";
import { spawnBanditEcs } from "./bandit.js";
import { spawnCentipedeEcs } from "./centipede.js";

export const creatureRegistry = Object.freeze({
  definitions: creatureDefinitions,
  factories: {
    bandit: spawnBanditEcs,
    centipede: spawnCentipedeEcs,
  },
});

export function spawnCreatureEcs(id, options = {}) {
  const definition = getCreatureDefinition(id);
  const factory = creatureRegistry.factories[id] ?? creatureRegistry.factories[definition?.family];
  if (!factory) throw new Error(`No ECS creature factory registered for ${id}`);
  return factory(options);
}

export { creatureDefinitions, getCreatureDefinition, listCreatureDefinitions, spawnBanditEcs, spawnCentipedeEcs };
export * from "./enemy.js";
export * from "./merchant.js";
export * from "./player.js";
