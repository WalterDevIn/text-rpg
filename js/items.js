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
} from "./constants.js";

export const ItemType = {
  WEAPON: "weapon",
  AMMO: "ammo",
  POTION: "potion",
  SCROLL: "scroll",
};

export const ItemTargeting = {
  NONE: "none",
  ENEMY: "enemy",
  POINT: "point",
};

export const ItemId = {
  DAGGER: "dagger",
  LONGSWORD: "longsword",
  BOW: "bow",
  ARROW: "arrow",
  POTION_OF_HEALING: "potion_of_healing",
  SCROLL_MISTY_STEP: "scroll_misty_step",
  SCROLL_DISINTEGRATE: "scroll_disintegrate",
  SCROLL_FORCECAGE: "scroll_forcecage",
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
