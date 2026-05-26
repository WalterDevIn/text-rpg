import {
  ATTACK_RANGE_FEET,
  ATTACK_RANGE_PIXELS,
  BOW_ATTACK_RANGE_FEET,
  BOW_ATTACK_RANGE_PIXELS,
  DISINTEGRATE_SCROLL_RANGE_FEET,
  DISINTEGRATE_SCROLL_RANGE_PIXELS,
  FORCECAGE_SCROLL_RANGE_FEET,
  FORCECAGE_SCROLL_RANGE_PIXELS,
  MISTY_STEP_RANGE_FEET,
  MISTY_STEP_RANGE_PIXELS,
  POTION_OF_HEALING_BONUS,
  POTION_OF_HEALING_DICE,
  POTION_OF_HEALING_DIE,
  TILE_SIZE,
  TORCH_PLACE_RANGE_FEET,
  TORCH_PLACE_RANGE_PIXELS,
} from "../../config/constants.js";
import { listSpellDefinitions } from "../spells/spellDefinitions.js";

export const ItemType = {
  WEAPON: "weapon",
  AMMO: "ammo",
  POTION: "potion",
  SCROLL: "scroll",
  GEAR: "gear",
  FOCUS: "focus",
  SPELLBOOK: "spellbook",
};

export const ItemTargeting = {
  NONE: "none",
  ENEMY: "enemy",
  POINT: "point",
};

export const ItemId = {
  DAGGER: "dagger",
  QUARTERSTAFF: "quarterstaff",
  LONGSWORD: "longsword",
  BOW: "bow",
  ARROW: "arrow",
  COMPONENT_POUCH: "component_pouch",
  ARCANE_FOCUS_CRYSTAL: "arcane_focus_crystal",
  ARCANE_FOCUS_ORB: "arcane_focus_orb",
  ARCANE_FOCUS_ROD: "arcane_focus_rod",
  ARCANE_FOCUS_STAFF: "arcane_focus_staff",
  ARCANE_FOCUS_WAND: "arcane_focus_wand",
  PLAYER_SPELLBOOK: "player_spellbook",
  SCROLL_CASE: "scroll_case",
  NOTES_FROM_SECLUSION: "notes_from_seclusion",
  WINTER_BLANKET: "winter_blanket",
  COMMON_CLOTHES: "common_clothes",
  HERBALISM_KIT: "herbalism_kit",
  POTION_OF_HEALING: "potion_of_healing",
  SCROLL_MISTY_STEP: "scroll_misty_step",
  SCROLL_DISINTEGRATE: "scroll_disintegrate",
  SCROLL_FORCECAGE: "scroll_forcecage",
  SCROLL_SPELL_CURE_WOUNDS: "scroll_spell_cure_wounds",
  SCROLL_SPELL_TIME_STOP: "scroll_spell_time_stop",
  SCROLL_SPELL_MAGIC_MISSILE: "scroll_spell_magic_missile",
  SCROLL_SPELL_BURNING_HANDS: "scroll_spell_burning_hands",
  SCROLL_SPELL_SHIELD: "scroll_spell_shield",
  SCROLL_SPELL_WALL_OF_FORCE: "scroll_spell_wall_of_force",
  SCROLL_SPELL_FIREBALL: "scroll_spell_fireball",
  SCROLL_SPELL_VORTEX_WARP: "scroll_spell_vortex_warp",
  SCROLL_SPELL_COUNTERSPELL: "scroll_spell_counterspell",
  SCROLL_SPELL_FIRE_BOLT: "scroll_spell_fire_bolt",
  SCROLL_SPELL_CHROMATIC_ORB: "scroll_spell_chromatic_orb",
  MERCHANT_DRESS: "merchant_dress",
  MERCHANT_BOOTS: "merchant_boots",
  MERCHANT_BRACERS: "merchant_bracers",
  MERCHANT_NECKLACE: "merchant_necklace",
  MERCHANT_CAP: "merchant_cap",
  MERCHANT_STAFF: "merchant_staff",
  BAG_OF_HOLDING: "bag_of_holding",
  MERCHANT_SPELLBOOK: "merchant_spellbook",
  MERCHANT_GOLD: "merchant_gold",
  TORCH: "torch",
};


export function getSpellScrollItemId(spellId) {
  return `scroll_spell_${spellId}`;
}

export function getAllSpellScrollItemIds() {
  return listSpellDefinitions().map((spell) => getSpellScrollItemId(spell.id));
}

function mapSpellTargetingToItemTargeting(spell) {
  if (["enemy", "casting_enemy", "enemy_touch"].includes(spell.targeting)) return ItemTargeting.ENEMY;
  if (["point", "fireball_point", "chromatic_orb_point", "dancing_lights_point", "direction", "fire_bolt_direction", "creature_then_point"].includes(spell.targeting)) return ItemTargeting.POINT;
  if (spell.targeting === "creature") return "creature";
  return ItemTargeting.NONE;
}

function makeSpellScrollDefinition(spell) {
  const itemId = getSpellScrollItemId(spell.id);
  const levelLabel = spell.level === 0 ? "truco" : `nivel ${spell.level}`;

  return {
    id: itemId,
    type: ItemType.SCROLL,
    name: `Pergamino de ${spell.name}`,
    char: "?",
    color: spell.level >= 5 ? "#cc99ff" : spell.level >= 3 ? "#88ccff" : "#d6c29a",
    description: `Pergamino arcano de ${spell.name} (${levelLabel}). Se consume al usarse.`,
    targeting: mapSpellTargetingToItemTargeting(spell),
    spellTargeting: spell.targeting,
    spellId: spell.id,
    actionType: spell.actionType,
    rangeFeet: spell.rangeFeet ?? 0,
    rangePixels: ((spell.rangeFeet ?? 0) / 5) * TILE_SIZE,
    consumable: true,
  };
}

const SPELL_SCROLL_DEFINITIONS = Object.fromEntries(
  listSpellDefinitions().map((spell) => [getSpellScrollItemId(spell.id), makeSpellScrollDefinition(spell)])
);

export const ITEM_DEFINITIONS = {
  [ItemId.DAGGER]: {
    id: ItemId.DAGGER,
    type: ItemType.WEAPON,
    name: "Daga",
    char: ")",
    color: "#dddddd",
    description: `Arma cuerpo a cuerpo. Alcance ${ATTACK_RANGE_FEET} pies. Daño 1d4 perforante.`,
    attackVerb: "apuñalas",
    rangeFeet: ATTACK_RANGE_FEET,
    rangePixels: ATTACK_RANGE_PIXELS,
    damageDice: 1,
    damageDie: 4,
    damageBonus: 0,
  },
  [ItemId.QUARTERSTAFF]: {
    id: ItemId.QUARTERSTAFF,
    type: ItemType.WEAPON,
    name: "Bastón",
    char: "/",
    color: "#c9974d",
    description: `Arma cuerpo a cuerpo. Alcance ${ATTACK_RANGE_FEET} pies. Daño 1d6 contundente.`,
    attackVerb: "golpeas",
    rangeFeet: ATTACK_RANGE_FEET,
    rangePixels: ATTACK_RANGE_PIXELS,
    damageDice: 1,
    damageDie: 6,
    damageBonus: 0,
  },
  [ItemId.LONGSWORD]: {
    id: ItemId.LONGSWORD,
    type: ItemType.WEAPON,
    name: "Espada larga",
    char: ")",
    color: "#f0f0f0",
    description: `Arma cuerpo a cuerpo. Alcance ${ATTACK_RANGE_FEET} pies. Daño 1d8 cortante.`,
    attackVerb: "cortas",
    rangeFeet: ATTACK_RANGE_FEET,
    rangePixels: ATTACK_RANGE_PIXELS,
    damageDice: 1,
    damageDie: 8,
    damageBonus: 0,
  },
  [ItemId.BOW]: {
    id: ItemId.BOW,
    type: ItemType.WEAPON,
    name: "Arco",
    char: ")",
    color: "#c9974d",
    description: `Arma a distancia. Alcance ${BOW_ATTACK_RANGE_FEET} pies. Daño 1d6 perforante.`,
    attackVerb: "disparas una flecha contra",
    rangeFeet: BOW_ATTACK_RANGE_FEET,
    rangePixels: BOW_ATTACK_RANGE_PIXELS,
    damageDice: 1,
    damageDie: 6,
    damageBonus: 0,
    ranged: true,
  },
  [ItemId.ARROW]: {
    id: ItemId.ARROW,
    type: ItemType.AMMO,
    name: "Flecha",
    char: "x",
    color: "#d8c27a",
    description: "Munición para arco. Si falla y se clava en una pared, puede recuperarse.",
    consumable: true,
  },
  [ItemId.COMPONENT_POUCH]: {
    id: ItemId.COMPONENT_POUCH,
    type: ItemType.FOCUS,
    name: "Bolsa de componentes",
    char: "u",
    color: "#b58a55",
    description: "Bolsa con componentes materiales comunes para conjuros arcanos.",
  },
  [ItemId.ARCANE_FOCUS_CRYSTAL]: {
    id: ItemId.ARCANE_FOCUS_CRYSTAL,
    type: ItemType.FOCUS,
    name: "Cristal arcano",
    char: "*",
    color: "#88ccff",
    description: "Foco arcano cristalino.",
  },
  [ItemId.ARCANE_FOCUS_ORB]: {
    id: ItemId.ARCANE_FOCUS_ORB,
    type: ItemType.FOCUS,
    name: "Orbe arcano",
    char: "o",
    color: "#88aaff",
    description: "Foco arcano esférico.",
  },
  [ItemId.ARCANE_FOCUS_ROD]: {
    id: ItemId.ARCANE_FOCUS_ROD,
    type: ItemType.FOCUS,
    name: "Vara arcana",
    char: "|",
    color: "#cc99ff",
    description: "Foco arcano en forma de vara.",
  },
  [ItemId.ARCANE_FOCUS_STAFF]: {
    id: ItemId.ARCANE_FOCUS_STAFF,
    type: ItemType.FOCUS,
    name: "Báculo arcano",
    char: "/",
    color: "#aa88ff",
    description: "Foco arcano largo, usado para canalizar conjuros.",
  },
  [ItemId.ARCANE_FOCUS_WAND]: {
    id: ItemId.ARCANE_FOCUS_WAND,
    type: ItemType.FOCUS,
    name: "Varita arcana",
    char: "'",
    color: "#ddaaff",
    description: "Foco arcano pequeño y preciso.",
  },
  [ItemId.PLAYER_SPELLBOOK]: {
    id: ItemId.PLAYER_SPELLBOOK,
    type: ItemType.SPELLBOOK,
    name: "Libro de conjuros",
    char: "&",
    color: "#77aaff",
    description: "Libro donde están inscritos los conjuros iniciales del mago.",
  },
  [ItemId.SCROLL_CASE]: {
    id: ItemId.SCROLL_CASE,
    type: ItemType.GEAR,
    name: "Estuche de pergaminos",
    char: "[",
    color: "#d6c29a",
    description: "Estuche con notas del periodo de reclusión del ermitaño.",
  },
  [ItemId.NOTES_FROM_SECLUSION]: {
    id: ItemId.NOTES_FROM_SECLUSION,
    type: ItemType.GEAR,
    name: "Notas de reclusión",
    char: "=",
    color: "#eeeecc",
    description: "Notas personales, descubrimientos y fragmentos de estudio.",
  },
  [ItemId.WINTER_BLANKET]: {
    id: ItemId.WINTER_BLANKET,
    type: ItemType.GEAR,
    name: "Manta de invierno",
    char: "~",
    color: "#bbbbdd",
    description: "Manta gruesa para descansar en condiciones duras.",
  },
  [ItemId.COMMON_CLOTHES]: {
    id: ItemId.COMMON_CLOTHES,
    type: ItemType.GEAR,
    name: "Ropa común",
    char: "v",
    color: "#dddddd",
    description: "Ropa común de viajero.",
  },
  [ItemId.HERBALISM_KIT]: {
    id: ItemId.HERBALISM_KIT,
    type: ItemType.GEAR,
    name: "Kit de herboristería",
    char: "+",
    color: "#77cc77",
    description: "Herramientas para recolectar, preparar y reconocer hierbas.",
  },

  [ItemId.POTION_OF_HEALING]: {
    id: ItemId.POTION_OF_HEALING,
    type: ItemType.POTION,
    name: "Poción de vida",
    char: "!",
    color: "#ff5555",
    description: `Recupera ${POTION_OF_HEALING_DICE}d${POTION_OF_HEALING_DIE}+${POTION_OF_HEALING_BONUS} PG.`,
    targeting: ItemTargeting.NONE,
    consumable: true,
  },
  [ItemId.SCROLL_MISTY_STEP]: {
    id: ItemId.SCROLL_MISTY_STEP,
    type: ItemType.SCROLL,
    name: "Pergamino de Paso brumoso",
    char: "?",
    color: "#99ddff",
    description: `Teletransporte a un punto visible hasta ${MISTY_STEP_RANGE_FEET} pies.`,
    targeting: ItemTargeting.POINT,
    rangeFeet: MISTY_STEP_RANGE_FEET,
    rangePixels: MISTY_STEP_RANGE_PIXELS,
    consumable: true,
  },
  [ItemId.SCROLL_DISINTEGRATE]: {
    id: ItemId.SCROLL_DISINTEGRATE,
    type: ItemType.SCROLL,
    name: "Pergamino de Desintegrar",
    char: "?",
    color: "#66ff99",
    description: `Rayo a ${DISINTEGRATE_SCROLL_RANGE_FEET} pies. Daño 10d6+40 de fuerza.`,
    targeting: ItemTargeting.ENEMY,
    rangeFeet: DISINTEGRATE_SCROLL_RANGE_FEET,
    rangePixels: DISINTEGRATE_SCROLL_RANGE_PIXELS,
    damageDice: 10,
    damageDie: 6,
    damageBonus: 40,
    consumable: true,
  },

  [ItemId.MERCHANT_DRESS]: {
    id: ItemId.MERCHANT_DRESS,
    type: ItemType.AMMO,
    name: "Vestido de maga",
    char: "v",
    color: "#d6a3ff",
    description: "Vestido personal de la vendedora arcana. No es mercancía.",
  },
  [ItemId.MERCHANT_BOOTS]: {
    id: ItemId.MERCHANT_BOOTS,
    type: ItemType.AMMO,
    name: "Botas de maga",
    char: "b",
    color: "#b98cff",
    description: "Botas personales de la vendedora arcana. No son mercancía.",
  },
  [ItemId.MERCHANT_BRACERS]: {
    id: ItemId.MERCHANT_BRACERS,
    type: ItemType.AMMO,
    name: "Brazalera de maga",
    char: "{",
    color: "#caa6ff",
    description: "Una de las dos brazaleras personales de la vendedora arcana.",
  },
  [ItemId.MERCHANT_NECKLACE]: {
    id: ItemId.MERCHANT_NECKLACE,
    type: ItemType.AMMO,
    name: "Collar arcano",
    char: "o",
    color: "#ffdd99",
    description: "Collar personal de la vendedora arcana. No es mercancía.",
  },
  [ItemId.MERCHANT_CAP]: {
    id: ItemId.MERCHANT_CAP,
    type: ItemType.AMMO,
    name: "Gorra de maga",
    char: "^",
    color: "#d6a3ff",
    description: "Gorra personal de la vendedora arcana. No es mercancía.",
  },
  [ItemId.MERCHANT_STAFF]: {
    id: ItemId.MERCHANT_STAFF,
    type: ItemType.AMMO,
    name: "Báculo de maga",
    char: "/",
    color: "#c9974d",
    description: "Báculo personal de la vendedora arcana. No es mercancía.",
  },

  [ItemId.BAG_OF_HOLDING]: {
    id: ItemId.BAG_OF_HOLDING,
    type: ItemType.AMMO,
    name: "Bolsa de vacío",
    char: "U",
    color: "#8866ff",
    description: "Bolsa de vacío de la vendedora. Dentro guarda pergaminos, oro y su libro de conjuros.",
  },
  [ItemId.MERCHANT_SPELLBOOK]: {
    id: ItemId.MERCHANT_SPELLBOOK,
    type: ItemType.AMMO,
    name: "Libro de conjuros de maga",
    char: "&",
    color: "#77aaff",
    description: "Libro de conjuros personal de la vendedora arcana. Forma parte de su inventario verdadero.",
  },
  [ItemId.MERCHANT_GOLD]: {
    id: ItemId.MERCHANT_GOLD,
    type: ItemType.AMMO,
    name: "Oro de la vendedora",
    char: "$",
    color: "#ffdd55",
    description: "Reserva de oro guardada dentro de la bolsa de vacío de la vendedora.",
  },
  [ItemId.TORCH]: {
    id: ItemId.TORCH,
    type: ItemType.POTION,
    name: "Antorcha",
    char: "t",
    color: "#ffaa33",
    description: `Fuente de luz portátil. Usarla permite colocarla a ${TORCH_PLACE_RANGE_FEET} pies en la dirección elegida.`,
    targeting: ItemTargeting.POINT,
    rangeFeet: TORCH_PLACE_RANGE_FEET,
    rangePixels: TORCH_PLACE_RANGE_PIXELS,
    consumable: true,
  },

  ...SPELL_SCROLL_DEFINITIONS,

  [ItemId.SCROLL_FORCECAGE]: {
    id: ItemId.SCROLL_FORCECAGE,
    type: ItemType.SCROLL,
    name: "Pergamino de Forcecage",
    char: "?",
    color: "#cc99ff",
    description: `Crea una jaula de fuerza temporal hasta ${FORCECAGE_SCROLL_RANGE_FEET} pies.`,
    targeting: ItemTargeting.POINT,
    rangeFeet: FORCECAGE_SCROLL_RANGE_FEET,
    rangePixels: FORCECAGE_SCROLL_RANGE_PIXELS,
    consumable: true,
  },
};

let nextInventoryInstanceId = 1;
let nextGroundItemId = 1;

export function createInventoryItem(definitionId, quantity = 1) {
  const definition = ITEM_DEFINITIONS[definitionId];

  if (!definition) {
    throw new Error(`Definición de item desconocida: ${definitionId}`);
  }

  return {
    instanceId: nextInventoryInstanceId++,
    definitionId,
    quantity,
  };
}

export function createGroundItem(definitionId, x, y, quantity = 1) {
  const definition = ITEM_DEFINITIONS[definitionId];

  if (!definition) {
    throw new Error(`Definición de item desconocida: ${definitionId}`);
  }

  return {
    id: nextGroundItemId++,
    definitionId,
    quantity,
    x,
    y,
    radius: TILE_SIZE * 0.28,
    char: definition.char,
    color: definition.color,
  };
}

export function getItemDefinition(itemOrDefinitionId) {
  if (!itemOrDefinitionId) return null;

  if (typeof itemOrDefinitionId === "string") {
    return ITEM_DEFINITIONS[itemOrDefinitionId] ?? null;
  }

  return ITEM_DEFINITIONS[itemOrDefinitionId.definitionId] ?? null;
}
