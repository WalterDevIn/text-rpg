import { getInventoryItems, getUsableInventoryItems } from "../../content/items/inventory.js";

export function getInventoryUiModel() {
  return {
    items: getInventoryItems(),
    usableItems: getUsableInventoryItems(),
  };
}

export { getInventoryItems, getUsableInventoryItems };
