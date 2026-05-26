import { resolveSpell, updateSpellEffects } from "./spellCasting.js";
import { castSpellEcs } from "./spellRegistry.js";

export function resolveSpellEffect(spellId, context = {}) {
  if (context.ecs) return castSpellEcs(spellId, context);
  return resolveSpell(spellId, context);
}

export { resolveSpell, updateSpellEffects, castSpellEcs };
