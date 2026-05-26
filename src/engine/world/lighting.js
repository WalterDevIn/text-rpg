import {
  TILE_SIZE,
  TORCH_LIGHT_RADIUS_PIXELS,
} from "../../config/constants.js";

import { getTorches, isSurfaceLayer } from "./map.js";
import * as Chunks from "./chunks.js";
import { getDistance } from "./collision.js";
import { getDancingLights } from "../projectiles/projectileSystem.js";

const SURFACE_AMBIENT_LIGHT = 0.45;

let lightSourcesCache = { time: -1, sources: [] };

export function invalidateLightSourcesCache() {
  lightSourcesCache.time = -1;
}

export function getLightSources() {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();

  // El render pregunta la luz de muchos tiles en el mismo frame. Reconstruir
  // antorchas + chunks + luces danzantes por tile era un multiplicador caro.
  if (now - lightSourcesCache.time < 16) {
    return lightSourcesCache.sources;
  }

  const sources = [
    ...getTorches().map((torch) => ({
      x: torch.x,
      y: torch.y,
      radius: torch.lightRadius ?? TORCH_LIGHT_RADIUS_PIXELS,
      strength: 1,
      kind: "torch",
    })),
    ...getSurfaceTorchSourcesSafe().map((torch) => ({
      x: torch.x,
      y: torch.y,
      radius: TORCH_LIGHT_RADIUS_PIXELS * 0.75,
      strength: 1,
      kind: "surface_entrance_torch",
    })),
    ...getDancingLights().map((light) => ({
      x: light.x,
      y: light.y,
      radius: light.lightRadius,
      strength: light.lightStrength ?? 1,
      kind: "dancing_light",
    })),
  ];

  lightSourcesCache = { time: now, sources };
  return sources;
}

function getSurfaceTorchSourcesSafe() {
  if (typeof Chunks.getGeneratedSurfaceTorchSources === "function") {
    return Chunks.getGeneratedSurfaceTorchSources();
  }

  const sources = [];
  const loadedChunks = typeof Chunks.getLoadedChunks === "function" ? Chunks.getLoadedChunks() : [];
  const torchChar = Chunks.SURFACE_TORCH_CHAR ?? "t";
  const tileSize = TILE_SIZE;

  for (const chunk of loadedChunks) {
    if (!chunk?.surfaceTorchTiles) continue;
    for (const key of chunk.surfaceTorchTiles) {
      const [localColText, localRowText] = String(key).split(",");
      const localCol = Number(localColText);
      const localRow = Number(localRowText);
      if (!Number.isFinite(localCol) || !Number.isFinite(localRow)) continue;
      if (chunk.tiles?.[localRow]?.[localCol] !== torchChar) continue;
      const tileCol = chunk.chunkX * chunk.width + localCol;
      const tileRow = chunk.chunkY * chunk.height + localRow;
      sources.push({
        row: tileRow,
        col: tileCol,
        x: tileCol * tileSize + tileSize / 2,
        y: tileRow * tileSize + tileSize / 2,
      });
    }
  }

  return sources;
}

function isSurfaceRoofedTileSafe(col, row) {
  if (typeof Chunks.isSurfaceRoofedTile === "function") {
    return Chunks.isSurfaceRoofedTile(col, row);
  }
  return false;
}

export function getLightLevelAtPoint(point) {
  const artificial = getArtificialLightLevelAtPoint(point);

  if (isSurfaceLayer()) {
    // El layer 0 se interpreta como bosque diurno: no hay techo sobre las
    // estructuras de entrada, así que siempre existe una luz solar tenue.
    // Las antorchas y Luces danzantes pueden superar este mínimo.
    return Math.max(SURFACE_AMBIENT_LIGHT, artificial);
  }

  return artificial;
}

function getArtificialLightLevelAtPoint(point) {
  let level = 0;

  for (const source of getLightSources()) {
    const dx = point.x - source.x;
    const dy = point.y - source.y;
    const radius = source.radius;
    const distanceSq = dx * dx + dy * dy;

    if (distanceSq > radius * radius) {
      continue;
    }

    const distance = Math.sqrt(distanceSq);
    const normalized = 1 - distance / radius;
    const falloff = normalized * normalized * (3 - 2 * normalized);
    const contribution = Math.max(0, falloff) * source.strength;

    // Composición acumulativa: dos antorchas superpuestas iluminan más que
    // una sola, pero sin saturar de forma brusca.
    level = 1 - (1 - level) * (1 - contribution);

    if (level >= 0.98) {
      return 1;
    }
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
