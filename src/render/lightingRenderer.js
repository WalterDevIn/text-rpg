import { getLightLevelAtTile, isEntityLit } from "../engine/world/lighting.js";

export function getLightingRenderData(entityOrTile) {
  if (entityOrTile && "x" in entityOrTile && "y" in entityOrTile) {
    return { lit: isEntityLit(entityOrTile) };
  }
  return entityOrTile;
}

export { getLightLevelAtTile, isEntityLit };
