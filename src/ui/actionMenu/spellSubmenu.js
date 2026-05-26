import { listSpellDefinitions } from "../../content/spells/spellDefinitions.js";

export function getSpellSubmenuOptions(filter = () => true) {
  return listSpellDefinitions().filter(filter).map((spell) => ({
    id: spell.id,
    label: spell.name,
    level: spell.level,
    targeting: spell.targeting,
    concentration: Boolean(spell.concentration),
  }));
}
