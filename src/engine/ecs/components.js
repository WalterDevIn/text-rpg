// Component names used by the hybrid ECS layer.
//
// Boundary rule:
// - Components model simulated world state only.
// - UI widgets, asset manifests, static content definitions, settings and save files are not ECS entities.
// - Data definitions live in src/content or src/config; an ECS entity is created only when that data becomes
//   something active in the world.
export const Component = Object.freeze({
  SOURCE_REF: "sourceRef",

  // Spatial simulation
  POSITION: "position",
  PREVIOUS_POSITION: "previousPosition",
  VELOCITY: "velocity",
  ACCELERATION: "acceleration",
  ORIENTATION: "orientation",
  COLLIDER: "collider",
  TILE_OCCUPIER: "tileOccupier",
  VISION_MODIFIER: "visionModifier",

  // Presentation data for world entities only. UI rendering is not modeled through ECS.
  RENDERABLE: "renderable",

  // Creature/combat simulation
  HEALTH: "health",
  CREATURE: "creature",
  PLAYER_CONTROLLED: "playerControlled",
  AI: "ai",
  FACTION: "faction",
  RELATIONSHIPS: "relationships",
  VISION: "vision",
  SPELLCASTER: "spellcaster",
  CASTING: "casting",
  COOLDOWNS: "cooldowns",
  ACTION_ECONOMY: "actionEconomy",
  ACTION_INTENT: "actionIntent",
  STATUS_EFFECTS: "statusEffects",
  VISIBLE: "visible",
  DEAD: "dead",

  // Projectile/effect simulation
  PROJECTILE: "projectile",
  HOMING: "homing",
  BOUNCY: "bouncy",
  DAMAGE_ON_HIT: "damageOnHit",
  LIFETIME: "lifetime",
  AREA_EFFECT: "areaEffect",
  SPELL_EFFECT: "spellEffect",
  SEGMENTED_BODY: "segmentedBody",
  SEGMENT: "segment",

  // World interactables
  INVENTORY: "inventory",
  ITEM: "item",
  CHEST: "chest",
  MERCHANT: "merchant",
  INTERACTABLE: "interactable",
  DOOR: "door",
  TRAP: "trap",

  TAGS: "tags",
});

export const Faction = Object.freeze({
  PLAYER: "player",
  ALLY: "ally",
  HOSTILE: "hostile",
  NEUTRAL: "neutral",
  WORLD: "world",
});

export function hasComponent(entity, componentName) {
  return Object.prototype.hasOwnProperty.call(entity?.components ?? {}, componentName);
}

export function hasComponents(entity, componentNames) {
  return componentNames.every((name) => hasComponent(entity, name));
}

export function makePosition(x = 0, y = 0) {
  return { x, y };
}

export function makeVelocity(x = 0, y = 0) {
  return { x, y };
}

export function makeCollider(options = {}) {
  return {
    radius: options.radius ?? 0,
    width: options.width ?? null,
    height: options.height ?? null,
    blocksMovement: options.blocksMovement ?? true,
    blocksVision: options.blocksVision ?? false,
    blocksProjectiles: options.blocksProjectiles ?? false,
    solid: options.solid ?? true,
  };
}

export function makeHealth(current = 1, max = current) {
  return { current, max };
}

export function makeRenderable(options = {}) {
  return {
    char: options.char ?? "?",
    color: options.color ?? "#ffffff",
    baseColor: options.baseColor ?? options.color ?? "#ffffff",
    drawSize: options.drawSize,
    portraitKey: options.portraitKey,
    portraitName: options.portraitName,
    hidden: options.hidden ?? false,
    layer: options.layer ?? "entity",
  };
}

export function makeSourceRef(sourceType, ref, sourceId = ref?.id ?? null) {
  return { sourceType, sourceId, ref };
}

export function makeLifetime(remaining = 0) {
  return { remaining };
}

export function makeActionIntent(type, payload = {}) {
  return {
    type,
    payload,
    createdAt: performance?.now?.() ?? Date.now(),
    consumed: false,
  };
}
