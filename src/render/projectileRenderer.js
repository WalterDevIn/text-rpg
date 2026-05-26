import { draw } from "./renderer.js";
import { getProjectileRenderData } from "../engine/projectiles/projectileRenderingData.js";

export function getProjectileRenderSource() {
  return getProjectileRenderData();
}

export function renderProjectiles() {
  return draw();
}
