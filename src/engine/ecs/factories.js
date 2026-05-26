import {
  Component,
  Faction,
  makeCollider,
  makeHealth,
  makeSourceRef,
  makePosition,
  makeRenderable,
  makeVelocity,
} from "./components.js";

export function entityIdForStateObject(sourceType, stateObject) {
  const rawId = stateObject?.id ?? stateObject?.instanceId ?? stateObject?.itemInstanceId ?? stateObject?.name ?? "unknown";
  return `${sourceType}:${rawId}`;
}

export function componentsFromPlayerState(player) {
  return {
    [Component.SOURCE_REF]: makeSourceRef("player", player, player.id),
    [Component.POSITION]: makePosition(player.x, player.y),
    [Component.PREVIOUS_POSITION]: makePosition(player.previousX ?? player.x, player.previousY ?? player.y),
    [Component.COLLIDER]: makeCollider({ radius: player.radius, blocksMovement: true }),
    [Component.RENDERABLE]: makeRenderable(player),
    [Component.HEALTH]: makeHealth(player.hp, player.maxHp),
    [Component.CREATURE]: {
      id: player.id,
      name: player.name ?? "Jugador",
      kind: "player",
      portraitKey: player.portraitKey,
      portraitName: player.portraitName,
    },
    [Component.PLAYER_CONTROLLED]: true,
    [Component.FACTION]: { id: Faction.PLAYER },
    [Component.VISION]: { rangePixels: Infinity, usesPlayerVisibility: true },
    [Component.SPELLCASTER]: { spellSlots: player.spellSlots, saveDc: player.spellSaveDc ?? null },
    [Component.CASTING]: {
      isCasting: Boolean(player.isCasting),
      spell: player.castingSpell ?? null,
      targetId: player.castingTargetId ?? null,
      aimDirection: player.castingAimDirection ?? null,
      boardPoint: player.castingBoardPoint ?? null,
      remaining: player.castingRemaining ?? 0,
    },
    [Component.COOLDOWNS]: {
      attack: player.attackCooldown ?? 0,
      spell: player.spellCooldown ?? 0,
      shield: player.shieldRemaining ?? 0,
    },
    [Component.INVENTORY]: { items: player.inventory ?? [], gold: player.gold ?? 0 },
    [Component.ACTION_ECONOMY]: { action: true, bonusAction: true, reaction: true, movement: true },
    [Component.TAGS]: ["player", "creature"],
  };
}

export function componentsFromEnemyState(enemy) {
  return {
    [Component.SOURCE_REF]: makeSourceRef("enemy", enemy, enemy.id),
    [Component.POSITION]: makePosition(enemy.x, enemy.y),
    [Component.PREVIOUS_POSITION]: makePosition(enemy.previousX ?? enemy.x, enemy.previousY ?? enemy.y),
    [Component.COLLIDER]: makeCollider({ radius: enemy.radius, blocksMovement: enemy.hp > 0 }),
    [Component.RENDERABLE]: makeRenderable({
      char: enemy.char,
      color: enemy.color,
      baseColor: enemy.baseColor,
      drawSize: enemy.drawSize,
      portraitKey: enemy.portraitKey,
      portraitName: enemy.portraitName,
    }),
    [Component.HEALTH]: makeHealth(enemy.hp, enemy.maxHp),
    [Component.CREATURE]: {
      id: enemy.id,
      name: enemy.name,
      kind: enemy.kind ?? "normal",
      portraitKey: enemy.portraitKey,
      portraitName: enemy.portraitName,
    },
    [Component.AI]: {
      type: enemy.kind === "centipede_part" ? "centipede_segment" : enemy.kind === "dragon_boss" ? "dragon_boss" : enemy.canCastMagicMissile ? "caster" : "melee",
      state: enemy.state,
      hasSeenPlayer: Boolean(enemy.hasSeenPlayer),
      lastKnownPlayerPosition: enemy.lastKnownPlayerPosition ?? null,
      currentTargetId: enemy.currentTarget?.id ?? null,
      path: enemy.path ?? [],
      pathTargetTileKey: enemy.pathTargetTileKey ?? null,
      pathRecalcRemaining: enemy.pathRecalcRemaining ?? 0,
    },
    [Component.FACTION]: { id: Faction.HOSTILE },
    [Component.VISION]: { rangePixels: enemy.detectionRangePixels ?? null },
    [Component.SPELLCASTER]: enemy.canCastMagicMissile ? { knownSpells: ["magic_missile"] } : undefined,
    [Component.COOLDOWNS]: {
      attack: enemy.attackCooldown ?? 0,
      spell: enemy.spellCooldown ?? 0,
      breath: enemy.breathCooldown ?? 0,
      windup: enemy.actionWindupRemaining ?? 0,
    },
    [Component.TAGS]: ["enemy", "creature", enemy.kind ?? "normal"],
  };
}

export function componentsFromMerchantState(merchant) {
  return {
    [Component.SOURCE_REF]: makeSourceRef("merchant", merchant, merchant.id),
    [Component.POSITION]: makePosition(merchant.x, merchant.y),
    [Component.COLLIDER]: makeCollider({ radius: merchant.radius, blocksMovement: !merchant.isHired }),
    [Component.RENDERABLE]: makeRenderable(merchant),
    [Component.HEALTH]: makeHealth(merchant.hp ?? 1, merchant.maxHp ?? merchant.hp ?? 1),
    [Component.CREATURE]: { id: merchant.id, name: merchant.name, kind: "merchant" },
    [Component.MERCHANT]: { isHired: Boolean(merchant.isHired), inventory: merchant.inventory ?? [] },
    [Component.INTERACTABLE]: { action: "trade", label: "Comerciar" },
    [Component.FACTION]: { id: merchant.isHired ? Faction.ALLY : Faction.NEUTRAL },
    [Component.AI]: merchant.isHired ? { type: "follower", state: merchant.state ?? "follow" } : undefined,
    [Component.TAGS]: ["merchant", "creature"],
  };
}


export function componentsFromCompanionState(companion) {
  return {
    [Component.SOURCE_REF]: makeSourceRef("companion", companion, companion.id),
    [Component.POSITION]: makePosition(companion.x, companion.y),
    [Component.PREVIOUS_POSITION]: makePosition(companion.previousX ?? companion.x, companion.previousY ?? companion.y),
    [Component.COLLIDER]: makeCollider({ radius: companion.radius, blocksMovement: false }),
    [Component.RENDERABLE]: makeRenderable(companion),
    [Component.HEALTH]: makeHealth(companion.hp ?? 1, companion.maxHp ?? companion.hp ?? 1),
    [Component.CREATURE]: {
      id: companion.id,
      name: companion.name,
      kind: companion.companionType ?? "companion",
      portraitKey: companion.portraitKey,
      portraitName: companion.portraitName,
    },
    [Component.AI]: { type: "sidekick_warrior", state: companion.state ?? "follow" },
    [Component.FACTION]: { id: Faction.ALLY },
    [Component.INVENTORY]: { items: companion.inventory ?? [] },
    [Component.COOLDOWNS]: { attack: companion.attackCooldown ?? 0, reaction: companion.reactionCooldown ?? 0 },
    [Component.TAGS]: ["companion", "ally", "creature", companion.companionType ?? "warrior"],
  };
}

export function componentsFromProjectileState(projectile) {
  return {
    [Component.SOURCE_REF]: makeSourceRef("projectile", projectile, projectile.id),
    [Component.POSITION]: makePosition(projectile.x, projectile.y),
    [Component.PREVIOUS_POSITION]: makePosition(projectile.previousX ?? projectile.x, projectile.previousY ?? projectile.y),
    [Component.VELOCITY]: projectile.speed != null
      ? makeVelocity(Math.cos(projectile.angle ?? 0) * projectile.speed, Math.sin(projectile.angle ?? 0) * projectile.speed)
      : makeVelocity(0, 0),
    [Component.ORIENTATION]: { angle: projectile.angle ?? 0 },
    [Component.COLLIDER]: makeCollider({ radius: projectile.radius ?? 0, blocksMovement: false, blocksProjectiles: false }),
    [Component.RENDERABLE]: makeRenderable(projectile),
    [Component.PROJECTILE]: {
      kind: projectile.kind,
      casterId: projectile.caster?.id ?? null,
      targetId: projectile.target?.id ?? null,
      alive: projectile.alive !== false,
      delay: projectile.delay ?? 0,
      remainingDistance: projectile.remainingDistance ?? null,
      speed: projectile.speed ?? 0,
      maxSpeed: projectile.maxSpeed ?? projectile.speed ?? 0,
      turnSpeed: projectile.turnSpeed ?? 0,
    },
    [Component.HOMING]: projectile.target || projectile.targetPoint ? {
      targetId: projectile.target?.id ?? null,
      targetPoint: projectile.targetPoint ?? null,
      strength: projectile.turnSpeed ?? 0,
    } : undefined,
    [Component.BOUNCY]: projectile.kind === "chromatic_orb" ? {
      remainingBounces: projectile.remainingBounces ?? projectile.bouncesRemaining ?? 3,
    } : undefined,
    [Component.DAMAGE_ON_HIT]: projectile.damage != null || projectile.damageDice
      ? { amount: projectile.damage ?? null, dice: projectile.damageDice ?? null, type: projectile.damageType ?? null }
      : undefined,
    [Component.LIFETIME]: { remaining: projectile.lifetime ?? 0 },
    [Component.TAGS]: ["projectile", projectile.kind].filter(Boolean),
  };
}

export function componentsFromItemState(item) {
  return {
    [Component.SOURCE_REF]: makeSourceRef("item", item, item.id ?? item.instanceId),
    [Component.POSITION]: makePosition(item.x, item.y),
    [Component.COLLIDER]: makeCollider({ radius: item.radius ?? 0, blocksMovement: false }),
    [Component.RENDERABLE]: makeRenderable(item),
    [Component.ITEM]: {
      itemId: item.itemId ?? item.id,
      name: item.name,
      quantity: item.quantity ?? 1,
      data: item,
    },
    [Component.INTERACTABLE]: { action: "pickup", label: "Recoger" },
    [Component.TAGS]: ["item"],
  };
}

export function componentsFromChestState(chest) {
  return {
    [Component.SOURCE_REF]: makeSourceRef("chest", chest, chest.id),
    [Component.POSITION]: makePosition(chest.x, chest.y),
    [Component.COLLIDER]: makeCollider({ radius: chest.radius ?? 0, blocksMovement: true }),
    [Component.RENDERABLE]: makeRenderable(chest),
    [Component.CHEST]: { opened: Boolean(chest.opened), items: chest.items ?? [] },
    [Component.INTERACTABLE]: { action: "open_chest", label: "Abrir" },
    [Component.TAGS]: ["chest"],
  };
}

export function pruneUndefinedComponents(components) {
  return Object.fromEntries(Object.entries(components).filter(([, value]) => value !== undefined));
}
