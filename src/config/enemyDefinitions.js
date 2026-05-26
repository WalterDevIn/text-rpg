import { getCreatureDefinition, listCreatureDefinitions } from "../content/creatures/creatureDefinitions.js";

export function getConfiguredEnemyDefinition(creatureId) {
  return getCreatureDefinition(creatureId);
}

export { getCreatureDefinition, listCreatureDefinitions };
