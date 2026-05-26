import { Component, Faction, makeCollider, makeHealth, makePosition, makeRenderable } from "../../engine/ecs/components.js";
import { ecsWorld } from "../../engine/ecs/entityManager.js";
import { createSegmentedBodyEntity } from "../../engine/ecs/simulationFactories.js";
import { getCreatureDefinition } from "./creatureDefinitions.js";

export function spawnCentipedeEcs({ id = "centipede", x, y, segmentCount = null }) {
  const definition = getCreatureDefinition("centipede");
  const count = segmentCount ?? definition.segmentCount;
  const segmentIds = [];

  for (let index = 0; index < count; index++) {
    const segmentId = `${id}:segment:${index}`;
    segmentIds.push(segmentId);
    ecsWorld.upsert(segmentId, {
      [Component.POSITION]: makePosition(x - index * 0.75, y),
      [Component.COLLIDER]: makeCollider({ radius: 0.35, blocksMovement: true }),
      [Component.HEALTH]: makeHealth(Math.ceil(definition.hp / count), Math.ceil(definition.hp / count)),
      [Component.CREATURE]: { id: definition.id, name: definition.name, kind: "centipede_segment" },
      [Component.AI]: { type: "serpent_segment", headId: `${id}:segment:0`, index },
      [Component.FACTION]: { id: Faction.HOSTILE },
      [Component.RENDERABLE]: makeRenderable({ char: index === 0 ? "C" : "c" }),
      [Component.SEGMENT]: { bodyId: `segmented_body:${id}`, index, previousId: segmentIds[index - 1] ?? null },
      [Component.TAGS]: ["creature", "enemy", "centipede", "segment"],
    });
  }

  return createSegmentedBodyEntity({ id: `segmented_body:${id}`, headId: segmentIds[0], segmentIds, mode: "snake" });
}
