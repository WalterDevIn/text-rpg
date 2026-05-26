import { ActionType, GameMode } from "../state/gameState.js";

export const ActionCost = Object.freeze({
  ACTION: "action",
  BONUS_ACTION: "bonusAction",
  REACTION: "reaction",
  MOVEMENT: "movement",
  FREE: "free",
});

export function createActionEconomy() {
  return {
    action: true,
    bonusAction: true,
    reaction: true,
    movement: true,
  };
}

export function canSpendAction(economy, cost = ActionCost.ACTION) {
  if (cost === ActionCost.FREE) return true;
  return Boolean(economy?.[cost]);
}

export function spendActionCost(economy, cost = ActionCost.ACTION) {
  if (!canSpendAction(economy, cost)) return false;
  if (cost !== ActionCost.FREE) economy[cost] = false;
  return true;
}

export function resetActionEconomy(economy) {
  if (!economy) return createActionEconomy();
  economy.action = true;
  economy.bonusAction = true;
  economy.reaction = true;
  economy.movement = true;
  return economy;
}

export { ActionType, GameMode };
