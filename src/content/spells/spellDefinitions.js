import { ActionType } from "../../engine/state/gameState.js";
import {
  BURNING_HANDS_CONE_ANGLE_RADIANS,
  BURNING_HANDS_DAMAGE_DICE,
  BURNING_HANDS_DAMAGE_DIE,
  BURNING_HANDS_RANGE_FEET,
  CHROMATIC_ORB_DAMAGE_DICE,
  CHROMATIC_ORB_DAMAGE_DIE,
  CHROMATIC_ORB_RANGE_FEET,
  COUNTERSPELL_RANGE_FEET,
  FIREBALL_DAMAGE_DICE,
  FIREBALL_DAMAGE_DIE,
  FIREBALL_RADIUS_FEET,
  FIREBALL_RANGE_FEET,
  FIRE_BOLT_DAMAGE_DICE,
  FIRE_BOLT_DAMAGE_DIE,
  FIRE_BOLT_RANGE_FEET,
  DANCING_LIGHTS_RANGE_FEET,
  DANCING_LIGHTS_COUNT,
  DANCING_LIGHTS_DURATION,
  SHOCKING_GRASP_RANGE_FEET,
  SHOCKING_GRASP_INACTIVE_DURATION,
  SHOCKING_GRASP_DAMAGE_DICE,
  SHOCKING_GRASP_DAMAGE_DIE,
  FALSE_LIFE_TEMP_HP_DICE,
  FALSE_LIFE_TEMP_HP_DIE,
  FALSE_LIFE_TEMP_HP_BONUS,
  FALSE_LIFE_DURATION,
  EXPEDITIOUS_RETREAT_DURATION,
  HEALING_WORD_RANGE_FEET,
  MAGIC_MISSILE_COUNT,
  MAGIC_MISSILE_DAMAGE,
  MAGIC_MISSILE_RANGE_FEET,
  SHIELD_DURATION,
  SPELL_CAST_TIME,
  SPELL_COOLDOWN,
  VORTEX_WARP_RANGE_FEET,
  WALL_OF_FORCE_DURATION,
  WALL_OF_FORCE_LENGTH_TILES,
  WALL_OF_FORCE_RANGE_FEET,
} from "../../config/constants.js";

// Catálogo estático. Las definiciones NO son entidades ECS.
// Un conjuro se vuelve ECS solamente cuando su casteo crea algo vivo en la simulación:
// proyectil, área, muro temporal, estado alterado, intención, cooldown, etc.
export const SpellId = Object.freeze({
  CURE_WOUNDS: "cure_wounds",
  TIME_STOP: "time_stop",
  MAGIC_MISSILE: "magic_missile",
  BURNING_HANDS: "burning_hands",
  SHIELD: "shield",
  WALL_OF_FORCE: "wall_of_force",
  FIREBALL: "fireball",
  VORTEX_WARP: "vortex_warp",
  COUNTERSPELL: "counterspell",
  FIRE_BOLT: "fire_bolt",
  DANCING_LIGHTS: "dancing_lights",
  SHOCKING_GRASP: "shocking_grasp",
  FALSE_LIFE: "false_life",
  EXPEDITIOUS_RETREAT: "expeditious_retreat",
  CHROMATIC_ORB: "chromatic_orb",
});

export const ACTION_TYPE_TO_SPELL_ID = Object.freeze({
  [ActionType.CAST_CURE_WOUNDS]: SpellId.CURE_WOUNDS,
  [ActionType.CAST_TIME_STOP]: SpellId.TIME_STOP,
  [ActionType.CAST_MAGIC_MISSILE]: SpellId.MAGIC_MISSILE,
  [ActionType.CAST_BURNING_HANDS]: SpellId.BURNING_HANDS,
  [ActionType.CAST_SHIELD]: SpellId.SHIELD,
  [ActionType.CAST_WALL_OF_FORCE]: SpellId.WALL_OF_FORCE,
  [ActionType.CAST_FIREBALL]: SpellId.FIREBALL,
  [ActionType.CAST_VORTEX_WARP]: SpellId.VORTEX_WARP,
  [ActionType.CAST_COUNTERSPELL]: SpellId.COUNTERSPELL,
  [ActionType.CAST_FIRE_BOLT]: SpellId.FIRE_BOLT,
  [ActionType.CAST_DANCING_LIGHTS]: SpellId.DANCING_LIGHTS,
  [ActionType.CAST_SHOCKING_GRASP]: SpellId.SHOCKING_GRASP,
  [ActionType.CAST_FALSE_LIFE]: SpellId.FALSE_LIFE,
  [ActionType.CAST_EXPEDITIOUS_RETREAT]: SpellId.EXPEDITIOUS_RETREAT,
  [ActionType.CAST_CHROMATIC_ORB]: SpellId.CHROMATIC_ORB,
});

export const SPELL_ID_TO_ACTION_TYPE = Object.freeze(Object.fromEntries(
  Object.entries(ACTION_TYPE_TO_SPELL_ID).map(([actionType, spellId]) => [spellId, actionType])
));

function dice(count, die, bonus = 0) {
  return { count, die, bonus, notation: `${count}d${die}${bonus ? `+${bonus}` : ""}` };
}

export const spellDefinitions = Object.freeze({
  [SpellId.CURE_WOUNDS]: {
    id: SpellId.CURE_WOUNDS,
    actionType: ActionType.CAST_CURE_WOUNDS,
    name: "Sanar heridas",
    level: 1,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: HEALING_WORD_RANGE_FEET,
    targeting: "creature",
    creates: "healing_effect",
    healing: dice(1, 8),
    ecsAdapter: "castCureWoundsEcs",
  },

  [SpellId.TIME_STOP]: {
    id: SpellId.TIME_STOP,
    actionType: ActionType.CAST_TIME_STOP,
    name: "Detener el tiempo",
    level: 9,
    school: "transmutation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: 0,
    targeting: "self",
    creates: "world_time_effect",
    durationFormula: "(1d4 + 1) * 6 segundos",
    ecsAdapter: "castTimeStopEcs",
  },

  [SpellId.MAGIC_MISSILE]: {
    id: SpellId.MAGIC_MISSILE,
    actionType: ActionType.CAST_MAGIC_MISSILE,
    name: "Misil mágico",
    level: 1,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: MAGIC_MISSILE_RANGE_FEET,
    targeting: "enemy",
    creates: "homing_projectile_volley",
    projectileType: "magic_missile",
    projectileCount: MAGIC_MISSILE_COUNT,
    damage: { amount: MAGIC_MISSILE_DAMAGE, type: "force", notation: String(MAGIC_MISSILE_DAMAGE) },
    ecsAdapter: "castMagicMissileEcs",
  },

  [SpellId.BURNING_HANDS]: {
    id: SpellId.BURNING_HANDS,
    actionType: ActionType.CAST_BURNING_HANDS,
    name: "Manos ardientes",
    level: 1,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: BURNING_HANDS_RANGE_FEET,
    targeting: "direction",
    retargetDuringCast: true,
    creates: "cone_area_effect",
    areaType: "burning_hands_cone",
    shape: "cone",
    coneAngleRadians: BURNING_HANDS_CONE_ANGLE_RADIANS,
    damage: dice(BURNING_HANDS_DAMAGE_DICE, BURNING_HANDS_DAMAGE_DIE),
    damageType: "fire",
    save: "dex",
    halfOnSuccess: true,
    ecsAdapter: "castBurningHandsEcs",
  },

  [SpellId.SHIELD]: {
    id: SpellId.SHIELD,
    actionType: ActionType.CAST_SHIELD,
    name: "Escudo",
    level: 1,
    school: "abjuration",
    castTimeSeconds: 0,
    cooldownSeconds: 0,
    rangeFeet: HEALING_WORD_RANGE_FEET,
    targeting: "creature",
    reaction: true,
    creates: "status_effect",
    statusEffectType: "shield",
    durationSeconds: SHIELD_DURATION,
    shieldHpFormula: "target.maxHp",
    ecsAdapter: "castShieldEcs",
  },

  [SpellId.WALL_OF_FORCE]: {
    id: SpellId.WALL_OF_FORCE,
    actionType: ActionType.CAST_WALL_OF_FORCE,
    name: "Muro de fuerza",
    level: 5,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: WALL_OF_FORCE_RANGE_FEET,
    targeting: "point",
    creates: "temporary_wall_tiles",
    concentration: true,
    concentrationLabel: "concentración",
    wallLengthTiles: WALL_OF_FORCE_LENGTH_TILES,
    durationSeconds: WALL_OF_FORCE_DURATION,
    ecsAdapter: "castWallOfForceEcs",
  },

  [SpellId.FIREBALL]: {
    id: SpellId.FIREBALL,
    actionType: ActionType.CAST_FIREBALL,
    name: "Bola de fuego",
    level: 3,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: FIREBALL_RANGE_FEET,
    radiusFeet: FIREBALL_RADIUS_FEET,
    targeting: "fireball_point",
    retargetDuringCast: true,
    creates: "traveling_projectile_then_area_effect",
    projectileType: "fireball",
    areaType: "fireball_explosion",
    damage: dice(FIREBALL_DAMAGE_DICE, FIREBALL_DAMAGE_DIE),
    damageType: "fire",
    save: "dex",
    halfOnSuccess: true,
    ecsAdapter: "castFireballEcs",
  },

  [SpellId.VORTEX_WARP]: {
    id: SpellId.VORTEX_WARP,
    actionType: ActionType.CAST_VORTEX_WARP,
    name: "Vortex Warp",
    level: 2,
    school: "conjuration",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: VORTEX_WARP_RANGE_FEET,
    targeting: "creature_then_point",
    creates: "teleport_effect",
    ecsAdapter: "castVortexWarpEcs",
  },

  [SpellId.COUNTERSPELL]: {
    id: SpellId.COUNTERSPELL,
    actionType: ActionType.CAST_COUNTERSPELL,
    name: "Counterspell",
    level: 3,
    school: "abjuration",
    castTimeSeconds: 0,
    cooldownSeconds: 0,
    rangeFeet: COUNTERSPELL_RANGE_FEET,
    targeting: "casting_enemy",
    reaction: true,
    creates: "interrupt_effect",
    ecsAdapter: "castCounterspellEcs",
  },

  [SpellId.FIRE_BOLT]: {
    id: SpellId.FIRE_BOLT,
    actionType: ActionType.CAST_FIRE_BOLT,
    name: "Saeta de fuego",
    level: 0,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: FIRE_BOLT_RANGE_FEET,
    targeting: "fire_bolt_direction",
    retargetDuringCast: true,
    creates: "line_projectile",
    projectileType: "fire_bolt",
    damage: dice(FIRE_BOLT_DAMAGE_DICE, FIRE_BOLT_DAMAGE_DIE),
    damageType: "fire",
    ecsAdapter: "castFireBoltEcs",
  },

  [SpellId.DANCING_LIGHTS]: {
    id: SpellId.DANCING_LIGHTS,
    actionType: ActionType.CAST_DANCING_LIGHTS,
    name: "Luces danzantes",
    level: 0,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: DANCING_LIGHTS_RANGE_FEET,
    targeting: "dancing_lights_point",
    creates: "light_orbs",
    concentration: true,
    concentrationLabel: "concentración",
    orbCount: DANCING_LIGHTS_COUNT,
    durationSeconds: DANCING_LIGHTS_DURATION,
    ecsAdapter: "castDancingLightsEcs",
  },

  [SpellId.SHOCKING_GRASP]: {
    id: SpellId.SHOCKING_GRASP,
    actionType: ActionType.CAST_SHOCKING_GRASP,
    name: "Contacto electrizante",
    level: 0,
    school: "evocation",
    castTimeSeconds: 0,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: SHOCKING_GRASP_RANGE_FEET,
    targeting: "enemy_touch",
    creates: "inactive_status",
    damage: dice(SHOCKING_GRASP_DAMAGE_DICE, SHOCKING_GRASP_DAMAGE_DIE),
    damageType: "lightning",
    inactiveDurationSeconds: SHOCKING_GRASP_INACTIVE_DURATION,
    ecsAdapter: "castShockingGraspEcs",
  },

  [SpellId.FALSE_LIFE]: {
    id: SpellId.FALSE_LIFE,
    actionType: ActionType.CAST_FALSE_LIFE,
    name: "Vida falsa",
    level: 1,
    school: "necromancy",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: HEALING_WORD_RANGE_FEET,
    targeting: "creature",
    creates: "temporary_hp",
    temporaryHp: dice(FALSE_LIFE_TEMP_HP_DICE, FALSE_LIFE_TEMP_HP_DIE, FALSE_LIFE_TEMP_HP_BONUS),
    durationSeconds: FALSE_LIFE_DURATION,
    ecsAdapter: "castFalseLifeEcs",
  },

  [SpellId.EXPEDITIOUS_RETREAT]: {
    id: SpellId.EXPEDITIOUS_RETREAT,
    actionType: ActionType.CAST_EXPEDITIOUS_RETREAT,
    name: "Retirada expeditiva",
    level: 1,
    school: "transmutation",
    castTimeSeconds: 0,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: 0,
    targeting: "self",
    creates: "speed_status",
    concentration: true,
    concentrationLabel: "concentración",
    durationSeconds: EXPEDITIOUS_RETREAT_DURATION,
    ecsAdapter: "castExpeditiousRetreatEcs",
  },

  [SpellId.CHROMATIC_ORB]: {
    id: SpellId.CHROMATIC_ORB,
    actionType: ActionType.CAST_CHROMATIC_ORB,
    name: "Orbe cromático",
    level: 1,
    school: "evocation",
    castTimeSeconds: SPELL_CAST_TIME,
    cooldownSeconds: SPELL_COOLDOWN,
    rangeFeet: CHROMATIC_ORB_RANGE_FEET,
    targeting: "chromatic_orb_point",
    retargetDuringCast: true,
    creates: "weighted_bouncy_projectile",
    projectileType: "chromatic_orb",
    damage: dice(CHROMATIC_ORB_DAMAGE_DICE, CHROMATIC_ORB_DAMAGE_DIE),
    damageTypeOptions: ["acid", "cold", "fire", "lightning", "poison", "thunder"],
    defaultDamageType: "acid",
    ecsAdapter: "castChromaticOrbEcs",
  },
});

export function getSpellDefinition(spellId) {
  return spellDefinitions[spellId] ?? null;
}

export function getSpellDefinitionByActionType(actionType) {
  const spellId = ACTION_TYPE_TO_SPELL_ID[actionType];
  return spellId ? getSpellDefinition(spellId) : null;
}

export function getActionTypeForSpell(spellId) {
  return SPELL_ID_TO_ACTION_TYPE[spellId] ?? null;
}

export function getSpellIdForActionType(actionType) {
  return ACTION_TYPE_TO_SPELL_ID[actionType] ?? null;
}

export function listSpellDefinitions() {
  return Object.values(spellDefinitions);
}

export function assertCompleteSpellActionCoverage(actionTypes = Object.values(ActionType)) {
  const castActions = actionTypes.filter((actionType) => actionType.startsWith("cast_"));
  const missingDefinitions = castActions.filter((actionType) => !getSpellDefinitionByActionType(actionType));
  const missingActions = listSpellDefinitions().filter((spell) => !spell.actionType).map((spell) => spell.id);

  return {
    ok: missingDefinitions.length === 0 && missingActions.length === 0,
    missingDefinitions,
    missingActions,
    castActionCount: castActions.length,
    spellDefinitionCount: listSpellDefinitions().length,
  };
}
