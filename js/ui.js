import {
  TILE_SIZE,
  FEET_PER_TILE,
  RUN_SPEED_MULTIPLIER,
} from "./constants.js";

import { keys } from "./input.js";
import { player } from "./player.js";
import { enemies } from "./enemy.js";
import { merchants } from "./merchant.js";
import { gameState, GameMode, ActionType, EnemyState } from "./state.js";
import { projectiles } from "./projectiles.js";
import { getItemDefinition } from "./items.js";

let output = null;
let input = null;
let enter = null;

export function setupUi({ outputElement, inputElement, enterButton }) {
  output = outputElement;
  input = inputElement;
  enter = enterButton;

  injectRpgOutputStyles();

  output.classList.add("rpg-output-panel");
  output.style.whiteSpace = "normal";
  output.style.fontFamily = "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  output.style.fontSize = "13px";
  output.style.lineHeight = "1.25";

  enter.addEventListener("click", submitInput);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      submitInput();
    }
  });
}

export function updateHud() {
  if (!output) {
    return;
  }

  output.innerHTML = buildRpgOutputHtml();
}

function buildRpgOutputHtml() {
  const visibleEnemies = enemies.filter((enemy) => enemy.hp > 0 && enemy.state !== EnemyState.DEAD).length;
  const hiredAllies = merchants.filter((merchant) => merchant.hp > 0 && merchant.isHired).length;
  const activeProjectiles = projectiles.length;

  return [
    `<section class="rpg-output-section rpg-output-debug">`,
    `<div class="rpg-output-title">Juego / debugging</div>`,
    `<div class="rpg-output-grid">`,
    statLine("Modo", getModeText()),
    statLine("Tiempo", formatTime(gameState.elapsedTime)),
    statLine("Mensaje", gameState.message || "—"),
    statLine("Posición", `col ${(player.x / TILE_SIZE).toFixed(1)}, fila ${(player.y / TILE_SIZE).toFixed(1)}`),
    statLine("Velocidad", keys.run ? "corriendo" : "normal"),
    statLine("Proyectiles", activeProjectiles),
    statLine("Amenazas", visibleEnemies),
    statLine("Aliadas", hiredAllies),
    `</div>`,
    `</section>`,

    `<section class="rpg-output-section rpg-output-character">`,
    `<div class="rpg-output-title">Personaje</div>`,
    `<div class="rpg-output-name">${escapeHtml(player.name)}</div>`,
    renderBar({
      label: "Puntos de golpe",
      current: player.hp,
      max: player.maxHp,
      className: "hp",
    }),
    `<div class="rpg-output-grid">`,
    statLine("Oro", `${player.gold} po`),
    statLine("Ataque CD", `${player.attackCooldown.toFixed(1)}s`),
    statLine("Conjuro CD", `${player.spellCooldown.toFixed(1)}s`),
    statLine("Casteando", getCastingText()),
    statLine("Escudo", player.shieldRemaining > 0 ? `${player.shieldRemaining.toFixed(1)}s` : "no"),
    statLine("Detener tiempo", gameState.timeStopRemaining > 0 ? `${gameState.timeStopRemaining.toFixed(1)}s` : "no"),
    `</div>`,
    `</section>`,

    `<section class="rpg-output-section rpg-output-spells">`,
    `<div class="rpg-output-title">Espacios de conjuro · mago nivel 20</div>`,
    renderSpellSlotBars(),
    `</section>`,

    `<section class="rpg-output-section rpg-output-inventory">`,
    `<div class="rpg-output-title">Inventario</div>`,
    `<div class="rpg-output-inventory-text">${escapeHtml(getInventoryText())}</div>`,
    `</section>`,
  ].join("");
}

function statLine(label, value) {
  return `<div class="rpg-output-stat"><span>${escapeHtml(String(label))}</span><strong>${escapeHtml(String(value))}</strong></div>`;
}

function renderSpellSlotBars() {
  const levels = Object.keys(player.spellSlots ?? {})
    .map(Number)
    .sort((a, b) => a - b);

  if (levels.length === 0) {
    return `<div class="rpg-output-muted">Sin espacios de conjuro.</div>`;
  }

  return `<div class="rpg-slot-list">${levels.map((level) => {
    const slot = player.spellSlots[level];
    return renderBar({
      label: `Nivel ${level}`,
      current: slot.remaining,
      max: slot.max,
      className: "spell",
    });
  }).join("")}</div>`;
}

function renderBar({ label, current, max, className }) {
  const safeMax = Math.max(1, Number(max) || 1);
  const safeCurrent = Math.max(0, Math.min(safeMax, Number(current) || 0));
  const percent = (safeCurrent / safeMax) * 100;

  return [
    `<div class="rpg-output-bar-row ${className}">`,
    `<div class="rpg-output-bar-label"><span>${escapeHtml(label)}</span><strong>${safeCurrent}/${safeMax}</strong></div>`,
    `<div class="rpg-output-bar-track"><div class="rpg-output-bar-fill" style="width:${percent.toFixed(2)}%"></div></div>`,
    `</div>`,
  ].join("");
}

function getModeText() {
  if (gameState.mode === GameMode.ACTION_MENU) {
    return "menú detenido";
  }

  if (gameState.timeStopRemaining > 0) {
    return "tiempo detenido para todos menos para ti";
  }

  return "tiempo real";
}

function getInventoryText() {
  if (!player.inventory || player.inventory.length === 0) {
    return "vacío";
  }

  return player.inventory.map((item) => {
    const definition = getItemDefinition(item);
    const quantity = item.quantity > 1 ? ` x${item.quantity}` : "";
    return `${definition?.name ?? item.definitionId}${quantity}`;
  }).join(", ");
}

function getCastingText() {
  if (!player.isCasting) {
    return "no";
  }

  const spellNames = {
    [ActionType.CAST_CURE_WOUNDS]: "Sanar heridas",
    [ActionType.CAST_TIME_STOP]: "Detener el tiempo",
    [ActionType.CAST_MAGIC_MISSILE]: "Misil mágico",
    [ActionType.CAST_BURNING_HANDS]: "Manos ardientes",
    [ActionType.CAST_SHIELD]: "Escudo",
    [ActionType.CAST_WALL_OF_FORCE]: "Muro de fuerza",
    [ActionType.CAST_FIREBALL]: "Bola de fuego",
    [ActionType.CAST_VORTEX_WARP]: "Vortex Warp",
    [ActionType.CAST_COUNTERSPELL]: "Counterspell",
    [ActionType.CAST_FIRE_BOLT]: "Saeta de fuego",
    [ActionType.CAST_CHROMATIC_ORB]: "Orbe cromático",
  };

  const name = spellNames[player.castingSpell] ?? "conjuro";
  return `${name}, ${player.castingRemaining.toFixed(1)}s`;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function injectRpgOutputStyles() {
  if (document.getElementById("rpg-output-style")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "rpg-output-style";
  style.textContent = `
    .rpg-output-panel {
      color: #e8e8e8;
      background: rgba(7, 9, 12, 0.82);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 10px;
      padding: 10px;
      box-sizing: border-box;
      overflow: auto;
    }

    .rpg-output-section {
      padding: 9px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }

    .rpg-output-section:first-child {
      padding-top: 0;
      border-top: 0;
    }

    .rpg-output-title {
      margin-bottom: 7px;
      color: #f3d38b;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      font-size: 11px;
    }

    .rpg-output-name {
      font-size: 15px;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .rpg-output-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 5px;
    }

    .rpg-output-stat {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: baseline;
      min-width: 0;
    }

    .rpg-output-stat span {
      color: #aeb7c2;
      flex: 0 0 auto;
    }

    .rpg-output-stat strong {
      color: #f4f4f4;
      font-weight: 650;
      text-align: right;
      overflow-wrap: anywhere;
    }

    .rpg-output-bar-row {
      margin: 7px 0;
    }

    .rpg-output-bar-label {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 12px;
      color: #d9e0e8;
      margin-bottom: 3px;
    }

    .rpg-output-bar-label strong {
      font-weight: 700;
      color: #ffffff;
    }

    .rpg-output-bar-track {
      height: 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.10);
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.10);
    }

    .rpg-output-bar-fill {
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, #5dff8a, #26b95e);
      transition: width 120ms linear;
    }

    .rpg-output-bar-row.spell .rpg-output-bar-fill {
      background: linear-gradient(90deg, #77c7ff, #477bff);
    }

    .rpg-slot-list {
      display: grid;
      grid-template-columns: 1fr;
      gap: 2px;
    }

    .rpg-output-inventory-text,
    .rpg-output-muted {
      color: #d7d7d7;
      font-size: 12px;
      overflow-wrap: anywhere;
    }
  `;

  document.head.appendChild(style);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function submitInput() {
  const command = input.value.trim().toLowerCase();
  input.value = "";

  if (command === "") return;

  if (command === "ayuda") {
    gameState.message = `Comandos:
ayuda
posicion
velocidad

Movimiento:
WASD físico = movimiento
flechas = movimiento alternativo
shift = correr
mantener f = detener tiempo y abrir acciones

Acciones:
Atacar, Conjurar, Usar objeto, Analizar, Esquivar.

Inventario:
Los objetos del suelo se recogen según su interacción. Las antorchas se toman con click a 5 pies.`;
    return;
  }

  if (command === "posicion") {
    const col = player.x / TILE_SIZE;
    const row = player.y / TILE_SIZE;

    gameState.message = `Posición actual: columna ${col.toFixed(2)}, fila ${row.toFixed(2)}.`;
    return;
  }

  if (command === "velocidad") {
    gameState.message = `Velocidad: caminar 6 casillas cada 6 segundos. Correr ${6 * RUN_SPEED_MULTIPLIER} casillas cada 6 segundos. Una casilla representa ${FEET_PER_TILE} pies.`;
    return;
  }

  gameState.message = `No reconozco el comando: "${command}". Escribe "ayuda".`;
}
