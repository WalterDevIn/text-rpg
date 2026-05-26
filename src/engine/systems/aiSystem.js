import { updateEnemies, enemies, spawnEnemiesForGeneratedRoom, resetRareEnemyRequirement } from "../../content/creatures/enemy.js";

export function updateAiSystem(dt) {
  updateEnemies(dt);
}

export { updateEnemies, enemies, spawnEnemiesForGeneratedRoom, resetRareEnemyRequirement };
export * from "../../content/creatures/enemy.js";
