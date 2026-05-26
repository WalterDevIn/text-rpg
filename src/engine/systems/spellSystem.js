import { Component } from "../ecs/components.js";
import { consumeActionIntentsOfType } from "./actionIntentSystem.js";
import { castSpellEcs, getSpellDefinition, getSpellDefinitionByActionType } from "../../content/spells/spellRegistry.js";
import { resolveSpell, updateSpellEffects } from "../../content/spells/spellCasting.js";

function getEntityPosition(entity) {
  return entity?.components?.[Component.POSITION] ?? { x: 0, y: 0 };
}

function normalizeSpellIntent(intent) {
  const payload = intent?.payload ?? intent ?? {};
  const spell = getSpellDefinition(payload.spellId) ?? getSpellDefinitionByActionType(payload.actionType);

  if (!spell) {
    return null;
  }

  return {
    spell,
    payload,
  };
}

export function handleSpellActionIntent() {
  for (const { entity, intent } of consumeActionIntentsOfType("cast_spell")) {
    const normalized = normalizeSpellIntent(intent);
    if (!normalized) continue;

    const { spell, payload } = normalized;
    const origin = payload.origin ?? getEntityPosition(entity);

    castSpellEcs(spell.id, {
      ...payload,
      casterId: payload.casterId ?? entity.id,
      origin,
      targetPoint: payload.targetPoint ?? payload.boardPoint,
      direction: payload.direction ?? payload.aimDirection,
    });
  }
}

export { resolveSpell, updateSpellEffects };
export * from "../../content/spells/spellCasting.js";
