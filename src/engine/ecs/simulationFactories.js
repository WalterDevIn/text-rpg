import {
  Component,
  Faction,
  makeCollider,
  makeHealth,
  makeLifetime,
  makePosition,
  makeRenderable,
  makeVelocity,
} from "./components.js";
import { ecsWorld } from "./entityManager.js";

let nextSimulatedId = 1;
function nextId(prefix) {
  return `${prefix}:${nextSimulatedId++}`;
}

export function createDoorEntity({ id, x, y, state = "closed", locked = false, hp = 18, tileId = "wooden_door" }) {
  const open = state === "open" || state === "broken";
  return ecsWorld.upsert(id ?? nextId("door"), {
    [Component.POSITION]: makePosition(x, y),
    [Component.TILE_OCCUPIER]: { tileId },
    [Component.DOOR]: { state, locked, tileId },
    [Component.HEALTH]: makeHealth(hp, hp),
    [Component.COLLIDER]: makeCollider({
      radius: 0.5,
      blocksMovement: !open,
      blocksVision: false,
      blocksProjectiles: !open,
    }),
    [Component.VISION_MODIFIER]: { allowsPeek: !open, blocksVision: false },
    [Component.INTERACTABLE]: { action: open ? "close_door" : "open_door", label: open ? "Cerrar" : "Abrir" },
    [Component.RENDERABLE]: makeRenderable({ char: open ? "/" : "+", layer: "world" }),
    [Component.FACTION]: { id: Faction.WORLD },
    [Component.TAGS]: ["door", "world", "interactable"],
  });
}

export function createTrapEntity({ id, x, y, triggerRadius = 0.45, armed = true, hidden = true, effect = null }) {
  return ecsWorld.upsert(id ?? nextId("trap"), {
    [Component.POSITION]: makePosition(x, y),
    [Component.TRAP]: { armed, hidden, effect },
    [Component.COLLIDER]: makeCollider({ radius: triggerRadius, blocksMovement: false, solid: false }),
    [Component.INTERACTABLE]: { action: "inspect_trap", label: "Inspeccionar" },
    [Component.RENDERABLE]: makeRenderable({ char: "^", hidden, layer: "world" }),
    [Component.FACTION]: { id: Faction.WORLD },
    [Component.TAGS]: ["trap", "world"],
  });
}

export function createDroppedItemEntity({ id, x, y, itemId, name, quantity = 1, data = {} }) {
  return ecsWorld.upsert(id ?? nextId("item"), {
    [Component.POSITION]: makePosition(x, y),
    [Component.COLLIDER]: makeCollider({ radius: 0.25, blocksMovement: false, solid: false }),
    [Component.ITEM]: { itemId, name, quantity, data },
    [Component.INTERACTABLE]: { action: "pickup", label: "Recoger" },
    [Component.RENDERABLE]: makeRenderable({ char: data.char ?? "*", color: data.color, layer: "item" }),
    [Component.TAGS]: ["item", "world"],
  });
}

export function createProjectileEntity({
  id,
  x,
  y,
  velocity = { x: 0, y: 0 },
  kind,
  casterId = null,
  targetId = null,
  targetPoint = null,
  radius = 0.15,
  damage = null,
  damageType = null,
  lifetime = 5,
  render = {},
  bounces = 0,
  homingStrength = 0,
}) {
  const components = {
    [Component.POSITION]: makePosition(x, y),
    [Component.PREVIOUS_POSITION]: makePosition(x, y),
    [Component.VELOCITY]: makeVelocity(velocity.x, velocity.y),
    [Component.COLLIDER]: makeCollider({ radius, blocksMovement: false, solid: false }),
    [Component.PROJECTILE]: { kind, casterId, targetId, targetPoint, alive: true },
    [Component.LIFETIME]: makeLifetime(lifetime),
    [Component.RENDERABLE]: makeRenderable({ char: render.char ?? "•", color: render.color, layer: "projectile" }),
    [Component.TAGS]: ["projectile", kind].filter(Boolean),
  };

  if (targetId || targetPoint || homingStrength > 0) {
    components[Component.HOMING] = { targetId, targetPoint, strength: homingStrength };
  }

  if (bounces > 0) {
    components[Component.BOUNCY] = { remainingBounces: bounces };
  }

  if (damage) {
    components[Component.DAMAGE_ON_HIT] = { amount: damage.amount ?? null, dice: damage.dice ?? null, type: damageType ?? damage.type ?? null };
  }

  return ecsWorld.upsert(id ?? nextId("projectile"), components);
}

export function createAreaEffectEntity({ id, x, y, shape = "circle", radius = 1, angle = null, direction = null, sourceSpellId = null, casterId = null, duration = 0, effect = null, render = {} }) {
  return ecsWorld.upsert(id ?? nextId("area_effect"), {
    [Component.POSITION]: makePosition(x, y),
    [Component.AREA_EFFECT]: { shape, radius, angle, direction },
    [Component.SPELL_EFFECT]: { sourceSpellId, casterId, effect },
    [Component.LIFETIME]: makeLifetime(duration),
    [Component.RENDERABLE]: makeRenderable({ char: render.char ?? "·", color: render.color, hidden: render.hidden ?? true, layer: "effect" }),
    [Component.TAGS]: ["area_effect", sourceSpellId].filter(Boolean),
  });
}

export function createSegmentedBodyEntity({ id, headId, segmentIds = [], mode = "snake" }) {
  return ecsWorld.upsert(id ?? nextId("segmented_body"), {
    [Component.SEGMENTED_BODY]: { headId, segmentIds, mode },
    [Component.TAGS]: ["segmented_body"],
  });
}
