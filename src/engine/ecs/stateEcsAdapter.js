import { Component } from "./components.js";
import { ecsWorld } from "./entityManager.js";
import {
  componentsFromChestState,
  componentsFromCompanionState,
  componentsFromEnemyState,
  componentsFromItemState,
  componentsFromMerchantState,
  componentsFromPlayerState,
  componentsFromProjectileState,
  entityIdForStateObject,
  pruneUndefinedComponents,
} from "./factories.js";

const SOURCE_TO_FACTORY = {
  player: componentsFromPlayerState,
  enemy: componentsFromEnemyState,
  merchant: componentsFromMerchantState,
  projectile: componentsFromProjectileState,
  item: componentsFromItemState,
  chest: componentsFromChestState,
  companion: componentsFromCompanionState,
};

let runtimeCollections = null;
let frameNumber = 0;

export function initializeHybridEcsRuntime(collections) {
  runtimeCollections = collections;
  ecsWorld.clear();
  syncStateCollectionsToEcs(collections);
}

export function getHybridEcsRuntime() {
  return {
    ecsWorld,
    frameNumber,
    collections: runtimeCollections,
  };
}

export function beginHybridEcsFrame() {
  frameNumber += 1;
  if (runtimeCollections) {
    syncStateCollectionsToEcs(runtimeCollections);
  }
}

export function endHybridEcsFrame() {
  if (runtimeCollections) {
    syncStateCollectionsToEcs(runtimeCollections);
    syncEcsComponentsBackToState();
    removeStaleStateEntities(runtimeCollections);
  }
}

export function syncStateCollectionsToEcs(collections = runtimeCollections) {
  if (!collections) return;

  if (collections.player) upsertStateObject("player", collections.player);
  for (const enemy of collections.enemies ?? []) upsertStateObject("enemy", enemy);
  for (const merchant of collections.merchants ?? []) upsertStateObject("merchant", merchant);
  for (const companion of collections.companions ?? []) upsertStateObject("companion", companion);
  for (const projectile of collections.projectiles ?? []) upsertStateObject("projectile", projectile);
  for (const item of collections.groundItems ?? []) upsertStateObject("item", item);
  for (const chest of collections.chests ?? []) upsertStateObject("chest", chest);
}

export function upsertStateObject(sourceType, stateObject) {
  if (!stateObject) return null;

  const factory = SOURCE_TO_FACTORY[sourceType];
  if (!factory) throw new Error(`No ECS factory registered for source type: ${sourceType}`);

  const id = entityIdForStateObject(sourceType, stateObject);
  const components = pruneUndefinedComponents(factory(stateObject));
  const entity = ecsWorld.upsert(id, components);
  entity.components[Component.SOURCE_REF].lastSeenFrame = frameNumber;
  return entity;
}

export function removeStaleStateEntities(collections = runtimeCollections) {
  if (!collections) return;

  const liveIds = new Set();
  if (collections.player) liveIds.add(entityIdForStateObject("player", collections.player));
  for (const enemy of collections.enemies ?? []) liveIds.add(entityIdForStateObject("enemy", enemy));
  for (const merchant of collections.merchants ?? []) liveIds.add(entityIdForStateObject("merchant", merchant));
  for (const companion of collections.companions ?? []) liveIds.add(entityIdForStateObject("companion", companion));
  for (const projectile of collections.projectiles ?? []) liveIds.add(entityIdForStateObject("projectile", projectile));
  for (const item of collections.groundItems ?? []) liveIds.add(entityIdForStateObject("item", item));
  for (const chest of collections.chests ?? []) liveIds.add(entityIdForStateObject("chest", chest));

  for (const entity of ecsWorld.query([Component.SOURCE_REF])) {
    const sourceType = entity.components.sourceRef.sourceType;
    if (["player", "enemy", "merchant", "companion", "projectile", "item", "chest"].includes(sourceType) && !liveIds.has(entity.id)) {
      ecsWorld.remove(entity.id);
    }
  }
}

export function syncEcsComponentsBackToState() {
  for (const entity of ecsWorld.query([Component.SOURCE_REF])) {
    const stateObject = entity.components.sourceRef.ref;
    if (!stateObject) continue;

    const position = entity.components.position;
    if (position) {
      stateObject.x = position.x;
      stateObject.y = position.y;
    }

    const previousPosition = entity.components.previousPosition;
    if (previousPosition) {
      stateObject.previousX = previousPosition.x;
      stateObject.previousY = previousPosition.y;
    }

    const orientation = entity.components.orientation;
    if (orientation && "angle" in orientation) {
      stateObject.angle = orientation.angle;
    }

    const health = entity.components.health;
    if (health) {
      stateObject.hp = health.current;
      stateObject.maxHp = health.max;
    }

    const renderable = entity.components.renderable;
    if (renderable) {
      if (renderable.char != null) stateObject.char = renderable.char;
      if (renderable.color != null) stateObject.color = renderable.color;
      if (renderable.baseColor != null) stateObject.baseColor = renderable.baseColor;
      if (renderable.drawSize != null) stateObject.drawSize = renderable.drawSize;
    }

    const collider = entity.components.collider;
    if (collider && collider.radius != null) {
      stateObject.radius = collider.radius;
    }

    const ai = entity.components.ai;
    if (ai) {
      if (ai.state != null) stateObject.state = ai.state;
      if (ai.hasSeenPlayer != null) stateObject.hasSeenPlayer = ai.hasSeenPlayer;
      if (ai.lastKnownPlayerPosition !== undefined) stateObject.lastKnownPlayerPosition = ai.lastKnownPlayerPosition;
      if (ai.path !== undefined) stateObject.path = ai.path;
      if (ai.pathTargetTileKey !== undefined) stateObject.pathTargetTileKey = ai.pathTargetTileKey;
      if (ai.pathRecalcRemaining !== undefined) stateObject.pathRecalcRemaining = ai.pathRecalcRemaining;
    }

    const projectile = entity.components.projectile;
    if (projectile) {
      if (projectile.alive != null) stateObject.alive = projectile.alive;
      if (projectile.delay != null) stateObject.delay = projectile.delay;
      if (projectile.remainingDistance !== undefined) stateObject.remainingDistance = projectile.remainingDistance;
      if (projectile.speed != null) stateObject.speed = projectile.speed;
      if (projectile.maxSpeed != null) stateObject.maxSpeed = projectile.maxSpeed;
      if (projectile.turnSpeed != null) stateObject.turnSpeed = projectile.turnSpeed;
    }

    const lifetime = entity.components.lifetime;
    if (lifetime && lifetime.remaining != null) {
      stateObject.lifetime = lifetime.remaining;
    }

    const bouncy = entity.components.bouncy;
    if (bouncy && bouncy.remainingBounces != null) {
      stateObject.remainingBounces = bouncy.remainingBounces;
      stateObject.bouncesRemaining = bouncy.remainingBounces;
    }

    const cooldowns = entity.components.cooldowns;
    if (cooldowns) {
      if (cooldowns.attack != null) stateObject.attackCooldown = cooldowns.attack;
      if (cooldowns.spell != null) stateObject.spellCooldown = cooldowns.spell;
      if (cooldowns.shield != null) stateObject.shieldRemaining = cooldowns.shield;
      if (cooldowns.breath != null) stateObject.breathCooldown = cooldowns.breath;
      if (cooldowns.windup != null) stateObject.actionWindupRemaining = cooldowns.windup;
    }

    const casting = entity.components.casting;
    if (casting) {
      stateObject.isCasting = casting.isCasting;
      stateObject.castingSpell = casting.spell;
      stateObject.castingTargetId = casting.targetId;
      stateObject.castingAimDirection = casting.aimDirection;
      stateObject.castingBoardPoint = casting.boardPoint;
      stateObject.castingRemaining = casting.remaining;
    }
  }
}

export function stateObjectToEntity(sourceType, stateObject) {
  return ecsWorld.get(entityIdForStateObject(sourceType, stateObject));
}

export function entityToStateObject(entityOrId) {
  const entity = typeof entityOrId === "string" ? ecsWorld.get(entityOrId) : entityOrId;
  return entity?.components?.sourceRef?.ref ?? null;
}

export function getStateObjectsFromEntities(entities) {
  return entities.map(entityToStateObject).filter(Boolean);
}
