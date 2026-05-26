import { getItemDefinition, ItemId, ItemType, ItemTargeting } from "../content/items/items.js";

export function getConfiguredItemDefinition(itemOrId) {
  return getItemDefinition(itemOrId);
}

export { getItemDefinition, ItemId, ItemType, ItemTargeting };
