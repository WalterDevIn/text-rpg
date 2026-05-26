import { updateItemPickup, useSelectedInventoryItem, spawnRandomLootForRoom, chests, groundItems } from "../../content/items/inventory.js";

export function updateInventorySystem() {
  updateItemPickup();
}

export { updateItemPickup, useSelectedInventoryItem, spawnRandomLootForRoom, chests, groundItems };
export * from "../../content/items/inventory.js";
