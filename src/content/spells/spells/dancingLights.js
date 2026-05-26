import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castDancingLightsEcs({ casterId, origin, targetPoint }) {
  const spell = getSpellDefinition(SpellId.DANCING_LIGHTS);
  return createAreaEffectEntity({
    x: targetPoint?.x ?? origin?.x ?? 0,
    y: targetPoint?.y ?? origin?.y ?? 0,
    shape: "lights",
    radius: 0.5,
    sourceSpellId: spell.id,
    casterId,
    duration: spell.durationSeconds,
    effect: { lightOrbs: spell.orbCount },
    render: { char: "o", color: "#8ecaff", hidden: false },
  });
}
