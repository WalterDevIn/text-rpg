import {
  ATTACK_RANGE_FEET,
  ATTACK_RANGE_PIXELS,
  ENEMY_LOW_HP_PERCENT,
  PLAYER_ATTACK_COOLDOWN,
  MAGIC_MISSILE_RANGE_PIXELS,
} from "./constants.js";

import { EnemyState, gameState } from "./state.js";
import { player } from "./player.js";
import { enemies, killEnemy } from "./enemy.js";
import { getDistance, getSurfaceDistance } from "./physics.js";
import { rollDie } from "./dice.js";
import { getItemDefinition, ItemId, ItemType } from "./items.js";
import { spawnArrowShot, spawnArrowShotAtPoint } from "./projectiles.js";

export function isInAttackRange(attacker, target) {
  return getSurfaceDistance(attacker, target) <= ATTACK_RANGE_PIXELS;
}

export function isTargetInWeaponRange(attacker, target, weaponItem) {
  const weapon = getItemDefinition(weaponItem);
  const rangePixels = weapon?.rangePixels ?? ATTACK_RANGE_PIXELS;
  return getSurfaceDistance(attacker, target) <= rangePixels;
}

export function isInMagicMissileRange(caster, target) {
  return getDistance(caster, target) <= MAGIC_MISSILE_RANGE_PIXELS;
}

export function getLivingEnemies() {
  return enemies.filter((enemy) => {
    return enemy.state !== EnemyState.DEAD && enemy.hp > 0;
  });
}

export function getEnemiesInAttackRange(weaponItem = null) {
  const weapon = weaponItem ?? getDefaultWeapon();

  return getLivingEnemies().filter((enemy) => {
    return isTargetInWeaponRange(player, enemy, weapon);
  });
}

export function getEnemiesInWeaponRange(weaponItem) {
  return getLivingEnemies().filter((enemy) => isTargetInWeaponRange(player, enemy, weaponItem));
}

export function getEnemiesInItemRange(item) {
  const definition = getItemDefinition(item);
  const rangePixels = definition?.rangePixels ?? 0;

  return getLivingEnemies().filter((enemy) => getSurfaceDistance(player, enemy) <= rangePixels);
}

export function getEnemiesInMagicMissileRange() {
  return getLivingEnemies().filter((enemy) => {
    return getSurfaceDistance(player, enemy) <= MAGIC_MISSILE_RANGE_PIXELS;
  });
}

export function executeSelectedAttack() {
  const target = enemies.find((enemy) => enemy.id === gameState.selectedTargetId);
  const weapon = getPlayerInventoryItemByInstanceId(gameState.selectedInventoryItemId) ?? getDefaultWeapon();
  const weaponDefinition = getItemDefinition(weapon);

  if (!weapon) {
    gameState.message = "No tienes un arma para atacar.";
    return;
  }

  if (weaponDefinition?.ranged && gameState.selectedBoardPoint) {
    playerShootAtPoint(gameState.selectedBoardPoint, weapon);
    return;
  }

  if (!target) {
    gameState.message = "No hay objetivo elegido.";
    return;
  }

  playerAttack(target, weapon);
}

export function playerAttack(target, weaponItem = null) {
  const weapon = weaponItem ?? getDefaultWeapon();
  const weaponDefinition = getItemDefinition(weapon);

  if (player.hp <= 0) {
    gameState.message = "No puedes atacar. Estás muerto.";
    return;
  }

  if (!weaponDefinition) {
    gameState.message = "No tienes un arma válida para atacar.";
    return;
  }

  if (!target || target.state === EnemyState.DEAD) {
    gameState.message = "Ese enemigo ya está muerto.";
    return;
  }

  if (player.attackCooldown > 0) {
    gameState.message = `Tu ataque sigue en cooldown: ${player.attackCooldown.toFixed(1)}s.`;
    return;
  }

  if (!isTargetInWeaponRange(player, target, weapon)) {
    gameState.message = `${target.name} está fuera del alcance de ${weaponDefinition.name}: ${weaponDefinition.rangeFeet} pies.`;
    return;
  }

  const rolls = rollMany(weaponDefinition.damageDice, weaponDefinition.damageDie);
  const damage = rolls.reduce((sum, roll) => sum + roll, 0) + (weaponDefinition.damageBonus ?? 0);
  const rollText = formatDamageRoll(rolls, weaponDefinition.damageBonus ?? 0);

  if (weaponDefinition.ranged) {
    const arrow = getPlayerInventoryStackByDefinitionId(ItemId.ARROW);

    if (!arrow || arrow.quantity <= 0) {
      gameState.message = "No tienes flechas para disparar con el arco.";
      return;
    }

    arrow.quantity -= 1;

    if (arrow.quantity <= 0) {
      const index = player.inventory.indexOf(arrow);

      if (index >= 0) {
        player.inventory.splice(index, 1);
      }
    }

    player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
    spawnArrowShot(player, target, {
      damage,
      rollText,
      weaponName: weaponDefinition.name,
      targets: getLivingEnemies(),
      maxRangePixels: weaponDefinition.rangePixels,
    });
    gameState.message = `Disparas una flecha con ${weaponDefinition.name} contra ${target.name}.`;
    return;
  }

  target.hp = Math.max(0, target.hp - damage);
  player.attackCooldown = PLAYER_ATTACK_COOLDOWN;

  const attackText = `${weaponDefinition.attackVerb ?? "Golpeas"} a ${target.name} con ${weaponDefinition.name}`;

  if (target.hp <= 0) {
    killEnemy(target);
    gameState.message = `${attackText} por ${damage} de daño. Muere. Tirada: ${rollText}.`;
    return;
  }

  if (target.hp / target.maxHp <= ENEMY_LOW_HP_PERCENT) {
    gameState.message = `${attackText} por ${damage} de daño. Entra en pánico y huye. Tirada: ${rollText}.`;
    return;
  }

  gameState.message = `${attackText} por ${damage} de daño. Tirada: ${rollText}.`;
}

function playerShootAtPoint(boardPoint, weaponItem) {
  const weaponDefinition = getItemDefinition(weaponItem);

  if (player.hp <= 0) {
    gameState.message = "No puedes atacar. Estás muerto.";
    return;
  }

  if (!weaponDefinition?.ranged) {
    gameState.message = "Sólo las armas a distancia pueden dispararse hacia una dirección.";
    return;
  }

  if (player.attackCooldown > 0) {
    gameState.message = `Tu ataque sigue en cooldown: ${player.attackCooldown.toFixed(1)}s.`;
    return;
  }

  const distance = getDistance(player, boardPoint);

  if (distance <= 0) {
    gameState.message = "Elegí un punto distinto al centro del jugador para disparar.";
    return;
  }

  const arrow = getPlayerInventoryStackByDefinitionId(ItemId.ARROW);

  if (!arrow || arrow.quantity <= 0) {
    gameState.message = "No tienes flechas para disparar con el arco.";
    return;
  }

  const rolls = rollMany(weaponDefinition.damageDice, weaponDefinition.damageDie);
  const damage = rolls.reduce((sum, roll) => sum + roll, 0) + (weaponDefinition.damageBonus ?? 0);
  const rollText = formatDamageRoll(rolls, weaponDefinition.damageBonus ?? 0);

  arrow.quantity -= 1;

  if (arrow.quantity <= 0) {
    const index = player.inventory.indexOf(arrow);

    if (index >= 0) {
      player.inventory.splice(index, 1);
    }
  }

  player.attackCooldown = PLAYER_ATTACK_COOLDOWN;
  spawnArrowShotAtPoint(player, boardPoint, {
    damage,
    rollText,
    weaponName: weaponDefinition.name,
    targets: getLivingEnemies(),
    maxRangePixels: weaponDefinition.rangePixels,
  });
  gameState.message = `Disparas una flecha con ${weaponDefinition.name}.`;
}

function getPlayerInventoryStackByDefinitionId(definitionId) {
  return player.inventory.find((item) => item.definitionId === definitionId) ?? null;
}

function getDefaultWeapon() {
  return player.inventory.find((item) => getItemDefinition(item)?.type === ItemType.WEAPON) ?? null;
}

function getPlayerInventoryItemByInstanceId(instanceId) {
  return player.inventory.find((item) => item.instanceId === instanceId) ?? null;
}

function rollMany(count, die) {
  const rolls = [];

  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(die));
  }

  return rolls;
}

function formatDamageRoll(rolls, bonus) {
  if (bonus > 0) {
    return `${rolls.join(" + ")} + ${bonus}`;
  }

  return rolls.join(" + ");
}
