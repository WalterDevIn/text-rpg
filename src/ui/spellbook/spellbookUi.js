import { listSpellDefinitions } from "../../content/spells/spellDefinitions.js";

export function getSpellbookUiModel() {
  return listSpellDefinitions().map((spell) => ({
    id: spell.id,
    name: spell.name,
    level: spell.level,
    description: spell.description ?? "",
  }));
}
