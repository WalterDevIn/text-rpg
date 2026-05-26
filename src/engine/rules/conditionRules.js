import { EnemyState } from "../state/gameState.js";

export const ConditionId = Object.freeze({
  BURNING: "burning",
  POISONED: "poisoned",
  STUNNED: "stunned",
  INVISIBLE: "invisible",
  SHIELDED: "shielded",
  CONCENTRATING: "concentrating",
});

export function createCondition(id, options = {}) {
  return {
    id,
    remaining: options.remaining ?? null,
    stacks: options.stacks ?? 1,
    sourceId: options.sourceId ?? null,
    data: options.data ?? {},
  };
}

export function hasCondition(entityOrState, id) {
  const effects = entityOrState?.components?.statusEffects ?? entityOrState?.statusEffects ?? [];
  return effects.some((effect) => effect.id === id);
}

export function removeCondition(entityOrState, id) {
  const effects = entityOrState?.components?.statusEffects ?? entityOrState?.statusEffects;
  if (!Array.isArray(effects)) return false;
  const before = effects.length;
  const kept = effects.filter((effect) => effect.id !== id);
  effects.splice(0, effects.length, ...kept);
  return kept.length !== before;
}

export { EnemyState };
