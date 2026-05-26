import { draw } from "./renderer.js";
import { map, mapCols, mapRows } from "../engine/world/map.js";

export function getMapRenderSource() {
  return { map, mapCols, mapRows };
}

export function renderMap() {
  // Renderer still owns the canvas draw order; this module exposes the map layer boundary.
  return draw();
}
