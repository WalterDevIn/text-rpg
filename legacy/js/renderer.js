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
} from "./constants.js";

import {
  getTemporaryWalls,
  getTorches,
  getVisibleTileKeysForPlayer,
  isEntityVisibleToPlayer,
  map,
  mapRows,
  mapCols,
} from "./map.js";
import { player } from "./player.js";
import { enemies } from "./enemy.js";
import { gameState } from "./state.js";
import { projectiles } from "./projectiles.js";
import { chests, groundItems } from "./inventory.js";
import { merchants } from "./merchant.js";
import { getPortraitImage, hasPortraitAttempt } from "./portraits.js";
import { getLightLevelAtTile, isEntityLit } from "./lighting.js";

const VIEWPORT_COLS = 25;
const VIEWPORT_ROWS = 17;

let canvas = null;
let ctx = null;

export function setupRenderer(canvasElement) {
  canvas = canvasElement;
  ctx = canvas.getContext("2d");

  const fixedWidth = VIEWPORT_COLS * TILE_SIZE;
  const fixedHeight = VIEWPORT_ROWS * TILE_SIZE;

  canvas.width = fixedWidth;
  canvas.height = fixedHeight;

  // El zoom del juego debe ser constante. Bloqueamos también el tamaño CSS
  // para que el navegador no reescale el canvas cuando la región visible
  // cambia de una sala amplia a un pasillo angosto.
  canvas.style.width = `${fixedWidth}px`;
  canvas.style.height = `${fixedHeight}px`;
  canvas.style.maxWidth = "none";
  canvas.style.maxHeight = "none";

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

export function getCameraOffset() {
  if (!canvas) {
    return { x: 0, y: 0 };
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#050505";
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

  drawEntity(player);
  drawPlayerActionIndicators();

  if (player.shieldRemaining > 0) {
    drawShieldBarrier();
  }

  if (gameState.timeStopRemaining > 0) {
    drawTimeStopOverlay();
  }

  drawInfoPanel();
}


function drawFixedViewportGrid() {
  const camera = getCameraOffset();
  const firstCol = Math.floor(camera.x / TILE_SIZE);
  const firstRow = Math.floor(camera.y / TILE_SIZE);
  const lastCol = firstCol + VIEWPORT_COLS + 1;
  const lastRow = firstRow + VIEWPORT_ROWS + 1;

  ctx.fillStyle = "#050505";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let row = firstRow; row <= lastRow; row++) {
    for (let col = firstCol; col <= lastCol; col++) {
      const screen = worldToScreen({ x: col * TILE_SIZE, y: row * TILE_SIZE });

      if (screen.x < -TILE_SIZE || screen.y < -TILE_SIZE || screen.x > canvas.width || screen.y > canvas.height) {
        continue;
      }

      ctx.fillStyle = "#070707";
      ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
      drawTileBox(screen.x, screen.y, "#151515");
    }
  }
}

function drawMap() {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const visibleTiles = getVisibleTileKeysForPlayer(player);

  for (const key of visibleTiles) {
    const [row, col] = key.split(",").map(Number);

    if (row < 0 || row >= mapRows || col < 0 || col >= mapCols) {
      continue;
    }

    const char = map[row][col];
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

    const tileShade = Math.floor(20 + lightLevel * 30);
    ctx.fillStyle = `rgb(${tileShade}, ${tileShade}, ${tileShade})`;
    ctx.fillRect(screen.x, screen.y, TILE_SIZE, TILE_SIZE);
    drawTileBox(screen.x, screen.y, lightLevel > 0.5 ? "#333" : "#181818");

    if (char !== ".") {
      const intensity = Math.floor(135 + lightLevel * 120);
      drawCharAtScreen(char, screen.x, screen.y, `rgb(${intensity}, ${intensity}, ${intensity})`);
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
      progress: 1 - enemy.actionWindupRemaining / ENEMY_ACTION_CAST_TIME,
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
