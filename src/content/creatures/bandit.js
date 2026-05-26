import { Component, Faction, makeCollider, makeHealth, makePosition, makeRenderable } from "../../engine/ecs/components.js";
import { ecsWorld } from "../../engine/ecs/entityManager.js";
import { getCreatureDefinition } from "./creatureDefinitions.js";

export function spawnBanditEcs({ id, x, y }) {
  const definition = getCreatureDefinition("bandit");
  return ecsWorld.upsert(id ?? `bandit:${Date.now()}`, {
    [Component.POSITION]: makePosition(x, y),
    [Component.COLLIDER]: makeCollider({ radius: 0.35, blocksMovement: true }),
    [Component.HEALTH]: makeHealth(definition.hp, definition.hp),
    [Component.CREATURE]: { id: definition.id, name: definition.name, kind: definition.kind },
    [Component.AI]: { type: definition.ai, state: "idle" },
    [Component.FACTION]: { id: Faction.HOSTILE },
    [Component.RENDERABLE]: makeRenderable({ char: "b" }),
    [Component.TAGS]: ["creature", "enemy", "bandit"],
  });
}
