import { getDistance, normalizeVector } from "../../engine/world/collision.js";
import { getSpellDefinition } from "./spellDefinitions.js";
import * as geometry from "./spellGeometry.js";

export function getSpellTargetingMode(spellOrId) {
  const spell = typeof spellOrId === "string" ? getSpellDefinition(spellOrId) : spellOrId;
  return spell?.targeting ?? spell?.targetMode ?? "self";
}

export function buildSpellTarget({ spellId, caster, mouseWorldPoint, selectedTarget = null, selectedDirection = null, selectedPoint = null }) {
  const spell = getSpellDefinition(spellId);
  const mode = getSpellTargetingMode(spell);
  const origin = caster ? { x: caster.x, y: caster.y } : null;

  if (mode === "self") return { spell, mode, origin, target: caster };
  if (mode === "creature") return { spell, mode, origin, target: selectedTarget };
  if (mode === "direction") {
    const point = selectedPoint ?? mouseWorldPoint ?? origin;
    const direction = selectedDirection ?? normalizeVector(point.x - origin.x, point.y - origin.y);
    return { spell, mode, origin, direction, point };
  }

  const point = selectedPoint ?? mouseWorldPoint ?? origin;
  return { spell, mode, origin, point, distance: origin && point ? getDistance(origin, point) : 0 };
}

export const spellGeometry = geometry;
export * from "./spellGeometry.js";
