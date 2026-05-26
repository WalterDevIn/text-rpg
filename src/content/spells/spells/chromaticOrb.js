import { createProjectileEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castChromaticOrbEcs({ casterId, origin, targetPoint, damageType = null }) {
  const spell = getSpellDefinition(SpellId.CHROMATIC_ORB);
  const finalDamageType = damageType ?? spell.defaultDamageType;

  return createProjectileEntity({
    x: origin.x,
    y: origin.y,
    velocity: { x: 0, y: 0 },
    kind: spell.projectileType,
    casterId,
    targetPoint,
    radius: 0.25,
    damage: { dice: spell.damage.notation, type: finalDamageType },
    damageType: finalDamageType,
    lifetime: 5,
    bounces: 3,
    homingStrength: 0.12,
    render: { char: "●", color: "#66d9ff" },
  });
}
