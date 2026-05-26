import { createProjectileEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castFireBoltEcs({ casterId, origin, targetPoint }) {
  const spell = getSpellDefinition(SpellId.FIRE_BOLT);
  const dx = targetPoint.x - origin.x;
  const dy = targetPoint.y - origin.y;
  const length = Math.hypot(dx, dy) || 1;

  return createProjectileEntity({
    x: origin.x,
    y: origin.y,
    velocity: { x: dx / length, y: dy / length },
    kind: spell.projectileType,
    casterId,
    targetPoint,
    damage: { dice: spell.damage.notation, type: spell.damageType },
    damageType: spell.damageType,
    lifetime: 3.2,
    render: { char: "x", color: "#ff4a00" },
  });
}
