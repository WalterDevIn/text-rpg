import { Component, Faction } from "./components.js";
import { ecsWorld } from "./entityManager.js";

export function getPlayerEntity() {
  return ecsWorld.queryOne([Component.PLAYER_CONTROLLED, Component.POSITION]);
}

export function getLivingCreatures() {
  return ecsWorld.queryWhere([Component.POSITION, Component.HEALTH, Component.CREATURE], (entity) => {
    const health = entity.components.health;
    return health.current > 0;
  });
}

export function getLivingHostiles() {
  return getLivingCreatures().filter((entity) => entity.components.faction?.id === Faction.HOSTILE);
}

export function getLivingAllies() {
  return getLivingCreatures().filter((entity) => entity.components.faction?.id === Faction.ALLY || entity.components.faction?.id === Faction.PLAYER);
}

export function getProjectiles() {
  return ecsWorld.query([Component.PROJECTILE, Component.POSITION]);
}

export function getAreaEffects() {
  return ecsWorld.query([Component.AREA_EFFECT, Component.POSITION]);
}

export function getActiveSpellEffects() {
  return ecsWorld.query([Component.SPELL_EFFECT]);
}

export function getMovementBlockers() {
  return ecsWorld.queryWhere([Component.POSITION, Component.COLLIDER], (entity) => {
    const collider = entity.components.collider;
    const health = entity.components.health;
    return collider.blocksMovement && (!health || health.current > 0);
  });
}

export function getProjectileBlockers() {
  return ecsWorld.queryWhere([Component.POSITION, Component.COLLIDER], (entity) => {
    const collider = entity.components.collider;
    const health = entity.components.health;
    return collider.blocksProjectiles && (!health || health.current > 0);
  });
}

export function getVisionBlockers() {
  return ecsWorld.queryWhere([Component.POSITION, Component.COLLIDER], (entity) => {
    const collider = entity.components.collider;
    const visionModifier = entity.components.visionModifier;
    const health = entity.components.health;
    return (collider.blocksVision || visionModifier?.blocksVision) && (!health || health.current > 0);
  });
}

export function getDoors() {
  return ecsWorld.query([Component.DOOR, Component.POSITION]);
}

export function getTraps() {
  return ecsWorld.query([Component.TRAP, Component.POSITION]);
}

export function getInteractables() {
  return ecsWorld.query([Component.INTERACTABLE, Component.POSITION]);
}

export function getItemsOnGround() {
  return ecsWorld.query([Component.ITEM, Component.POSITION]);
}

export function getSegmentedBodies() {
  return ecsWorld.query([Component.SEGMENTED_BODY]);
}

export function getEntitiesByFaction(factionId) {
  return ecsWorld.queryWhere([Component.FACTION], (entity) => entity.components.faction?.id === factionId);
}

export function getSourceRefs(sourceType = null) {
  return ecsWorld.queryWhere([Component.SOURCE_REF], (entity) => {
    return !sourceType || entity.components.sourceRef.sourceType === sourceType;
  });
}

export function getEntitiesWithActionIntent() {
  return ecsWorld.queryWhere([Component.ACTION_INTENT], (entity) => !entity.components.actionIntent?.consumed);
}
