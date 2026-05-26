import { Component } from "../../../engine/ecs/components.js";
import { ecsWorld } from "../../../engine/ecs/entityManager.js";
import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castCounterspellEcs({ casterId, targetId } = {}) {
  const spell = getSpellDefinition(SpellId.COUNTERSPELL);
  const target = ecsWorld.get(targetId);

  if (target?.components?.[Component.CASTING]) {
    target.components[Component.CASTING].interrupted = true;
    target.components[Component.CASTING].remaining = 0;
  }

  const position = target?.components?.[Component.POSITION]
    ?? ecsWorld.get(casterId)?.components?.[Component.POSITION]
    ?? { x: 0, y: 0 };

  return createAreaEffectEntity({
    x: position.x,
    y: position.y,
    shape: "burst",
    radius: 0.5,
    sourceSpellId: spell.id,
    casterId,
    duration: 0.25,
    effect: { type: "interrupt", targetId },
    render: { char: "!", color: "#ffffff", hidden: false },
  });
}
