import { Component } from "../ecs/components.js";
import { ecsWorld } from "../ecs/entityManager.js";

export function resetActionEconomy() {
  for (const entity of ecsWorld.query([Component.ACTION_ECONOMY])) {
    entity.components.actionEconomy.action = true;
    entity.components.actionEconomy.bonusAction = true;
    entity.components.actionEconomy.reaction = true;
    entity.components.actionEconomy.movement = true;
  }
}

export function spendAction(entityOrId, actionName = "action") {
  const entity = typeof entityOrId === "string" ? ecsWorld.get(entityOrId) : entityOrId;
  const economy = entity?.components?.actionEconomy;
  if (!economy || !economy[actionName]) return false;
  economy[actionName] = false;
  return true;
}

export { ActionType, GameMode } from "../state/gameState.js";
