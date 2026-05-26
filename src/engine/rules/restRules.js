import { player } from "../../content/creatures/player.js";
import { enemies } from "../../content/creatures/enemy.js";
import { companions } from "../../content/companions/companions.js";
import { EnemyState } from "../state/gameState.js";
import { getCurrentRegionForEntity, isSurfaceLayer } from "../world/map.js";

export function getLongRestStatus() {
  if (isSurfaceLayer()) {
    return {
      allowed: false,
      reason: "Sólo puedes hacer descanso largo dentro de una sala segura de mazmorra.",
      region: null,
      enemiesInRoom: [],
    };
  }

  const region = getCurrentRegionForEntity(player);

  if (!region || region.kind !== "room") {
    return {
      allowed: false,
      reason: "Necesitas estar dentro de una sala, no en un pasillo, escalera o umbral.",
      region,
      enemiesInRoom: [],
    };
  }

  const enemiesInRoom = getLivingEnemiesInRegion(region);

  if (enemiesInRoom.length > 0) {
    return {
      allowed: false,
      reason: `No puedes descansar: hay ${enemiesInRoom.length} enemigo(s) en esta sala.`,
      region,
      enemiesInRoom,
    };
  }

  return {
    allowed: true,
    reason: "La sala está despejada. Puedes hacer un descanso largo.",
    region,
    enemiesInRoom,
  };
}

export function canTakeLongRest() {
  return getLongRestStatus().allowed;
}

export function takeLongRest() {
  const status = getLongRestStatus();

  if (!status.allowed) {
    return {
      ok: false,
      message: status.reason,
    };
  }

  restorePlayerHitPoints();
  restorePlayerSpellSlots();
  restoreWarriorCompanions();
  clearPlayerCastingState();

  return {
    ok: true,
    message: "Descanso largo completado: recuperas todos tus PG y espacios de conjuro. El guerrero también recupera toda su vida.",
  };
}

function getLivingEnemiesInRegion(region) {
  return enemies.filter((enemy) => {
    if (!enemy || enemy.hp <= 0 || enemy.state === EnemyState.DEAD) {
      return false;
    }

    const enemyRegion = getCurrentRegionForEntity(enemy);
    return enemyRegion?.id === region.id;
  });
}

function restorePlayerHitPoints() {
  player.hp = player.maxHp;
}

function restorePlayerSpellSlots() {
  for (const slot of Object.values(player.spellSlots ?? {})) {
    slot.remaining = slot.max;
  }
}

function restoreWarriorCompanions() {
  for (const companion of companions) {
    if (companion.companionType !== "warrior") continue;
    companion.hp = companion.maxHp;
    companion.attackCooldown = 0;
    companion.reactionCooldown = 0;

    if (companion.state === EnemyState.DEAD) {
      companion.state = EnemyState.IDLE;
      companion.char = "G";
      companion.color = companion.baseColor ?? "#e6c15c";
    }
  }
}

function clearPlayerCastingState() {
  player.attackCooldown = 0;
  player.spellCooldown = 0;
  player.isCasting = false;
  player.castingSpell = null;
  player.castingTargetId = null;
  player.castingAimDirection = null;
  player.castingBoardPoint = null;
  player.castingRemaining = 0;
  player.concentration = null;
}
