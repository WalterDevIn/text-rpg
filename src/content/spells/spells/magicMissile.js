import { createProjectileEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castMagicMissileEcs({ casterId, origin, targetId }) {
  const spell = getSpellDefinition(SpellId.MAGIC_MISSILE);
  const missiles = [];

  for (let i = 0; i < spell.projectileCount; i += 1) {
    missiles.push(createProjectileEntity({
      x: origin.x,
      y: origin.y,
      velocity: { x: 0, y: 0 },
      kind: spell.projectileType,
      casterId,
      targetId,
      damage: { amount: spell.damage.amount, type: spell.damage.type },
      damageType: spell.damage.type,
      lifetime: 5,
      homingStrength: 1,
      render: { char: "x", color: "#cc99ff" },
    }));
  }

  return missiles;
}
