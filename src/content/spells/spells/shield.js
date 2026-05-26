import { Component } from "../../../engine/ecs/components.js";
import { ecsWorld } from "../../../engine/ecs/entityManager.js";
import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castShieldEcs({ casterId, targetId = casterId } = {}) {
  const spell = getSpellDefinition(SpellId.SHIELD);
  const target = ecsWorld.get(targetId);
  const position = target?.components?.[Component.POSITION] ?? { x: 0, y: 0 };

  if (target) {
    const statuses = target.components[Component.STATUS_EFFECTS] ?? { effects: [] };
    statuses.effects.push({
      type: spell.statusEffectType,
      remaining: spell.durationSeconds,
      sourceSpellId: spell.id,
      blocks: ["magic_missile"],
    });
    target.components[Component.STATUS_EFFECTS] = statuses;
  }

  return createAreaEffectEntity({
    x: position.x,
    y: position.y,
    shape: "aura",
    radius: 0.9,
    sourceSpellId: spell.id,
    casterId,
    duration: spell.durationSeconds,
    effect: { statusEffectType: spell.statusEffectType, targetId },
    render: { char: "○", color: "#99ccff", hidden: false },
  });
}
