import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castShockingGraspEcs({ casterId, targetId, origin }) {
  const spell = getSpellDefinition(SpellId.SHOCKING_GRASP);
  return createAreaEffectEntity({
    x: origin?.x ?? 0,
    y: origin?.y ?? 0,
    shape: "touch",
    radius: 0.4,
    sourceSpellId: spell.id,
    casterId,
    duration: 0.35,
    effect: { targetId, inactiveDuration: spell.inactiveDurationSeconds },
    render: { char: "*", color: "#66ccff", hidden: false },
  });
}
