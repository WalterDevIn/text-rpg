import { Component } from "../../../engine/ecs/components.js";
import { ecsWorld } from "../../../engine/ecs/entityManager.js";
import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castVortexWarpEcs({ casterId, targetId, targetPoint } = {}) {
  const spell = getSpellDefinition(SpellId.VORTEX_WARP);
  const target = ecsWorld.get(targetId);

  if (target?.components?.[Component.POSITION] && targetPoint) {
    target.components[Component.POSITION].x = targetPoint.x;
    target.components[Component.POSITION].y = targetPoint.y;
  }

  return createAreaEffectEntity({
    x: targetPoint?.x ?? 0,
    y: targetPoint?.y ?? 0,
    shape: "burst",
    radius: 0.75,
    sourceSpellId: spell.id,
    casterId,
    duration: 0.35,
    effect: { type: "teleport", targetId, targetPoint },
    render: { char: "◎", color: "#b066ff", hidden: false },
  });
}
