import { TILE_SIZE } from "../config/constants.js";
import { worldToTile, tileKey, hasLineOfSight, findPath } from "../engine/world/pathfinding.js";

export function tileToWorldCenter(col, row) {
  return {
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function pointToTileKey(point) {
  const tile = worldToTile(point);
  return tileKey(tile.row, tile.col);
}

export { worldToTile, tileKey, hasLineOfSight, findPath };
