import { getSpellDefinition, listSpellDefinitions, SpellId } from "../content/spells/spellDefinitions.js";

export function getConfiguredSpellDefinition(spellOrId) {
  return getSpellDefinition(spellOrId);
}

export { getSpellDefinition, listSpellDefinitions, SpellId };
