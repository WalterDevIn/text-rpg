import {
  TILE_SIZE,
  FONT_SIZE,
  FONT_FAMILY,
  PLAYER_ATTACK_COOLDOWN,
  SPELL_CAST_TIME,
  SPELL_COOLDOWN,
  ENEMY_ATTACK_COOLDOWN,
  ENEMY_ACTION_CAST_TIME,
  ENEMY_SPELL_COOLDOWN,
} from "../config/constants.js";

import {
  getTemporaryWalls,
  getTorches,
  getVisibleTileKeysForPlayer,
  isEntityVisibleToPlayer,
  getTileAt,
  isSurfaceLayer,
  mapRows,
  mapCols,
  getCurrentFloor,
  getCurrentLayerId,
  getCurrentLayerName,
  getCurrentLayerSeed,
  getDungeonSeed,
  getCurrentDungeonEntranceKey,
  getRooms,
  SURFACE_TREE_CHAR,
  DUNGEON_WALL_CHAR,
  DUNGEON_DOOR_CHAR,
  DUNGEON_FLOOR_CHAR,
  DUNGEON_STAIRS_CHAR,
  DUNGEON_STAIRS_UP_CHAR,
} from "../engine/world/map.js";
import { player } from "../content/creatures/player.js";
import { enemies } from "../content/creatures/enemy.js";
import { gameState } from "../engine/state/gameState.js";
import { projectiles } from "../engine/projectiles/projectileSystem.js";
import { chests, groundItems } from "../content/items/inventory.js";
import { merchants } from "../content/creatures/merchant.js";
import { companions } from "../content/companions/companions.js";
import { getPortraitImage, hasPortraitAttempt } from "../ui/hud/portraits.js";
import { getLightLevelAtTile, getLightSources, isEntityLit } from "../engine/world/lighting.js";

const VIEWPORT_COLS = 25;
const VIEWPORT_ROWS = 17;

let canvas = null;
let ctx = null;

export function setupRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext("2d");

  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.maxWidth = "none";
  canvas.style.maxHeight = "none";

  resizeCanvasToDisplaySize();
  window.addEventListener("resize", resizeCanvasToDisplaySize);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

function resizeCanvasToDisplaySize() {
  if (!canvas || !ctx) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const width = Math.max(TILE_SIZE * 8, Math.floor(rect.width || window.innerWidth || VIEWPORT_COLS * TILE_SIZE));
  const height = Math.max(TILE_SIZE * 8, Math.floor(rect.height || window.innerHeight || VIEWPORT_ROWS * TILE_SIZE));

  if (canvas.width === width && canvas.height === height) {
    return;
  }

  canvas.width = width;
  canvas.height = height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

export function getCameraOffset() {
  if (!canvas) {
    return { x: 0, y: 0 };
  }

  if (isSurfaceLayer()) {
    return {
      x: player.x - canvas.width / 2,
      y: player.y - canvas.height / 2,
    };
  }

  const maxX = mapCols * TILE_SIZE - canvas.width;
  const maxY = mapRows * TILE_SIZE - canvas.height;

  return {
    x: clamp(player.x - canvas.width / 2, 0, Math.max(0, maxX)),
    y: clamp(player.y - canvas.height / 2, 0, Math.max(0, maxY)),
  };
}

export function worldToScreen(point) {
  const camera = getCameraOffset();

  return {
    x: point.x - camera.x,
    y: point.y - camera.y,
  };
}

export function screenToWorld(point) {
  const camera = getCameraOffset();

  return {
    x: point.x + camera.x,
    y: point.y + camera.y,
  };
}

export function draw() {
  resizeCanvasToDisplaySize();

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = isSurfaceLayer() ? "#10210f" : "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawFixedViewportGrid();
  drawMap();
  drawTemporaryWalls();
  drawTorches();

  for (const chest of chests) {
    if (isEntityVisibleToPlayer(chest, player) && isEntityLit(chest)) {
      drawEntity(chest);
    }
  }

  for (const item of groundItems) {
    if (isEntityVisibleToPlayer(item, player) && isEntityLit(item)) {
      drawEntity(item);
    }
  }

  for (const merchant of merchants) {
    if (isEntityVisibleToPlayer(merchant, player) && isEntityLit(merchant)) {
      drawEntity(merchant);
      if (merchant.isHired) {
        drawEnemyActionIndicators(merchant);
      }
    }
  }

  for (const companion of companions) {
    if (isEntityVisibleToPlayer(companion, player) && isEntityLit(companion)) {
      drawEntity(companion);
      drawEnemyActionIndicators(companion);
    }
  }

  for (const enemy of enemies) {
    if (isEntityVisibleToPlayer(enemy, player) && isEntityLit(enemy)) {
      drawEnemy(enemy);
      drawEnemyActionIndicators(enemy);
    }
  }

  for (const projectile of projectiles) {
    if (projectile.delay > 0 || !isEntityVisibleToPlayer(projectile, player) || !isEntityLit(projectile, 0.02)) {
      continue;
    }

    drawEntity(projectile);
  }

  if (isEntityVisibleToPlayer(player, player) && isEntityLit(player)) {
    drawEntity(player);
    drawPlayerActionIndicators();

    if (player.shieldRemaining > 0) {
      drawShieldBarrier();
    }
  }

  drawSmoothLightingOverlay();

  if (gameState.timeStopRemaining > 0) {
    drawTimeStopOverlay();
  }

  drawPlayerHud();
  drawMinimap();
  drawLayerDebugBadge();
  drawInfoPanel();
}


function drawFixedViewportGrid() {
  const camera = getCameraOffset();
  const firstCol = Math.floor(camera.x / TILE_SIZE);
  const firstRow = Math.floor(camera.y / TILE_SIZE);
  const lastCol = firstCol + Math.ceil(canvas.width / TILE_SIZE) + 1;
  const lastRow = firstRow + Math.ceil(canvas.height / TILE_SIZE) + 1;

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const screen = worldToScreen({ x: col * TILE_SIZE, y: row * TILE_SIZE });

      if (screen.x < -TILE_SIZE || screen.y < -TILE_SIZE || screen.x > canvas.width || screen.y > canvas.height) {
        continue;
      }

      if (!isSurfaceLayer()) {
        ctx.fillStyle = "#070707";
        ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
        drawTileBox(screen.x, screen.y, "#151515");
      }
    }
  }
}

function drawMap() {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const visibleTiles = getVisibleTileKeysForPlayer(player);
  markExploredTiles(visibleTiles);

  for (const key of visibleTiles) {
    const [row, col] = key.split(",").map(Number);

    if (!isSurfaceLayer() && (row < 0 || row >= mapRows || col < 0 || col >= mapCols)) {
      continue;
    }

    const char = getTileAt(row, col);
    const screen = worldToScreen({ x: col * TILE_SIZE, y: row * TILE_SIZE });

    if (screen.x < -TILE_SIZE || screen.y < -TILE_SIZE || screen.x > canvas.width || screen.y > canvas.height) {
      continue;
    }

    const lightLevel = getLightLevelAtTile(row, col);

    if (lightLevel <= 0.04) {
      ctx.fillStyle = "#030303";
      ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
      drawTileBox(screen.x, screen.y, "#0b0b0b");
      continue;
    }

    if (isSurfaceLayer()) {
      // La iluminación visual ahora se resuelve con un overlay suave.
      // Evitamos teñir cada tile por separado para que no aparezcan
      // bordes cuadrados de luz.
      drawSurfaceTile(char, screen.x, screen.y, 1);
      continue;
    }

    ctx.fillStyle = "#202020";
    ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
    drawTileBox(screen.x, screen.y, "#1a1a1a");

    if (char !== ".") {
      drawCharAtScreen(char, screen.x, screen.y, "#d8d8d8");
    }
  }
}

function drawTorches() {
  for (const torch of getTorches()) {
    if (!isEntityVisibleToPlayer(torch, player) || !isEntityLit(torch, 0.01)) {
      continue;
    }

    const screen = worldToScreen({ x: torch.x, y: torch.y });

    ctx.beginPath();
    ctx.arc(screen.x, screen.y, TILE_SIZE * 0.58, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 160, 40, 0.16)";
    ctx.fill();

    drawEntity(torch);
  }
}

function drawTemporaryWalls() {
  for (const wall of getTemporaryWalls()) {
    const visibleTiles = getVisibleTileKeysForPlayer(player);

    if (!visibleTiles.has(`${wall.row},${wall.col}`)) {
      continue;
    }

    const screen = worldToScreen({ x: wall.col * TILE_SIZE, y: wall.row * TILE_SIZE });

    ctx.fillStyle = "rgba(255, 221, 0, 0.18)";
    ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
    drawCharAtScreen("#", screen.x, screen.y, "#ffdd00");
  }
}


function drawSurfaceTile(char, x, y, lightLevel = 1) {
  if (char === SURFACE_TREE_CHAR) {
    drawCharAtScreen(char, x, y, applyLightToHex("#8a4f25", lightLevel));
    return;
  }

  if (char === DUNGEON_WALL_CHAR) {
    drawCharAtScreen(char, x, y, applyLightToHex("#9a9a9a", lightLevel));
    return;
  }

  if (char === "t") {
    drawCharAtScreen(char, x, y, applyLightToHex("#ffaa33", lightLevel));
    return;
  }

  if (char === DUNGEON_STAIRS_CHAR || char === DUNGEON_STAIRS_UP_CHAR) {
    drawCharAtScreen(char, x, y, applyLightToHex("#e7d59a", lightLevel));
  }
}

function applyLightToHex(hex, lightLevel = 1) {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const factor = Math.max(0.12, Math.min(1, lightLevel));
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`;
}

function drawTileBox(x, y, color = "#222") {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}


function drawEnemy(enemy) {
  drawEntity(enemy);
}

function drawEntity(entity) {
  const size = entity.drawSize ?? TILE_SIZE;
  const screen = worldToScreen({ x: entity.x, y: entity.y });
  const tileX = screen.x - size / 2;
  const tileY = screen.y - size / 2;

  if (Number.isFinite(entity.spinAngle)) {
    drawRotatedCharAtScreen(entity.char, tileX, tileY, entity.color, size, entity.spinAngle);
    return;
  }

  drawCharAtScreen(entity.char, tileX, tileY, entity.color, size);
}

function drawCharAtScreen(char, screenX, screenY, color, size = TILE_SIZE) {
  const previousFont = ctx.font;

  if (size !== TILE_SIZE) {
    ctx.font = `${FONT_SIZE * (size / TILE_SIZE)}px ${FONT_FAMILY}`;
  }

  ctx.fillStyle = color;
  ctx.fillText(char, screenX + size / 2, screenY + size / 2);
  ctx.font = previousFont;
}

function drawRotatedCharAtScreen(char, screenX, screenY, color, size = TILE_SIZE, angle = 0) {
  const previousFont = ctx.font;
  const centerX = screenX + size / 2;
  const centerY = screenY + size / 2;

  if (size !== TILE_SIZE) {
    ctx.font = `${FONT_SIZE * (size / TILE_SIZE)}px ${FONT_FAMILY}`;
  }

  ctx.save();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillText(char, 0, 0);
  ctx.restore();
  ctx.font = previousFont;
}

function drawEnemyActionIndicators(enemy) {
  if (enemy.hp <= 0 || enemy.state === "dead") {
    return;
  }

  const screen = worldToScreen({ x: enemy.x, y: enemy.y });

  if (enemy.actionWindupType && enemy.actionWindupRemaining > 0) {
    drawProgressRing({
      x: screen.x,
      y: screen.y,
      radius: enemy.radius + 6,
      progress: 1 - enemy.actionWindupRemaining / (enemy.actionWindupDuration ?? ENEMY_ACTION_CAST_TIME),
      baseColor: "rgba(255, 40, 40, 0.18)",
      progressColor: "#ff3333",
      lineWidth: 3,
      startAngle: -Math.PI / 2,
    });
  }

  if (enemy.attackCooldown > 0) {
    drawProgressRing({
      x: screen.x,
      y: screen.y,
      radius: enemy.radius + 9,
      progress: 1 - enemy.attackCooldown / ENEMY_ATTACK_COOLDOWN,
      baseColor: "rgba(255, 0, 0, 0.16)",
      progressColor: "#ff3333",
      lineWidth: 2,
      startAngle: -Math.PI / 2,
    });
  }

  if (enemy.canCastMagicMissile && enemy.spellCooldown > 0) {
    drawProgressRing({
      x: screen.x,
      y: screen.y,
      radius: enemy.radius + 13,
      progress: 1 - enemy.spellCooldown / ENEMY_SPELL_COOLDOWN,
      baseColor: "rgba(255, 0, 0, 0.12)",
      progressColor: "#ff66aa",
      lineWidth: 2,
      startAngle: Math.PI / 2,
    });
  }
}

function drawPlayerActionIndicators() {
  const screen = worldToScreen({ x: player.x, y: player.y });

  if (player.isCasting) {
    const progress = 1 - player.castingRemaining / SPELL_CAST_TIME;
    drawProgressRing({
      x: screen.x,
      y: screen.y,
      radius: player.radius + 18,
      progress,
      baseColor: "rgba(170, 120, 255, 0.22)",
      progressColor: "#aa78ff",
      lineWidth: 4,
      startAngle: -Math.PI / 2,
    });
  }

  if (player.attackCooldown > 0) {
    drawProgressRing({
      x: screen.x,
      y: screen.y,
      radius: player.radius + 23,
      progress: 1 - player.attackCooldown / PLAYER_ATTACK_COOLDOWN,
      baseColor: "rgba(255, 120, 70, 0.18)",
      progressColor: "#ff7846",
      lineWidth: 3,
      startAngle: -Math.PI / 2,
    });
  }

  if (player.spellCooldown > 0) {
    drawProgressRing({
      x: screen.x,
      y: screen.y,
      radius: player.radius + 28,
      progress: 1 - player.spellCooldown / SPELL_COOLDOWN,
      baseColor: "rgba(80, 170, 255, 0.18)",
      progressColor: "#50aaff",
      lineWidth: 3,
      startAngle: Math.PI / 2,
    });
  }
}

function drawProgressRing({ x, y, radius, progress, baseColor, progressColor, lineWidth, startAngle }) {
  const clampedProgress = clamp(progress, 0, 1);

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.strokeStyle = baseColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, radius, startAngle, startAngle + Math.PI * 2 * clampedProgress);
  ctx.strokeStyle = progressColor;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.lineCap = "butt";
}

function drawShieldBarrier() {
  const screen = worldToScreen({ x: player.x, y: player.y });

  ctx.beginPath();
  ctx.arc(screen.x, screen.y, player.radius + 9, 0, Math.PI * 2);
  ctx.strokeStyle = "#66ccff";
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(screen.x, screen.y, player.radius + 13, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(102, 204, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();
}


function drawSmoothLightingOverlay() {
  // Capa estética: las reglas siguen usando iluminación por tile, pero el
  // acabado visual se hace con halos radiales acumulativos. Esto evita el
  // aspecto cuadriculado sin cambiar colisiones, visión ni targeting.
  if (!canvas || !ctx) {
    return;
  }

  const baseDarkness = isSurfaceLayer() ? 0.42 : 0.92;
  ctx.save();

  // Primero agregamos un brillo cromático muy sutil. No revela nada por sí
  // mismo; sólo da temperatura visual a antorchas y luces mágicas.
  ctx.globalCompositeOperation = "screen";
  for (const light of getLightSources()) {
    const screen = worldToScreen({ x: light.x, y: light.y });
    const radius = Math.max(TILE_SIZE * 1.5, light.radius ?? TILE_SIZE * 6);

    if (screen.x + radius < 0 || screen.y + radius < 0 || screen.x - radius > canvas.width || screen.y - radius > canvas.height) {
      continue;
    }

    const glow = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
    if (light.kind === "dancing_light") {
      glow.addColorStop(0, `rgba(120, 185, 255, ${0.10 * (light.strength ?? 1)})`);
      glow.addColorStop(0.55, `rgba(80, 130, 255, ${0.045 * (light.strength ?? 1)})`);
    } else {
      glow.addColorStop(0, `rgba(255, 170, 72, ${0.12 * (light.strength ?? 1)})`);
      glow.addColorStop(0.55, `rgba(255, 120, 36, ${0.045 * (light.strength ?? 1)})`);
    }
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  // Luego oscurecemos todo el mundo y abrimos agujeros suaves. Cuando dos
  // fuentes se superponen, destination-out acumula el aclarado de forma
  // natural sin necesitar pintar casillas individuales.
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = `rgba(0, 0, 0, ${baseDarkness})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.globalCompositeOperation = "destination-out";
  for (const light of getLightSources()) {
    const screen = worldToScreen({ x: light.x, y: light.y });
    const radius = Math.max(TILE_SIZE * 1.5, light.radius ?? TILE_SIZE * 6);

    if (screen.x + radius < 0 || screen.y + radius < 0 || screen.x - radius > canvas.width || screen.y - radius > canvas.height) {
      continue;
    }

    const strength = Math.max(0, Math.min(1, light.strength ?? 1));
    const clear = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, radius);
    clear.addColorStop(0, `rgba(0, 0, 0, ${0.92 * strength})`);
    clear.addColorStop(0.42, `rgba(0, 0, 0, ${0.62 * strength})`);
    clear.addColorStop(0.78, `rgba(0, 0, 0, ${0.22 * strength})`);
    clear.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = clear;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawPlayerHud() {
  const margin = 16;
  const panelWidth = Math.min(300, Math.max(218, canvas.width * 0.24));
  const x = canvas.width - panelWidth - margin;
  const y = margin;
  const padding = 12;
  const healthHeight = 20;
  const spellHeight = 62;
  const gap = 9;
  const panelHeight = padding * 2 + healthHeight + gap + spellHeight;

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "rgba(3, 7, 14, 0.72)";
  roundedRect(x, y, panelWidth, panelHeight, 12);
  ctx.fill();

  ctx.shadowBlur = 0;
  const glow = ctx.createLinearGradient(x, y, x + panelWidth, y + panelHeight);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.30)");
  glow.addColorStop(0.35, "rgba(110, 180, 255, 0.18)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0.06)");
  ctx.strokeStyle = glow;
  ctx.lineWidth = 1;
  roundedRect(x + 0.5, y + 0.5, panelWidth - 1, panelHeight - 1, 12);
  ctx.stroke();

  drawHealthUnits({
    x: x + padding,
    y: y + padding,
    width: panelWidth - padding * 2,
    height: healthHeight,
  });

  drawSpellSlotOnion({
    x: x + padding,
    y: y + padding + healthHeight + gap,
    width: panelWidth - padding * 2,
    height: spellHeight,
  });

  ctx.restore();
}

function drawHealthUnits({ x, y, width, height }) {
  const maxHp = Math.max(1, Math.floor(player.maxHp ?? 1));
  const hp = clamp(Math.floor(player.hp ?? 0), 0, maxHp);
  const temporaryHp = Math.max(0, Math.floor(player.temporaryHp ?? 0));
  const gap = maxHp > 95 ? 0 : 1;
  const unitWidth = Math.max(1, Math.min(5, (width - gap * Math.max(0, maxHp - 1)) / maxHp));
  const totalWidth = maxHp * unitWidth + gap * Math.max(0, maxHp - 1);
  const startX = x + Math.max(0, width - totalWidth);
  const radius = Math.min(5, height / 2);

  ctx.fillStyle = "rgba(55, 8, 12, 0.76)";
  roundedRect(startX - 2, y - 2, totalWidth + 4, height + 4, radius + 2);
  ctx.fill();

  for (let i = 0; i < maxHp; i++) {
    const unitX = startX + i * (unitWidth + gap);
    const alive = i < hp;

    if (alive) {
      const grd = ctx.createLinearGradient(unitX, y, unitX, y + height);
      grd.addColorStop(0, "#ff6a6a");
      grd.addColorStop(0.52, "#df2f3c");
      grd.addColorStop(1, "#7b111c");
      ctx.fillStyle = grd;
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    }

    roundedRect(unitX, y, Math.max(1, unitWidth), height, Math.min(2, unitWidth / 2));
    ctx.fill();
  }

  if (temporaryHp > 0) {
    const tempUnits = Math.min(temporaryHp, Math.max(1, maxHp));
    const tempUnitWidth = Math.max(1, Math.min(5, unitWidth));
    const tempTotalWidth = tempUnits * tempUnitWidth + gap * Math.max(0, tempUnits - 1);
    const tempStartX = startX + Math.max(0, totalWidth - tempTotalWidth);
    const tempY = y + height + 3;
    for (let i = 0; i < tempUnits; i++) {
      const unitX = tempStartX + i * (tempUnitWidth + gap);
      const grd = ctx.createLinearGradient(unitX, tempY, unitX, tempY + Math.max(2, height * 0.35));
      grd.addColorStop(0, "#8bd8ff");
      grd.addColorStop(1, "#1e6cff");
      ctx.fillStyle = grd;
      roundedRect(unitX, tempY, tempUnitWidth, Math.max(2, height * 0.35), Math.min(2, tempUnitWidth / 2));
      ctx.fill();
    }
  }

  ctx.strokeStyle = "rgba(255, 220, 220, 0.26)";
  ctx.lineWidth = 1;
  roundedRect(startX - 2.5, y - 2.5, totalWidth + 5, height + 5, radius + 2);
  ctx.stroke();
}

function drawSpellSlotOnion({ x, y, width, height }) {
  const slots = normalizeSpellSlots(player.spellSlots);
  if (slots.length === 0) {
    return;
  }

  const maxSlots = Math.max(...slots.map((slot) => slot.max), 1);
  const maxLevel = Math.max(...slots.map((slot) => slot.level), 1);
  const baseSquare = Math.max(8, Math.min(15, Math.floor((width - Math.max(0, maxSlots - 1) * 3) / maxSlots)));
  const gap = Math.max(2, Math.floor(baseSquare * 0.22));
  const baseHeight = Math.min(18, Math.max(11, baseSquare));
  const originX = x + width - (maxSlots * baseSquare + Math.max(0, maxSlots - 1) * gap);
  const originY = y + height / 2 - baseHeight / 2;

  ctx.fillStyle = "rgba(6, 15, 32, 0.64)";
  roundedRect(originX - 5, originY - 7, maxSlots * baseSquare + Math.max(0, maxSlots - 1) * gap + 10, baseHeight + 14, 9);
  ctx.fill();

  for (const slot of slots) {
    const levelIndex = slot.level - 1;
    const t = maxLevel <= 1 ? 0 : levelIndex / (maxLevel - 1);
    const cellHeight = Math.max(5, baseHeight - levelIndex * 1.25);
    const cellWidth = baseSquare;
    const layerY = originY + baseHeight / 2 - cellHeight / 2;
    const alpha = Math.max(0.48, 0.92 - t * 0.34);
    const activeTop = Math.max(72, 120 - levelIndex * 5);
    const activeBottom = Math.max(125, 230 - levelIndex * 8);

    for (let i = 0; i < slot.max; i++) {
      const cellX = originX + i * (cellWidth + gap);
      const active = i < slot.remaining;
      const r = Math.min(4, cellHeight / 2);

      ctx.shadowColor = active ? `rgba(60, 150, 255, ${0.16 + alpha * 0.12})` : "transparent";
      ctx.shadowBlur = active ? 7 : 0;

      if (active) {
        const grd = ctx.createLinearGradient(cellX, layerY, cellX, layerY + cellHeight);
        grd.addColorStop(0, `rgba(${activeTop}, ${activeTop + 58}, 255, ${alpha})`);
        grd.addColorStop(0.52, `rgba(35, 116, ${activeBottom}, ${alpha})`);
        grd.addColorStop(1, `rgba(8, 39, ${Math.max(90, activeBottom - 70)}, ${alpha})`);
        ctx.fillStyle = grd;
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.075)";
      }

      roundedRect(cellX, layerY, cellWidth, cellHeight, r);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = active
        ? `rgba(205, 230, 255, ${0.28 + alpha * 0.22})`
        : "rgba(255, 255, 255, 0.10)";
      ctx.lineWidth = 1;
      roundedRect(cellX + 0.5, layerY + 0.5, cellWidth - 1, cellHeight - 1, Math.max(1, r - 0.5));
      ctx.stroke();
    }
  }

  ctx.shadowBlur = 0;
}

function normalizeSpellSlots(spellSlots) {
  return Object.entries(spellSlots ?? {})
    .map(([level, slot]) => ({
      level: Number(level),
      max: Math.max(0, Number(slot?.max ?? 0)),
      remaining: Math.max(0, Number(slot?.remaining ?? 0)),
    }))
    .filter((slot) => Number.isFinite(slot.level) && slot.level > 0 && slot.max > 0)
    .sort((a, b) => a.level - b.level);
}


function markExploredTiles(visibleTiles) {
  if (!visibleTiles || visibleTiles.size === 0) {
    return;
  }

  const layerId = getCurrentLayerId();
  if (!gameState.exploredTilesByLayer) {
    gameState.exploredTilesByLayer = {};
  }

  const current = gameState.exploredTilesByLayer[layerId];
  const explored = current instanceof Set ? current : new Set(Array.isArray(current) ? current : []);

  for (const key of visibleTiles) {
    explored.add(key);
  }

  gameState.exploredTilesByLayer[layerId] = explored;
}

function getExploredTilesForCurrentLayer() {
  const layerId = getCurrentLayerId();
  const store = gameState.exploredTilesByLayer ?? {};
  const current = store[layerId];

  if (current instanceof Set) {
    return current;
  }

  if (Array.isArray(current)) {
    const restored = new Set(current);
    store[layerId] = restored;
    gameState.exploredTilesByLayer = store;
    return restored;
  }

  return new Set();
}

function drawMinimap() {
  const explored = getExploredTilesForCurrentLayer();
  if (explored.size === 0) {
    return;
  }

  const margin = 16;
  const size = Math.min(196, Math.max(142, Math.floor(Math.min(canvas.width, canvas.height) * 0.24)));
  const x = margin;
  const y = margin;
  const padding = 8;
  const inner = size - padding * 2;
  const playerRow = Math.floor(player.y / TILE_SIZE);
  const playerCol = Math.floor(player.x / TILE_SIZE);

  const tileScale = isSurfaceLayer()
    ? 3
    : Math.max(1, Math.floor(inner / Math.max(mapRows, mapCols)));

  const surfaceRadius = Math.floor(inner / tileScale / 2);
  const originRow = isSurfaceLayer() ? playerRow - surfaceRadius : 0;
  const originCol = isSurfaceLayer() ? playerCol - surfaceRadius : 0;
  const maxRows = isSurfaceLayer() ? surfaceRadius * 2 + 1 : mapRows;
  const maxCols = isSurfaceLayer() ? surfaceRadius * 2 + 1 : mapCols;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.68)";
  roundedRect(x, y, size, size, 10);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
  ctx.lineWidth = 1;
  roundedRect(x + 0.5, y + 0.5, size - 1, size - 1, 10);
  ctx.stroke();

  ctx.beginPath();
  roundedRect(x + padding, y + padding, inner, inner, 6);
  ctx.clip();

  ctx.fillStyle = "rgba(3, 5, 8, 0.88)";
  ctx.fillRect(x + padding, y + padding, inner, inner);

  for (let r = 0; r < maxRows; r++) {
    for (let c = 0; c < maxCols; c++) {
      const row = originRow + r;
      const col = originCol + c;
      const key = `${row},${col}`;

      if (!explored.has(key)) {
        continue;
      }

      const tileX = x + padding + c * tileScale;
      const tileY = y + padding + r * tileScale;

      if (tileX < x + padding || tileY < y + padding || tileX >= x + padding + inner || tileY >= y + padding + inner) {
        continue;
      }

      ctx.fillStyle = getMinimapTileColor(getTileAt(row, col));
      ctx.fillRect(tileX, tileY, Math.max(1, tileScale), Math.max(1, tileScale));
    }
  }

  drawMinimapEntityMarker(player.x, player.y, originRow, originCol, tileScale, x + padding, y + padding, inner, "#00ff66", 2);

  for (const enemy of enemies) {
    if (enemy.hp <= 0 || enemy.state === "dead") continue;
    const color = enemy.kind === "carmelita_boss" ? "#ff3030" : enemy.kind === "dragon_boss" ? "#ff7846" : "#bb5555";
    drawMinimapEntityMarker(enemy.x, enemy.y, originRow, originCol, tileScale, x + padding, y + padding, inner, color, enemy.kind === "carmelita_boss" ? 2 : 1);
  }

  for (const merchant of merchants) {
    drawMinimapEntityMarker(merchant.x, merchant.y, originRow, originCol, tileScale, x + padding, y + padding, inner, "#66aaff", 1);
  }

  for (const companion of companions) {
    if (companion.hp <= 0 || companion.state === "dead") continue;
    drawMinimapEntityMarker(companion.x, companion.y, originRow, originCol, tileScale, x + padding, y + padding, inner, "#e6c15c", 1);
  }

  ctx.restore();
}

function getMinimapTileColor(char) {
  if (char === DUNGEON_WALL_CHAR) return "#6f6f6f";
  if (char === DUNGEON_DOOR_CHAR) return "#a97842";
  if (char === DUNGEON_STAIRS_CHAR || char === DUNGEON_STAIRS_UP_CHAR) return "#d8c27a";
  if (char === SURFACE_TREE_CHAR) return "#7b4b22";
  if (char === DUNGEON_FLOOR_CHAR) return isSurfaceLayer() ? "#1d331a" : "#292929";
  return "#242424";
}

function drawMinimapEntityMarker(worldX, worldY, originRow, originCol, tileScale, mapX, mapY, inner, color, radius = 1) {
  const row = Math.floor(worldY / TILE_SIZE);
  const col = Math.floor(worldX / TILE_SIZE);
  const localCol = col - originCol;
  const localRow = row - originRow;
  const px = mapX + localCol * tileScale + tileScale / 2;
  const py = mapY + localRow * tileScale + tileScale / 2;

  if (px < mapX || py < mapY || px > mapX + inner || py > mapY + inner) {
    return;
  }

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(px, py, Math.max(radius, tileScale * 0.85), 0, Math.PI * 2);
  ctx.fill();
}

function drawLayerDebugBadge() {
  const margin = 16;
  const minimapSize = Math.min(196, Math.max(142, Math.floor(Math.min(canvas.width, canvas.height) * 0.24)));
  const x = margin;
  const y = margin + minimapSize + 8;
  const width = 300;
  const lineHeight = 15;
  const padding = 8;
  const lines = getLayerDebugLines();
  const height = padding * 2 + Math.max(1, lines.length) * lineHeight;

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.70)";
  roundedRect(x, y, width, height, 8);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
  ctx.lineWidth = 1;
  roundedRect(x + 0.5, y + 0.5, width - 1, height - 1, 8);
  ctx.stroke();

  ctx.font = `12px ${FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#7fdbff";
  ctx.fillText("D", x + padding, y + padding);

  ctx.fillStyle = "#d8dde8";
  for (let i = 0; i < lines.length; i++) {
    drawClippedText(lines[i], x + padding + 18, y + padding + i * lineHeight, width - padding * 2 - 18);
  }

  ctx.restore();
}

function getLayerDebugLines() {
  const floor = getCurrentFloor();
  const boss = getCurrentBossDebugName();
  const roomCount = getRooms().filter((room) => room.generatedFromTable).length;
  const exploredCount = getExploredTilesForCurrentLayer().size;
  const seed = String(getDungeonSeed() ?? "").slice(0, 18);
  const layerSeed = String(getCurrentLayerSeed() ?? "");

  return [
    `${getCurrentLayerName()} | ${getCurrentLayerId()}`,
    `Boss: ${boss}`,
    `Salas: ${isSurfaceLayer() ? "—" : roomCount} | Exploradas: ${exploredCount}`,
    `Entrada: ${getCurrentDungeonEntranceKey()} | Seed: ${seed}`,
    `LayerSeed: ${layerSeed.slice(-28)}`,
  ];
}

function getCurrentBossDebugName() {
  if (isSurfaceLayer()) {
    return "—";
  }

  const livingBoss = enemies.find((enemy) => enemy.hp > 0 && enemy.state !== "dead" && (enemy.kind === "carmelita_boss" || enemy.kind === "dragon_boss"));
  if (livingBoss?.kind === "carmelita_boss") return "Carmelita";
  if (livingBoss?.kind === "dragon_boss") return "Dragón";

  const hasBossRoom = getRooms().some((room) => room.bossRoom);
  if (hasBossRoom) return "Carmelita";

  return "pendiente";
}

function drawInfoPanel() {
  if (!gameState.infoMessage) {
    return;
  }

  const lines = gameState.infoMessage.split("\n").slice(0, 8);
  const padding = 10;
  const lineHeight = 17;
  const portraitKey = gameState.infoPortraitKey;
  const portraitSize = portraitKey ? 92 : 0;
  const portraitGap = portraitKey ? 12 : 0;
  const textWidth = 430;
  const panelWidth = Math.min(canvas.width - 24, padding * 2 + portraitSize + portraitGap + textWidth);
  const textXOffset = padding + portraitSize + portraitGap;
  const textAvailableWidth = panelWidth - textXOffset - padding;
  const panelHeight = Math.max(
    padding * 2 + lines.length * lineHeight,
    portraitKey ? padding * 2 + portraitSize : 0
  );
  const x = 12;
  const y = canvas.height - panelHeight - 12;

  ctx.fillStyle = "rgba(0, 0, 0, 0.78)";
  ctx.fillRect(x, y, panelWidth, panelHeight);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, panelWidth, panelHeight);

  if (portraitKey) {
    drawInfoPortrait(portraitKey, x + padding, y + padding, portraitSize);
  }

  ctx.font = `13px ${FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#eeeeee";

  for (let i = 0; i < lines.length; i++) {
    drawClippedText(lines[i], x + textXOffset, y + padding + i * lineHeight, textAvailableWidth);
  }
}

function drawInfoPortrait(portraitKey, x, y, size) {
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, size, size);

  const image = getPortraitImage(portraitKey);

  if (image) {
    drawImageCover(image, x, y, size, size);
    return;
  }

  ctx.font = `11px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = hasPortraitAttempt(portraitKey) ? "#aaaaaa" : "#777777";
  ctx.fillText("sin portrait", x + size / 2, y + size / 2);
}

function drawImageCover(image, x, y, width, height) {
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceX = 0;
  let sourceY = 0;
  let sourceWidth = image.width;
  let sourceHeight = image.height;

  if (imageRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }

  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawClippedText(text, x, y, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }

  let clipped = text;

  while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }

  ctx.fillText(`${clipped}…`, x, y);
}

function drawTimeStopOverlay() {
  ctx.font = `18px ${FONT_FAMILY}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#7fdbff";
  ctx.fillText(
    `TIEMPO DETENIDO: ${gameState.timeStopRemaining.toFixed(1)}s`,
    canvas.width - 16,
    16
  );
}


function roundedRect(x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
