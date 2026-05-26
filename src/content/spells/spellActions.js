import { SpellId, getSpellDefinition, getSpellDefinitionByActionType, getSpellIdForActionType } from "./spellDefinitions.js";
import { castBurningHandsEcs } from "./spells/burningHands.js";
import { castChromaticOrbEcs } from "./spells/chromaticOrb.js";
import { castCounterspellEcs } from "./spells/counterspell.js";
import { castCureWoundsEcs } from "./spells/cureWounds.js";
import { castFireBoltEcs } from "./spells/fireBolt.js";
import { castDancingLightsEcs } from "./spells/dancingLights.js";
import { castShockingGraspEcs } from "./spells/shockingGrasp.js";
import { castFalseLifeEcs } from "./spells/falseLife.js";
import { castExpeditiousRetreatEcs } from "./spells/expeditiousRetreat.js";
import { castFireballEcs } from "./spells/fireball.js";
import { castMagicMissileEcs } from "./spells/magicMissile.js";
import { castShieldEcs } from "./spells/shield.js";
import { castTimeStopEcs } from "./spells/timeStop.js";
import { castVortexWarpEcs } from "./spells/vortexWarp.js";
import { castWallOfForceEcs } from "./spells/wallOfForce.js";

export const SPELL_ECS_CASTERS = Object.freeze({
  [SpellId.CURE_WOUNDS]: castCureWoundsEcs,
  [SpellId.TIME_STOP]: castTimeStopEcs,
  [SpellId.MAGIC_MISSILE]: castMagicMissileEcs,
  [SpellId.BURNING_HANDS]: castBurningHandsEcs,
  [SpellId.SHIELD]: castShieldEcs,
  [SpellId.WALL_OF_FORCE]: castWallOfForceEcs,
  [SpellId.FIREBALL]: castFireballEcs,
  [SpellId.VORTEX_WARP]: castVortexWarpEcs,
  [SpellId.COUNTERSPELL]: castCounterspellEcs,
  [SpellId.FIRE_BOLT]: castFireBoltEcs,
  [SpellId.DANCING_LIGHTS]: castDancingLightsEcs,
  [SpellId.SHOCKING_GRASP]: castShockingGraspEcs,
  [SpellId.FALSE_LIFE]: castFalseLifeEcs,
  [SpellId.EXPEDITIOUS_RETREAT]: castExpeditiousRetreatEcs,
  [SpellId.CHROMATIC_ORB]: castChromaticOrbEcs,
});

export function getSpellEcsCaster(spellIdOrActionType) {
  const spellId = getSpellDefinition(spellIdOrActionType)
    ? spellIdOrActionType
    : getSpellIdForActionType(spellIdOrActionType);

  return spellId ? SPELL_ECS_CASTERS[spellId] ?? null : null;
}

export function castSpellEcs(spellIdOrActionType, options = {}) {
  const spell = getSpellDefinition(spellIdOrActionType)
    ?? getSpellDefinitionByActionType(spellIdOrActionType);

  if (!spell) {
    throw new Error(`No existe una definición de conjuro para: ${spellIdOrActionType}`);
  }

  const caster = SPELL_ECS_CASTERS[spell.id];

  if (!caster) {
    throw new Error(`No existe adaptador ECS para el conjuro: ${spell.id}`);
  }

  return caster(options);
}

export function assertCompleteSpellEcsCoverage() {
  const missingAdapters = Object.values(SpellId).filter((spellId) => !SPELL_ECS_CASTERS[spellId]);
  return {
    ok: missingAdapters.length === 0,
    missingAdapters,
    adapterCount: Object.keys(SPELL_ECS_CASTERS).length,
    spellCount: Object.values(SpellId).length,
  };
}
