import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castFalseLifeEcs({ casterId, origin }) {
  const spell = getSpellDefinition(SpellId.FALSE_LIFE);
  return createAreaEffectEntity({
    x: origin?.x ?? 0,
    y: origin?.y ?? 0,
    shape: "self",
    radius: 0.4,
    sourceSpellId: spell.id,
    casterId,
    duration: spell.durationSeconds,
    effect: { temporaryHp: spell.temporaryHp?.notation },
    render: { char: "+", color: "#7a55ff", hidden: false },
  });
}
