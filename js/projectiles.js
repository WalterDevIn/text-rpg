import {
  ARROW_PROJECTILE_CHAR,
  ARROW_PROJECTILE_COLOR,
  ARROW_PROJECTILE_DRAW_SIZE,
  ARROW_PROJECTILE_LIFETIME,
  ARROW_PROJECTILE_RADIUS,
  ARROW_PROJECTILE_SPEED,
  BURNING_HANDS_CHAR,
  BURNING_HANDS_EMISSION_INTERVAL,
  BURNING_HANDS_LIFETIME,
  BURNING_HANDS_PROJECTILE_COUNT,
  BURNING_HANDS_RADIUS,
  BURNING_HANDS_RANGE_PIXELS,
  BURNING_HANDS_SPEED,
  CHROMATIC_ORB_ACCELERATION,
  CHROMATIC_ORB_INITIAL_SPEED,
  CHROMATIC_ORB_MAX_SPEED,
  CHROMATIC_ORB_PROJECTILE_CHAR,
  CHROMATIC_ORB_PROJECTILE_COLOR,
  CHROMATIC_ORB_PROJECTILE_DRAW_SIZE,
  CHROMATIC_ORB_PROJECTILE_LIFETIME,
  CHROMATIC_ORB_PROJECTILE_RADIUS,
  CHROMATIC_ORB_TURN_SPEED,
  BURNING_HANDS_CONE_ANGLE_RADIANS,
  DRAGON_BOSS_BREATH_CONE_ANGLE_RADIANS,
  DRAGON_BOSS_BREATH_PROJECTILE_COUNT,
  DRAGON_BOSS_BREATH_RANGE_PIXELS,
  FIREBALL_ORB_RADIUS,
  FIREBALL_ORB_SPEED,
  FIREBALL_RADIUS_PIXELS,
  FIREBALL_SPARK_COUNT,
  FIREBALL_SPARK_LIFETIME,
  FIRE_BOLT_PROJECTILE_CHAR,
  FIRE_BOLT_PROJECTILE_COLOR,
  FIRE_BOLT_PROJECTILE_DRAW_SIZE,
  FIRE_BOLT_PROJECTILE_LIFETIME,
  FIRE_BOLT_PROJECTILE_RADIUS,
  FIRE_BOLT_PROJECTILE_SPEED,
  MAGIC_MISSILE_ACCELERATION,
  MAGIC_MISSILE_CHAR,
  MAGIC_MISSILE_COUNT,
  MAGIC_MISSILE_DAMAGE,
  MAGIC_MISSILE_INITIAL_SPEED,
  MAGIC_MISSILE_LIFETIME,
  MAGIC_MISSILE_MAX_SPEED,
  MAGIC_MISSILE_RADIUS,
  MAGIC_MISSILE_SPAWN_DISTANCE,
  MAGIC_MISSILE_TURN_SPEED,
} from "./constants.js";

import { EnemyState, gameState } from "./state.js";
import { getDistance, isCollidingWithWall, normalizeVector } from "./physics.js";
import { findPath, hasLineOfSight } from "./pathfinding.js";
import { createGroundItem, ItemId } from "./items.js";
import { groundItems } from "./inventory.js";

export const projectiles = [];

const fireballDetonations = [];

let nextProjectileId = 1;

export function spawnMagicMissileVolley(caster, target) {
  if (!caster || !target || isTargetDead(target)) {
    return false;
  }

  const baseAngle = Math.atan2(target.y - caster.y, target.x - caster.x);
  const spread = (Math.PI * 2) / MAGIC_MISSILE_COUNT;

  for (let i = 0; i < MAGIC_MISSILE_COUNT; i++) {
    const spawnAngle = baseAngle + i * spread;

    projectiles.push({
      id: nextProjectileId++,
      kind: "magic_missile",
      caster,
      target,
      x: caster.x + Math.cos(spawnAngle) * MAGIC_MISSILE_SPAWN_DISTANCE,
      y: caster.y + Math.sin(spawnAngle) * MAGIC_MISSILE_SPAWN_DISTANCE,
      radius: MAGIC_MISSILE_RADIUS,
      drawSize: MAGIC_MISSILE_RADIUS * 2,
      char: MAGIC_MISSILE_CHAR,
      color: getMissileColor(caster),
      angle: spawnAngle,
      path: [],
      pathRecalcRemaining: 0,
      waypoint: null,
      speed: MAGIC_MISSILE_INITIAL_SPEED,
      maxSpeed: MAGIC_MISSILE_MAX_SPEED,
      acceleration: MAGIC_MISSILE_ACCELERATION,
      turnSpeed: MAGIC_MISSILE_TURN_SPEED,
      damage: MAGIC_MISSILE_DAMAGE,
      lifetime: MAGIC_MISSILE_LIFETIME,
      delay: 0,
      alive: true,
    });
  }

  return true;
}

export function spawnBurningHandsFlames(caster, direction, targets = []) {
  if (!caster || isTargetDead(caster)) {
    return false;
  }

  const normalizedDirection = normalizeVector(direction?.x ?? 0, direction?.y ?? 0);

  if (normalizedDirection.x === 0 && normalizedDirection.y === 0) {
    return false;
  }

  const baseAngle = Math.atan2(normalizedDirection.y, normalizedDirection.x);
  const startAngle = baseAngle - BURNING_HANDS_CONE_ANGLE_RADIANS / 2;
  const step = BURNING_HANDS_CONE_ANGLE_RADIANS / Math.max(1, BURNING_HANDS_PROJECTILE_COUNT - 1);

  for (let i = 0; i < BURNING_HANDS_PROJECTILE_COUNT; i++) {
    const angle = startAngle + step * i + getSmallFlameWobble(i);
    const delay = Math.random() * BURNING_HANDS_EMISSION_INTERVAL;
    const speedJitter = 0.78 + Math.random() * 0.38;
    const rangeJitter = 0.78 + Math.random() * 0.22;

    projectiles.push({
      id: nextProjectileId++,
      kind: "burning_hands_flame",
      caster,
      targets,
      x: caster.x + Math.cos(angle) * (caster.radius + BURNING_HANDS_RADIUS + 2),
      y: caster.y + Math.sin(angle) * (caster.radius + BURNING_HANDS_RADIUS + 2),
      radius: BURNING_HANDS_RADIUS,
      drawSize: BURNING_HANDS_RADIUS * (2.4 + Math.random() * 0.8),
      char: BURNING_HANDS_CHAR,
      color: getFlameColor(i),
      angle,
      speed: BURNING_HANDS_SPEED * speedJitter,
      lifetime: BURNING_HANDS_LIFETIME + Math.random() * 0.25,
      remainingDistance: BURNING_HANDS_RANGE_PIXELS * rangeJitter,
      delay,
      alive: true,
    });
  }

  return true;
}


export function spawnDragonBreathFlames(caster, direction) {
  if (!caster || isTargetDead(caster)) {
    return false;
  }

  const normalizedDirection = normalizeVector(direction?.x ?? 0, direction?.y ?? 0);

  if (normalizedDirection.x === 0 && normalizedDirection.y === 0) {
    return false;
  }

  const baseAngle = Math.atan2(normalizedDirection.y, normalizedDirection.x);
  const startAngle = baseAngle - DRAGON_BOSS_BREATH_CONE_ANGLE_RADIANS / 2;
  const step = DRAGON_BOSS_BREATH_CONE_ANGLE_RADIANS / Math.max(1, DRAGON_BOSS_BREATH_PROJECTILE_COUNT - 1);

  for (let i = 0; i < DRAGON_BOSS_BREATH_PROJECTILE_COUNT; i++) {
    const angle = startAngle + step * i + getDragonFlameWobble(i);
    const delay = Math.random() * 0.55;
    const speedJitter = 0.75 + Math.random() * 0.45;
    const rangeJitter = 0.82 + Math.random() * 0.24;

    projectiles.push({
      id: nextProjectileId++,
      kind: "dragon_breath_flame",
      caster,
      targets: [],
      x: caster.x + Math.cos(angle) * (caster.radius + BURNING_HANDS_RADIUS + 2),
      y: caster.y + Math.sin(angle) * (caster.radius + BURNING_HANDS_RADIUS + 2),
      radius: BURNING_HANDS_RADIUS * 1.2,
      drawSize: BURNING_HANDS_RADIUS * (3.0 + Math.random() * 1.2),
      char: BURNING_HANDS_CHAR,
      color: getDragonFlameColor(i),
      angle,
      speed: BURNING_HANDS_SPEED * 1.25 * speedJitter,
      lifetime: BURNING_HANDS_LIFETIME * 1.55 + Math.random() * 0.35,
      remainingDistance: DRAGON_BOSS_BREATH_RANGE_PIXELS * rangeJitter,
      delay,
      alive: true,
    });
  }

  return true;
}


export function spawnArrowShot(caster, target, options = {}) {
  if (!caster || !target || isTargetDead(target)) {
    return false;
  }

  const direction = normalizeVector(target.x - caster.x, target.y - caster.y);

  if (direction.x === 0 && direction.y === 0) {
    return false;
  }

  projectiles.push({
    id: nextProjectileId++,
    kind: "arrow",
    caster,
    target,
    targets: options.targets ?? [target],
    x: caster.x + direction.x * (caster.radius + ARROW_PROJECTILE_RADIUS + 2),
    y: caster.y + direction.y * (caster.radius + ARROW_PROJECTILE_RADIUS + 2),
    previousX: caster.x,
    previousY: caster.y,
    radius: ARROW_PROJECTILE_RADIUS,
    drawSize: ARROW_PROJECTILE_DRAW_SIZE,
    char: ARROW_PROJECTILE_CHAR,
    color: ARROW_PROJECTILE_COLOR,
    angle: Math.atan2(direction.y, direction.x),
    speed: ARROW_PROJECTILE_SPEED,
    damage: options.damage ?? 1,
    rollText: options.rollText ?? "",
    weaponName: options.weaponName ?? "arco",
    lifetime: ARROW_PROJECTILE_LIFETIME,
    delay: 0,
    alive: true,
  });

  return true;
}


export function spawnArrowShotAtPoint(caster, point, options = {}) {
  if (!caster || !point || isTargetDead(caster)) {
    return false;
  }

  const direction = normalizeVector(point.x - caster.x, point.y - caster.y);

  if (direction.x === 0 && direction.y === 0) {
    return false;
  }

  projectiles.push({
    id: nextProjectileId++,
    kind: "arrow",
    caster,
    target: null,
    targets: options.targets ?? [],
    x: caster.x + direction.x * (caster.radius + ARROW_PROJECTILE_RADIUS + 2),
    y: caster.y + direction.y * (caster.radius + ARROW_PROJECTILE_RADIUS + 2),
    previousX: caster.x,
    previousY: caster.y,
    radius: ARROW_PROJECTILE_RADIUS,
    drawSize: ARROW_PROJECTILE_DRAW_SIZE,
    char: ARROW_PROJECTILE_CHAR,
    color: ARROW_PROJECTILE_COLOR,
    angle: Math.atan2(direction.y, direction.x),
    speed: ARROW_PROJECTILE_SPEED,
    damage: options.damage ?? 1,
    rollText: options.rollText ?? "",
    weaponName: options.weaponName ?? "arco",
    lifetime: ARROW_PROJECTILE_LIFETIME,
    delay: 0,
    alive: true,
  });

  return true;
}


export function spawnFireBoltShotAtPoint(caster, point, options = {}) {
  if (!caster || !point || isTargetDead(caster)) {
    return false;
  }

  const direction = normalizeVector(point.x - caster.x, point.y - caster.y);

  if (direction.x === 0 && direction.y === 0) {
    return false;
  }

  projectiles.push({
    id: nextProjectileId++,
    kind: "fire_bolt",
    caster,
    target: null,
    targets: options.targets ?? [],
    x: caster.x + direction.x * (caster.radius + FIRE_BOLT_PROJECTILE_RADIUS + 2),
    y: caster.y + direction.y * (caster.radius + FIRE_BOLT_PROJECTILE_RADIUS + 2),
    previousX: caster.x,
    previousY: caster.y,
    radius: FIRE_BOLT_PROJECTILE_RADIUS,
    drawSize: FIRE_BOLT_PROJECTILE_DRAW_SIZE,
    char: FIRE_BOLT_PROJECTILE_CHAR,
    color: FIRE_BOLT_PROJECTILE_COLOR,
    angle: Math.atan2(direction.y, direction.x),
    speed: FIRE_BOLT_PROJECTILE_SPEED,
    damage: options.damage ?? 1,
    rollText: options.rollText ?? "",
    lifetime: FIRE_BOLT_PROJECTILE_LIFETIME,
    delay: 0,
    alive: true,
  });

  return true;
}



export function spawnChromaticOrbShot(caster, point, options = {}) {
  if (!caster || !point || isTargetDead(caster)) {
    return false;
  }

  const direction = normalizeVector(point.x - caster.x, point.y - caster.y);

  if (direction.x === 0 && direction.y === 0) {
    return false;
  }

  projectiles.push({
    id: nextProjectileId++,
    kind: "chromatic_orb",
    caster,
    targetPoint: { x: point.x, y: point.y },
    targets: options.targets ?? [],
    x: caster.x + direction.x * (caster.radius + CHROMATIC_ORB_PROJECTILE_RADIUS + 3),
    y: caster.y + direction.y * (caster.radius + CHROMATIC_ORB_PROJECTILE_RADIUS + 3),
    previousX: caster.x,
    previousY: caster.y,
    radius: CHROMATIC_ORB_PROJECTILE_RADIUS,
    drawSize: CHROMATIC_ORB_PROJECTILE_DRAW_SIZE,
    char: CHROMATIC_ORB_PROJECTILE_CHAR,
    color: CHROMATIC_ORB_PROJECTILE_COLOR,
    angle: Math.atan2(direction.y, direction.x),
    speed: CHROMATIC_ORB_INITIAL_SPEED,
    maxSpeed: CHROMATIC_ORB_MAX_SPEED,
    acceleration: CHROMATIC_ORB_ACCELERATION,
    turnSpeed: CHROMATIC_ORB_TURN_SPEED,
    damage: options.damage ?? 1,
    rollText: options.rollText ?? "",
    lifetime: CHROMATIC_ORB_PROJECTILE_LIFETIME,
    delay: 0,
    alive: true,
  });

  return true;
}

export function spawnFireballVisual(caster, point, options = {}) {
  if (!caster || !point || isTargetDead(caster)) {
    return false;
  }

  const direction = normalizeVector(point.x - caster.x, point.y - caster.y);

  if (direction.x === 0 && direction.y === 0) {
    return false;
  }

  const distanceToTarget = getDistance(caster, point);

  projectiles.push({
    id: nextProjectileId++,
    kind: "fireball_orb",
    caster,
    targetPoint: { x: point.x, y: point.y },
    damage: options.damage ?? 0,
    damageRolls: options.damageRolls ?? [],
    x: caster.x + direction.x * (caster.radius + FIREBALL_ORB_RADIUS + 3),
    y: caster.y + direction.y * (caster.radius + FIREBALL_ORB_RADIUS + 3),
    radius: FIREBALL_ORB_RADIUS,
    drawSize: FIREBALL_ORB_RADIUS * 3.2,
    char: "x",
    color: "#ff6600",
    angle: Math.atan2(direction.y, direction.x),
    speed: FIREBALL_ORB_SPEED,
    lifetime: distanceToTarget / FIREBALL_ORB_SPEED + 1,
    delay: 0,
    alive: true,
  });

  return true;
}

function detonateFireball(projectile, point, reason) {
  fireballDetonations.push({
    point: { x: point.x, y: point.y },
    damage: projectile.damage ?? 0,
    damageRolls: projectile.damageRolls ?? [],
    reason,
  });

  spawnFireballExplosion(point);
}

export function consumeFireballDetonations() {
  return fireballDetonations.splice(0, fireballDetonations.length);
}

function spawnFireballExplosion(point) {
  for (let i = 0; i < FIREBALL_SPARK_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / FIREBALL_SPARK_COUNT + (Math.random() - 0.5) * 0.18;
    const distance = FIREBALL_RADIUS_PIXELS * (0.18 + Math.random() * 0.82);
    const speed = FIREBALL_RADIUS_PIXELS * (1.1 + Math.random() * 1.2);

    projectiles.push({
      id: nextProjectileId++,
      kind: "fireball_spark",
      x: point.x,
      y: point.y,
      radius: FIREBALL_ORB_RADIUS * 0.8,
      drawSize: FIREBALL_ORB_RADIUS * (2.2 + Math.random() * 1.2),
      char: "x",
      color: getFireballSparkColor(i),
      angle,
      speed,
      targetDistance: distance,
      traveledDistance: 0,
      lifetime: FIREBALL_SPARK_LIFETIME + Math.random() * 0.25,
      delay: Math.random() * 0.08,
      alive: true,
    });
  }
}

export function updateProjectiles(deltaTime) {
  for (const projectile of projectiles) {
    if (!projectile.alive) {
      continue;
    }

    if (projectile.delay > 0) {
      projectile.delay = Math.max(0, projectile.delay - deltaTime);
      continue;
    }

    if (projectile.kind === "magic_missile") {
      updateMagicMissile(projectile, deltaTime);
    } else if (projectile.kind === "arrow") {
      updateArrow(projectile, deltaTime);
    } else if (projectile.kind === "fire_bolt") {
      updateFireBolt(projectile, deltaTime);
    } else if (projectile.kind === "chromatic_orb") {
      updateChromaticOrb(projectile, deltaTime);
    } else if (projectile.kind === "burning_hands_flame" || projectile.kind === "dragon_breath_flame") {
      updateBurningHandsFlame(projectile, deltaTime);
    } else if (projectile.kind === "fireball_orb") {
      updateFireballOrb(projectile, deltaTime);
    } else if (projectile.kind === "fireball_spark") {
      updateFireballSpark(projectile, deltaTime);
    }
  }

  removeDeadProjectiles();
}

function updateMagicMissile(projectile, deltaTime) {
  projectile.lifetime -= deltaTime;

  if (projectile.lifetime <= 0 || isTargetDead(projectile.target)) {
    projectile.alive = false;
    return;
  }

  updateMagicMissileWaypoint(projectile, deltaTime);
  rotateProjectileTowardPoint(projectile, projectile.waypoint ?? projectile.target, deltaTime);
  accelerateProjectile(projectile, deltaTime);

  const totalDistance = projectile.speed * deltaTime;
  const stepDistance = Math.max(2, projectile.radius * 0.75);
  const steps = Math.max(1, Math.ceil(totalDistance / stepDistance));
  const distancePerStep = totalDistance / steps;

  for (let i = 0; i < steps; i++) {
    const nextX = projectile.x + Math.cos(projectile.angle) * distancePerStep;
    const nextY = projectile.y + Math.sin(projectile.angle) * distancePerStep;

    if (isCollidingWithWall(projectile, nextX, nextY)) {
      // Si se encuentra una esquina cerrada, recalcula de inmediato e intenta
      // girar hacia el siguiente nodo en vez de morir contra la pared.
      projectile.pathRecalcRemaining = 0;
      updateMagicMissileWaypoint(projectile, 0);
      rotateProjectileTowardPoint(projectile, projectile.waypoint ?? projectile.target, 0.12);
      const retryX = projectile.x + Math.cos(projectile.angle) * distancePerStep;
      const retryY = projectile.y + Math.sin(projectile.angle) * distancePerStep;

      if (isCollidingWithWall(projectile, retryX, retryY)) {
        projectile.alive = false;
        return;
      }

      projectile.x = retryX;
      projectile.y = retryY;
    } else {
      projectile.x = nextX;
      projectile.y = nextY;
    }

    if (hasProjectileHitTarget(projectile, projectile.target)) {
      damageTarget(projectile.target, projectile.damage, projectile.kind);
      projectile.alive = false;
      return;
    }
  }
}

function updateMagicMissileWaypoint(projectile, deltaTime) {
  projectile.pathRecalcRemaining = Math.max(0, (projectile.pathRecalcRemaining ?? 0) - deltaTime);

  if (hasLineOfSight(projectile, projectile.target)) {
    projectile.path = [];
    projectile.waypoint = projectile.target;
    projectile.pathRecalcRemaining = 0.18;
    return;
  }

  if (projectile.pathRecalcRemaining <= 0 || !projectile.waypoint || getDistance(projectile, projectile.waypoint) < 8) {
    projectile.path = findPath(projectile, projectile.target, { maxVisited: 1800 });
    projectile.pathRecalcRemaining = 0.18;
  }

  while (projectile.path?.length > 0 && getDistance(projectile, projectile.path[0]) < 10) {
    projectile.path.shift();
  }

  projectile.waypoint = projectile.path?.[0] ?? projectile.target;
}

function updateArrow(projectile, deltaTime) {
  projectile.lifetime -= deltaTime;

  if (projectile.lifetime <= 0) {
    projectile.alive = false;
    return;
  }

  const totalDistance = projectile.speed * deltaTime;
  const stepDistance = Math.max(2, projectile.radius * 0.75);
  const steps = Math.max(1, Math.ceil(totalDistance / stepDistance));
  const distancePerStep = totalDistance / steps;
  const stepX = Math.cos(projectile.angle) * distancePerStep;
  const stepY = Math.sin(projectile.angle) * distancePerStep;

  for (let i = 0; i < steps; i++) {
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;

    const nextX = projectile.x + stepX;
    const nextY = projectile.y + stepY;

    if (isCollidingWithWall(projectile, nextX, nextY)) {
      stickArrowIntoWall(projectile);
      projectile.alive = false;
      return;
    }

    projectile.x = nextX;
    projectile.y = nextY;

    const hitTarget = getFirstArrowHitTarget(projectile);

    if (hitTarget) {
      damageTarget(hitTarget, projectile.damage, projectile.kind, projectile);
      projectile.alive = false;
      return;
    }
  }
}

function updateFireBolt(projectile, deltaTime) {
  projectile.lifetime -= deltaTime;

  if (projectile.lifetime <= 0) {
    projectile.alive = false;
    return;
  }

  const totalDistance = projectile.speed * deltaTime;
  const stepDistance = Math.max(2, projectile.radius * 0.75);
  const steps = Math.max(1, Math.ceil(totalDistance / stepDistance));
  const distancePerStep = totalDistance / steps;
  const stepX = Math.cos(projectile.angle) * distancePerStep;
  const stepY = Math.sin(projectile.angle) * distancePerStep;

  for (let i = 0; i < steps; i++) {
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;

    const nextX = projectile.x + stepX;
    const nextY = projectile.y + stepY;

    if (isCollidingWithWall(projectile, nextX, nextY)) {
      projectile.alive = false;
      gameState.message = "La saeta de fuego se extingue contra la pared.";
      return;
    }

    projectile.x = nextX;
    projectile.y = nextY;

    const hitTarget = getFirstFireBoltHitTarget(projectile);

    if (hitTarget) {
      damageTarget(hitTarget, projectile.damage, projectile.kind, projectile);
      projectile.alive = false;
      return;
    }
  }
}



function updateChromaticOrb(projectile, deltaTime) {
  projectile.lifetime -= deltaTime;

  if (projectile.lifetime <= 0) {
    projectile.alive = false;
    return;
  }

  if (gameState.mouseWorldPoint) {
    projectile.targetPoint = { x: gameState.mouseWorldPoint.x, y: gameState.mouseWorldPoint.y };
  }

  rotateProjectileTowardPoint(projectile, projectile.targetPoint, deltaTime);
  accelerateProjectile(projectile, deltaTime);

  const totalDistance = projectile.speed * deltaTime;
  const stepDistance = Math.max(2, projectile.radius * 0.75);
  const steps = Math.max(1, Math.ceil(totalDistance / stepDistance));
  const distancePerStep = totalDistance / steps;

  for (let i = 0; i < steps; i++) {
    projectile.previousX = projectile.x;
    projectile.previousY = projectile.y;

    const nextX = projectile.x + Math.cos(projectile.angle) * distancePerStep;
    const nextY = projectile.y + Math.sin(projectile.angle) * distancePerStep;

    if (isCollidingWithWall(projectile, nextX, nextY)) {
      projectile.alive = false;
      gameState.message = "El orbe cromático se rompe contra la pared.";
      return;
    }

    projectile.x = nextX;
    projectile.y = nextY;

    const hitTarget = getFirstChromaticOrbHitTarget(projectile);

    if (hitTarget) {
      damageTarget(hitTarget, projectile.damage, projectile.kind, projectile);
      projectile.alive = false;
      return;
    }
  }
}

function updateBurningHandsFlame(projectile, deltaTime) {
  projectile.lifetime -= deltaTime;

  if (projectile.lifetime <= 0 || projectile.remainingDistance <= 0) {
    projectile.alive = false;
    return;
  }

  const distanceToMove = projectile.speed * deltaTime;
  const nextX = projectile.x + Math.cos(projectile.angle) * distanceToMove;
  const nextY = projectile.y + Math.sin(projectile.angle) * distanceToMove;

  if (isCollidingWithWall(projectile, nextX, nextY)) {
    projectile.alive = false;
    return;
  }

  projectile.x = nextX;
  projectile.y = nextY;
  projectile.remainingDistance -= distanceToMove;

  if (getFirstHitTarget(projectile)) {
    projectile.alive = false;
  }
}


function updateFireballOrb(projectile, deltaTime) {
  projectile.lifetime -= deltaTime;

  if (projectile.lifetime <= 0) {
    projectile.alive = false;
    return;
  }

  const totalDistance = projectile.speed * deltaTime;
  const stepDistance = Math.max(2, projectile.radius * 0.75);
  const steps = Math.max(1, Math.ceil(totalDistance / stepDistance));
  const distancePerStep = totalDistance / steps;
  const stepX = Math.cos(projectile.angle) * distancePerStep;
  const stepY = Math.sin(projectile.angle) * distancePerStep;

  for (let i = 0; i < steps; i++) {
    const distanceToTarget = getDistance(projectile, projectile.targetPoint);

    if (distancePerStep >= distanceToTarget) {
      projectile.x = projectile.targetPoint.x;
      projectile.y = projectile.targetPoint.y;
      detonateFireball(projectile, projectile.targetPoint, "target");
      projectile.alive = false;
      return;
    }

    const nextX = projectile.x + stepX;
    const nextY = projectile.y + stepY;

    if (isCollidingWithWall(projectile, nextX, nextY)) {
      detonateFireball(projectile, { x: projectile.x, y: projectile.y }, "wall");
      projectile.alive = false;
      return;
    }

    projectile.x = nextX;
    projectile.y = nextY;
  }
}

function updateFireballSpark(projectile, deltaTime) {
  projectile.lifetime -= deltaTime;

  if (projectile.lifetime <= 0 || projectile.traveledDistance >= projectile.targetDistance) {
    projectile.alive = false;
    return;
  }

  const distanceToMove = Math.min(projectile.speed * deltaTime, projectile.targetDistance - projectile.traveledDistance);
  projectile.x += Math.cos(projectile.angle) * distanceToMove;
  projectile.y += Math.sin(projectile.angle) * distanceToMove;
  projectile.traveledDistance += distanceToMove;
}

function getFirstArrowHitTarget(projectile) {
  const targets = projectile.targets ?? (projectile.target ? [projectile.target] : []);

  return targets.find((target) => {
    return !isTargetDead(target) && hasProjectileHitTarget(projectile, target);
  }) ?? null;
}

function getFirstFireBoltHitTarget(projectile) {
  const targets = projectile.targets ?? [];

  return targets.find((target) => {
    return !isTargetDead(target) && hasProjectileHitTarget(projectile, target);
  }) ?? null;
}

function getFirstChromaticOrbHitTarget(projectile) {
  const targets = projectile.targets ?? [];

  return targets.find((target) => {
    return !isTargetDead(target) && hasProjectileHitTarget(projectile, target);
  }) ?? null;
}


function getFirstHitTarget(projectile) {
  if (!projectile.targets) {
    return null;
  }

  return projectile.targets.find((target) => {
    return !isTargetDead(target) && hasProjectileHitTarget(projectile, target);
  }) ?? null;
}

function rotateProjectileTowardTarget(projectile, deltaTime) {
  rotateProjectileTowardPoint(projectile, projectile.target, deltaTime);
}

function rotateProjectileTowardPoint(projectile, point, deltaTime) {
  const desiredAngle = Math.atan2(
    point.y - projectile.y,
    point.x - projectile.x
  );

  const angleDelta = normalizeAngle(desiredAngle - projectile.angle);
  const maxRotation = projectile.turnSpeed * deltaTime;
  const appliedRotation = clamp(angleDelta, -maxRotation, maxRotation);

  projectile.angle += appliedRotation;
}

function accelerateProjectile(projectile, deltaTime) {
  const accelerationFactor = Math.max(0, 1 - projectile.speed / projectile.maxSpeed);
  projectile.speed = Math.min(
    projectile.maxSpeed,
    projectile.speed + projectile.acceleration * accelerationFactor * deltaTime
  );
}

function hasProjectileHitTarget(projectile, target) {
  if (projectile.kind === "arrow" || projectile.kind === "fire_bolt" || projectile.kind === "chromatic_orb") {
    return getDistanceFromPointToSegment(
      target,
      { x: projectile.previousX ?? projectile.x, y: projectile.previousY ?? projectile.y },
      { x: projectile.x, y: projectile.y }
    ) <= projectile.radius + target.radius;
  }

  return getDistance(projectile, target) <= projectile.radius + target.radius;
}

function getDistanceFromPointToSegment(point, segmentStart, segmentEnd) {
  const dx = segmentEnd.x - segmentStart.x;
  const dy = segmentEnd.y - segmentStart.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return getDistance(point, segmentStart);
  }

  const t = clamp(
    ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) / lengthSquared,
    0,
    1
  );

  const closest = {
    x: segmentStart.x + dx * t,
    y: segmentStart.y + dy * t,
  };

  return getDistance(point, closest);
}

function damageTarget(target, damage, damageKind, projectile = null) {
  if (damageKind === "magic_missile" && target.shieldRemaining > 0) {
    gameState.message = `${target.name ?? "El objetivo"} bloquea Misil mágico con Escudo.`;
    return;
  }

  target.hp = Math.max(0, target.hp - damage);

  if (target.hp > 0) {
    if (damageKind === "fire_bolt") {
      gameState.message = `Saeta de fuego golpea a ${target.name ?? "su objetivo"} por ${damage} de daño${projectile?.rollText ? `. Tirada: ${projectile.rollText}` : ""}.`;
      return;
    }

    if (damageKind === "chromatic_orb") {
      gameState.message = `Orbe cromático golpea a ${target.name ?? "su objetivo"} por ${damage} de daño${projectile?.rollText ? `. Tirada: ${projectile.rollText}` : ""}.`;
      return;
    }

    if (damageKind === "arrow") {
      gameState.message = `Una flecha golpea a ${target.name ?? "su objetivo"} por ${damage} de daño${projectile?.rollText ? `. Tirada: ${projectile.rollText}` : ""}.`;
      return;
    }

    gameState.message = `Un misil mágico golpea a ${target.name ?? "su objetivo"} por ${damage} de daño.`;
    return;
  }

  target.hp = 0;

  if (target.state !== undefined) {
    target.state = EnemyState.DEAD;
  }

  target.char = "%";
  target.color = "#777777";

  if (target.name) {
    if (damageKind === "fire_bolt") {
      gameState.message = `Saeta de fuego golpea a ${target.name} por ${damage} de daño. Muere${projectile?.rollText ? `. Tirada: ${projectile.rollText}` : ""}.`;
      return;
    }

    if (damageKind === "chromatic_orb") {
      gameState.message = `Orbe cromático golpea a ${target.name} por ${damage} de daño. Muere${projectile?.rollText ? `. Tirada: ${projectile.rollText}` : ""}.`;
      return;
    }

    if (damageKind === "arrow") {
      gameState.message = `Una flecha golpea a ${target.name} por ${damage} de daño. Muere${projectile?.rollText ? `. Tirada: ${projectile.rollText}` : ""}.`;
      return;
    }

    gameState.message = `Un misil mágico golpea a ${target.name} por ${damage} de daño. Muere.`;
  } else {
    gameState.message = `Recibes ${damage} de daño. Has muerto.`;
  }
}

function stickArrowIntoWall(projectile) {
  groundItems.push(createGroundItem(
    ItemId.ARROW,
    projectile.previousX ?? projectile.x,
    projectile.previousY ?? projectile.y,
    1
  ));
  gameState.message = "La flecha falla y se clava en la pared. Puedes recuperarla caminando sobre ella.";
}

function isTargetDead(target) {
  return target.hp <= 0 || target.state === EnemyState.DEAD;
}

function getMissileColor(caster) {
  if (caster.char === "@") {
    return "#7fdbff";
  }

  return "#ff66ff";
}

function getFlameColor(index) {
  if (index % 4 === 0) return "#ff2200";
  if (index % 4 === 1) return "#ff6600";
  if (index % 4 === 2) return "#ff9900";
  return "#dd0000";
}

function getSmallFlameWobble(index) {
  const pattern = [-0.06, 0.035, -0.025, 0.055, 0.01, -0.045];
  return pattern[index % pattern.length];
}

function getDragonFlameColor(index) {
  if (index % 5 === 0) return "#ff1100";
  if (index % 5 === 1) return "#ff4a00";
  if (index % 5 === 2) return "#ff8800";
  if (index % 5 === 3) return "#ffaa00";
  return "#dd0000";
}

function getFireballSparkColor(index) {
  if (index % 5 === 0) return "#ff2200";
  if (index % 5 === 1) return "#ff6600";
  if (index % 5 === 2) return "#ffaa00";
  if (index % 5 === 3) return "#ffff66";
  return "#dd0000";
}

function getDragonFlameWobble(index) {
  const pattern = [-0.12, 0.08, -0.04, 0.13, 0.02, -0.09, 0.06];
  return pattern[index % pattern.length] + (Math.random() - 0.5) * 0.04;
}

function removeDeadProjectiles() {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    if (!projectiles[i].alive) {
      projectiles.splice(i, 1);
    }
  }
}

function normalizeAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
