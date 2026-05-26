import { updateMerchants, merchants, getMerchantBlockers, spawnMerchantForRoom } from "../../content/creatures/merchant.js";

export function updateInteractionSystem(dt) {
  updateMerchants(dt);
}

export { updateMerchants, merchants, getMerchantBlockers, spawnMerchantForRoom };
export * from "../../content/creatures/merchant.js";
