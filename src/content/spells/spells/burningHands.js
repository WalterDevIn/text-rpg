import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castBurningHandsEcs({ casterId, origin, direction }) {
  const spell = getSpellDefinition(SpellId.BURNING_HANDS);

  return createAreaEffectEntity({
    x: origin.x,
    y: origin.y,
    shape: spell.shape,
    radius: spell.rangeFeet,
    angle: spell.coneAngleRadians,
    direction,
    sourceSpellId: spell.id,
    casterId,
    duration: 0.12,
    effect: {
      damage: spell.damage.notation,
      damageType: spell.damageType,
      save: spell.save,
      halfOnSuccess: spell.halfOnSuccess,
    },
    render: { char: "x", color: "#ff6633", hidden: false },
  });
}
