import { getTileRule, blocksMovement, blocksVision, blocksProjectiles, allowsDoorPeek } from "./tileRules.js";

export function describeTile(tileId) {
  return getTileRule(tileId);
}

export function getTileCollisionProfile(tileId) {
  return {
    blocksMovement: blocksMovement(tileId),
    blocksVision: blocksVision(tileId),
    blocksProjectiles: blocksProjectiles(tileId),
    allowsDoorPeek: allowsDoorPeek(tileId),
  };
}

export { getTileRule, blocksMovement, blocksVision, blocksProjectiles, allowsDoorPeek };
