import { SpellId } from "../spells/spellDefinitions.js";
import { ItemId } from "../items/items.js";

export const CHARACTER_RACES = Object.freeze([
  {
    id: "human",
    name: "Humano",
    available: true,
    description: "Opción inicial disponible.",
  },
]);

export const CHARACTER_BACKGROUNDS = Object.freeze([
  {
    id: "hermit",
    name: "Ermitaño",
    available: true,
    gold: 5,
    fixedItems: [
      { definitionId: ItemId.SCROLL_CASE, quantity: 1 },
      { definitionId: ItemId.NOTES_FROM_SECLUSION, quantity: 1 },
      { definitionId: ItemId.WINTER_BLANKET, quantity: 1 },
      { definitionId: ItemId.COMMON_CLOTHES, quantity: 1 },
      { definitionId: ItemId.HERBALISM_KIT, quantity: 1 },
    ],
  },
]);

export const CHARACTER_CLASSES = Object.freeze([
  {
    id: "wizard",
    name: "Mago",
    available: true,
    hitDie: "1d6",
    maxHp: 6,
    fixedCantrips: [SpellId.FIRE_BOLT, SpellId.DANCING_LIGHTS, SpellId.SHOCKING_GRASP],
    spellbookPickCount: 6,
    fixedItems: [
      { definitionId: ItemId.PLAYER_SPELLBOOK, quantity: 1 },
    ],
    equipmentChoices: [
      {
        id: "weapon",
        title: "Arma inicial",
        options: [
          { id: "quarterstaff", label: "Bastón", items: [{ definitionId: ItemId.QUARTERSTAFF, quantity: 1 }] },
          { id: "dagger", label: "Daga", items: [{ definitionId: ItemId.DAGGER, quantity: 1 }] },
        ],
      },
      {
        id: "casting_tool",
        title: "Canalizador arcano",
        options: [
          { id: "component_pouch", label: "Bolsa de componentes", items: [{ definitionId: ItemId.COMPONENT_POUCH, quantity: 1 }] },
          { id: "crystal", label: "Cristal arcano", items: [{ definitionId: ItemId.ARCANE_FOCUS_CRYSTAL, quantity: 1 }] },
          { id: "orb", label: "Orbe arcano", items: [{ definitionId: ItemId.ARCANE_FOCUS_ORB, quantity: 1 }] },
          { id: "rod", label: "Vara arcana", items: [{ definitionId: ItemId.ARCANE_FOCUS_ROD, quantity: 1 }] },
          { id: "staff", label: "Báculo arcano", items: [{ definitionId: ItemId.ARCANE_FOCUS_STAFF, quantity: 1 }] },
          { id: "wand", label: "Varita arcana", items: [{ definitionId: ItemId.ARCANE_FOCUS_WAND, quantity: 1 }] },
        ],
      },
    ],
  },
]);

// Pool jugable: se limita a conjuros que ya tienen acción en el juego.
// El spellbook es contenido; al jugar, sólo estos ids habilitan botones de conjuro.
export const WIZARD_SPELLBOOK_OPTIONS = Object.freeze([
  { id: SpellId.MAGIC_MISSILE, name: "Misil mágico", level: 1 },
  { id: SpellId.BURNING_HANDS, name: "Manos ardientes", level: 1 },
  { id: SpellId.SHIELD, name: "Escudo", level: 1 },
  { id: SpellId.FALSE_LIFE, name: "Vida falsa", level: 1 },
  { id: SpellId.EXPEDITIOUS_RETREAT, name: "Retirada expeditiva", level: 1 },
  { id: SpellId.CHROMATIC_ORB, name: "Orbe cromático", level: 1 },
  { id: SpellId.CURE_WOUNDS, name: "Sanar heridas", level: 1, note: "Disponible como regla de prototipo." },
  { id: SpellId.VORTEX_WARP, name: "Vortex Warp", level: 2, note: "Queda inscrito; requiere espacios de nivel 2." },
  { id: SpellId.FIREBALL, name: "Bola de fuego", level: 3, note: "Queda inscrito; requiere espacios de nivel 3." },
  { id: SpellId.COUNTERSPELL, name: "Counterspell", level: 3, note: "Queda inscrito; requiere espacios de nivel 3." },
  { id: SpellId.WALL_OF_FORCE, name: "Muro de fuerza", level: 5, note: "Queda inscrito; requiere espacios de nivel 5." },
]);

export const DEFAULT_CHARACTER_DRAFT = Object.freeze({
  name: "Aster",
  raceId: "human",
  backgroundId: "hermit",
  classId: "wizard",
  equipmentChoices: {
    weapon: "quarterstaff",
    casting_tool: "component_pouch",
  },
  cantrips: [SpellId.FIRE_BOLT, SpellId.DANCING_LIGHTS, SpellId.SHOCKING_GRASP],
  spellbookSpellIds: [
    SpellId.MAGIC_MISSILE,
    SpellId.BURNING_HANDS,
    SpellId.SHIELD,
    SpellId.CHROMATIC_ORB,
    SpellId.CURE_WOUNDS,
    SpellId.VORTEX_WARP,
  ],
});

export function getRaceById(id) {
  return CHARACTER_RACES.find((race) => race.id === id) ?? CHARACTER_RACES[0];
}

export function getBackgroundById(id) {
  return CHARACTER_BACKGROUNDS.find((background) => background.id === id) ?? CHARACTER_BACKGROUNDS[0];
}

export function getClassById(id) {
  return CHARACTER_CLASSES.find((classDefinition) => classDefinition.id === id) ?? CHARACTER_CLASSES[0];
}

export function normalizeCharacterDraft(draft = {}) {
  const safeDraft = draft ?? {};
  const base = structuredCloneSafe(DEFAULT_CHARACTER_DRAFT);
  const normalized = {
    ...base,
    ...safeDraft,
    equipmentChoices: {
      ...base.equipmentChoices,
      ...(safeDraft.equipmentChoices ?? {}),
    },
  };

  const classDefinition = getClassById(normalized.classId);
  const allowedSpellIds = new Set(WIZARD_SPELLBOOK_OPTIONS.map((spell) => spell.id));
  const uniqueSpells = [];

  for (const spellId of normalized.spellbookSpellIds ?? []) {
    if (!allowedSpellIds.has(spellId) || uniqueSpells.includes(spellId)) continue;
    uniqueSpells.push(spellId);
  }

  for (const option of WIZARD_SPELLBOOK_OPTIONS) {
    if (uniqueSpells.length >= classDefinition.spellbookPickCount) break;
    if (!uniqueSpells.includes(option.id)) uniqueSpells.push(option.id);
  }

  normalized.spellbookSpellIds = uniqueSpells.slice(0, classDefinition.spellbookPickCount);
  normalized.cantrips = [...classDefinition.fixedCantrips];
  return normalized;
}

export function getStartingEquipmentEntries(characterData = {}) {
  const draft = normalizeCharacterDraft(characterData);
  const background = getBackgroundById(draft.backgroundId);
  const classDefinition = getClassById(draft.classId);
  const entries = [];

  entries.push(...(background.fixedItems ?? []));
  entries.push(...(classDefinition.fixedItems ?? []));

  for (const choice of classDefinition.equipmentChoices ?? []) {
    const selectedOptionId = draft.equipmentChoices?.[choice.id];
    const selectedOption = choice.options.find((option) => option.id === selectedOptionId) ?? choice.options[0];
    entries.push(...(selectedOption.items ?? []));
  }

  return entries;
}

export function getStartingGold(characterData = {}) {
  const draft = normalizeCharacterDraft(characterData);
  return getBackgroundById(draft.backgroundId).gold ?? 0;
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}
