import { draw } from "./renderer.js";
import { player } from "../content/creatures/player.js";
import { enemies } from "../content/creatures/enemy.js";
import { merchants } from "../content/creatures/merchant.js";
import { companions } from "../content/companions/companions.js";

export function getEntityRenderSource() {
  return { player, enemies, merchants, companions };
}

export function renderEntities() {
  return draw();
}
