import { TILE_SIZE } from "../../config/constants.js";
import { isWallAt, isTileInMerchantSafeZone, isSurfaceLayer, mapRows, mapCols } from "./map.js";

const ORTHOGONAL_NEIGHBORS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

const MAX_VISITED_NODES = 1200;

export function worldToTile(point) {
  return {
    row: Math.floor(point.y / TILE_SIZE),
    col: Math.floor(point.x / TILE_SIZE),
  };
}

export function tileToWorldCenter(tile) {
  return {
    x: tile.col * TILE_SIZE + TILE_SIZE / 2,
    y: tile.row * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function findPath(startPoint, goalPoint, options = {}) {
  const start = worldToTile(startPoint);
  const goal = worldToTile(goalPoint);
  const maxVisited = options.maxVisited ?? MAX_VISITED_NODES;

  if (!isInsideMap(start.row, start.col) || !isInsideMap(goal.row, goal.col)) {
    return [];
  }

  if (start.row === goal.row && start.col === goal.col) {
    return [tileToWorldCenter(goal)];
  }

  const startKey = tileKey(start.row, start.col);
  const goalKey = tileKey(goal.row, goal.col);

  const open = [start];
  const cameFrom = new Map();
  const visited = new Set([startKey]);
  let visitedCount = 0;

  while (open.length > 0 && visitedCount < maxVisited) {
    const currentIndex = getBestOpenIndex(open, goal);
    const current = open.splice(currentIndex, 1)[0];
    const currentKey = tileKey(current.row, current.col);
    visitedCount++;

    if (currentKey === goalKey) {
      return reconstructPath(cameFrom, currentKey).map(tileToWorldCenter);
    }

    const neighbors = getSortedNeighbors(current, goal);

    for (const neighbor of neighbors) {
      if (!isInsideMap(neighbor.row, neighbor.col)) {
        continue;
      }

      const neighborKey = tileKey(neighbor.row, neighbor.col);

      if (visited.has(neighborKey)) {
        continue;
      }

      if (options.avoidMerchantSafeZone && isTileInMerchantSafeZone(neighbor.row, neighbor.col)) {
        continue;
      }

      if (neighborKey !== goalKey && isWallAt(neighbor.row, neighbor.col)) {
        continue;
      }

      if (neighborKey === goalKey && isWallAt(neighbor.row, neighbor.col)) {
        continue;
      }

      visited.add(neighborKey);
      cameFrom.set(neighborKey, currentKey);
      open.push(neighbor);
    }
  }

  return [];
}

export function hasLineOfSight(from, to) {
  const distance = Math.hypot(to.x - from.x, to.y - from.y);
  const steps = Math.max(1, Math.ceil(distance / (TILE_SIZE / 4)));

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const y = from.y + (to.y - from.y) * t;
    const row = Math.floor(y / TILE_SIZE);
    const col = Math.floor(x / TILE_SIZE);

    if (isWallAt(row, col)) {
      return false;
    }
  }

  return true;
}

function reconstructPath(cameFrom, goalKey) {
  const keys = [goalKey];
  let current = goalKey;

  while (cameFrom.has(current)) {
    current = cameFrom.get(current);
    keys.push(current);
  }

  keys.reverse();

  // Omit the starting tile: movement wants the next tile center.
  return keys.slice(1).map(keyToTile);
}

function getBestOpenIndex(open, goal) {
  let bestIndex = 0;
  let bestScore = Infinity;

  for (let i = 0; i < open.length; i++) {
    const score = manhattan(open[i], goal);

    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function getSortedNeighbors(tile, goal) {
  return ORTHOGONAL_NEIGHBORS
    .map((offset) => ({ row: tile.row + offset.row, col: tile.col + offset.col }))
    .sort((a, b) => manhattan(a, goal) - manhattan(b, goal));
}

function manhattan(a, b) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
}

export function tileKey(row, col) {
  return `${row},${col}`;
}

export function keyToTile(key) {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

function isInsideMap(row, col) {
  if (isSurfaceLayer()) {
    return Number.isFinite(row) && Number.isFinite(col);
  }

  return row >= 0 && row < mapRows && col >= 0 && col < mapCols;
}
