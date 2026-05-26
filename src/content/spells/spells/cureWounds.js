import { Component } from "../../../engine/ecs/components.js";
import { ecsWorld } from "../../../engine/ecs/entityManager.js";
import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castCureWoundsEcs({ casterId, targetId = casterId, targetEntity = null, amount = null } = {}) {
  const spell = getSpellDefinition(SpellId.CURE_WOUNDS);
  const target = targetEntity ?? ecsWorld.get(targetId);

  if (target?.components?.[Component.HEALTH] && typeof amount === "number") {
    const health = target.components[Component.HEALTH];
    health.current = Math.min(health.max, health.current + amount);
  }

  const position = target?.components?.[Component.POSITION]
    ?? ecsWorld.get(casterId)?.components?.[Component.POSITION]
    ?? { x: 0, y: 0 };

  return createAreaEffectEntity({
    x: position.x,
    y: position.y,
    shape: "burst",
    radius: 0.75,
    sourceSpellId: spell.id,
    casterId,
    duration: 0.35,
    effect: { healing: spell.healing, amount },
    render: { char: "+", color: "#66ff99", hidden: false },
  });
}
