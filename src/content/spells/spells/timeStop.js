import { Component } from "../../../engine/ecs/components.js";
import { ecsWorld } from "../../../engine/ecs/entityManager.js";
import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";

export function castTimeStopEcs({ casterId, durationSeconds = null } = {}) {
  const spell = getSpellDefinition(SpellId.TIME_STOP);
  const caster = ecsWorld.get(casterId);
  const position = caster?.components?.[Component.POSITION] ?? { x: 0, y: 0 };

  if (caster) {
    const statuses = caster.components[Component.STATUS_EFFECTS] ?? { effects: [] };
    statuses.effects.push({ type: "time_stop_actor", remaining: durationSeconds, sourceSpellId: spell.id });
    caster.components[Component.STATUS_EFFECTS] = statuses;
  }

  return createAreaEffectEntity({
    x: position.x,
    y: position.y,
    shape: "global",
    radius: Infinity,
    sourceSpellId: spell.id,
    casterId,
    duration: durationSeconds ?? 0,
    effect: { type: "time_stop", durationSeconds },
    render: { hidden: true },
  });
}
