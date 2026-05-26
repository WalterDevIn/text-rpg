import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castExpeditiousRetreatEcs({ casterId, origin }) {
  const spell = getSpellDefinition(SpellId.EXPEDITIOUS_RETREAT);
  return createAreaEffectEntity({
    x: origin?.x ?? 0,
    y: origin?.y ?? 0,
    shape: "self",
    radius: 0.4,
    sourceSpellId: spell.id,
    casterId,
    duration: spell.durationSeconds,
    effect: { speed: "expeditious_retreat" },
    render: { char: ">", color: "#55ffcc", hidden: false },
  });
}
