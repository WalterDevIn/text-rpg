import {
  PLAYER_LIGHT_RADIUS_PIXELS,
  TILE_SIZE,
  TORCH_LIGHT_RADIUS_PIXELS,
} from "./constants.js";

import { player } from "./player.js";
import { getTorches } from "./map.js";
import { getDistance } from "./physics.js";

export function getLightSources() {
  return [
    {
      x: player.x,
      y: player.y,
      radius: PLAYER_LIGHT_RADIUS_PIXELS,
      strength: 0.85,
      kind: "player",
    },
    ...getTorches().map((torch) => ({
      x: torch.x,
      y: torch.y,
      radius: torch.lightRadius ?? TORCH_LIGHT_RADIUS_PIXELS,
      strength: 1,
      kind: "torch",
    })),
  ];
}

export function getLightLevelAtPoint(point) {
  let level = 0;

  for (const source of getLightSources()) {
    const distance = getDistance(point, source);

    if (distance > source.radius) {
      continue;
    }

    const normalized = 1 - distance / source.radius;
    const contribution = Math.max(0, normalized) * source.strength;
    level = Math.max(level, contribution);
  }

  return Math.min(1, level);
}

export function getLightLevelAtTile(row, col) {
  return getLightLevelAtPoint({
    x: col * TILE_SIZE + TILE_SIZE / 2,
    y: row * TILE_SIZE + TILE_SIZE / 2,
  });
}

export function isTileLit(row, col, threshold = 0.08) {
  return getLightLevelAtTile(row, col) >= threshold;
}

export function isEntityLit(entity, threshold = 0.08) {
  return getLightLevelAtPoint(entity) >= threshold;
}
