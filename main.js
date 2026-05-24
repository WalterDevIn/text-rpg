const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const output = document.getElementById("rpg-output");
const input = document.getElementById("rpg-input");
const enter = document.getElementById("rpg-input-enter");

const TILE_SIZE = 32;
const FONT_SIZE = 24;
const FONT_FAMILY = "monospace";

const FEET_PER_TILE = 5;

const WALK_SPEED_CELLS_PER_SECOND = 1;
const RUN_SPEED_MULTIPLIER = 2;

const WALK_SPEED = TILE_SIZE * WALK_SPEED_CELLS_PER_SECOND;
const RUN_SPEED = WALK_SPEED * RUN_SPEED_MULTIPLIER;

const ENEMY_SPEED = TILE_SIZE * 0.75;
const ENEMY_FLEE_SPEED = TILE_SIZE * 1.15;

const ATTACK_RANGE_FEET = 5;
const ATTACK_RANGE_PIXELS = (ATTACK_RANGE_FEET / FEET_PER_TILE) * TILE_SIZE;

const PLAYER_ATTACK_DAMAGE = 3;
const ENEMY_ATTACK_DAMAGE = 2;

const PLAYER_ATTACK_COOLDOWN = 3;
const ENEMY_ATTACK_COOLDOWN = 3;

const SPELL_CAST_TIME = 3;
const SPELL_COOLDOWN = 3;

const ENEMY_DETECTION_RANGE_TILES = 6;
const ENEMY_DETECTION_RANGE_PIXELS = ENEMY_DETECTION_RANGE_TILES * TILE_SIZE;

const ENEMY_LOW_HP_PERCENT = 0.35;

const EnemyState = {
  IDLE: "idle",
  CHASE: "chase",
  ATTACK: "attack",
  FLEE: "flee",
  DEAD: "dead",
};

const GameMode = {
  REAL_TIME: "real_time",
  ACTION_MENU: "action_menu",
};

const ActionType = {
  ATTACK: "attack",
  CAST_CURE_WOUNDS: "cast_cure_wounds",
  CAST_TIME_STOP: "cast_time_stop",
};

const keys = {
  left: false,
  up: false,
  right: false,
  down: false,
  run: false,
  action: false,
};

const map = [
  "############################",
  "#............#.............#",
  "#............#.............#",
  "#............#.............#",
  "#..........................#",
  "#......######..............#",
  "#..........................#",
  "#............#######.......#",
  "#..........................#",
  "#.................#........#",
  "#.................#........#",
  "#.....####........#........#",
  "#.................#........#",
  "#.................#........#",
  "############################",
];

const mapRows = map.length;
const mapCols = map[0].length;

canvas.width = mapCols * TILE_SIZE;
canvas.height = mapRows * TILE_SIZE;

const player = {
  x: TILE_SIZE * 2.5,
  y: TILE_SIZE * 2.5,
  radius: TILE_SIZE * 0.35,
  char: "@",
  color: "#00ff66",
  hp: 20,
  maxHp: 20,
  attackCooldown: 0,
  spellCooldown: 0,
  isCasting: false,
  castingSpell: null,
  castingRemaining: 0,
};

const enemies = [
  {
    id: 1,
    name: "Enemigo 1",
    x: TILE_SIZE * 8.5,
    y: TILE_SIZE * 4.5,
    radius: TILE_SIZE * 0.35,
    char: "g",
    color: "#ff4444",
    hp: 10,
    maxHp: 10,
    attackCooldown: 0,
    state: EnemyState.IDLE,
  },
];

let gameMode = GameMode.REAL_TIME;
let lastTime = performance.now();

let message = "Mantén F para detener el tiempo y elegir una acción.";

let selectedAction = null;
let selectedTargetId = null;

let timeStopRemaining = 0;

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (key === "a") keys.left = true;
  if (key === "w") keys.up = true;
  if (key === "s") keys.right = true;
  if (key === "r") keys.down = true;

  if (event.key === "Shift") keys.run = true;

  if (key === "f" && !keys.action) {
    keys.action = true;
    openActionMenu();
  }

  if (gameMode === GameMode.ACTION_MENU) {
    handleActionMenuKey(key);
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (key === "a") keys.left = false;
  if (key === "w") keys.up = false;
  if (key === "s") keys.right = false;
  if (key === "r") keys.down = false;

  if (event.key === "Shift") keys.run = false;

  if (key === "f") {
    keys.action = false;
    closeActionMenuAndExecute();
  }
});

enter.addEventListener("click", submitInput);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    submitInput();
  }
});

function gameLoop(currentTime) {
  const deltaTime = (currentTime - lastTime) / 1000;
  lastTime = currentTime;

  if (gameMode === GameMode.REAL_TIME) {
    update(deltaTime);
  }

  draw();
  updateHud();

  requestAnimationFrame(gameLoop);
}

function update(deltaTime) {
  updatePlayerCooldowns(deltaTime);

  if (timeStopRemaining > 0) {
    timeStopRemaining = Math.max(0, timeStopRemaining - deltaTime);
  }

  if (player.hp > 0) {
    updatePlayerMovement(deltaTime);
    updatePlayerCasting(deltaTime);
  }

  if (timeStopRemaining > 0) {
    return;
  }

  updateEnemyCooldowns(deltaTime);

  for (const enemy of enemies) {
    updateEnemy(enemy, deltaTime);
  }
}

function updatePlayerCooldowns(deltaTime) {
  player.attackCooldown = Math.max(0, player.attackCooldown - deltaTime);
  player.spellCooldown = Math.max(0, player.spellCooldown - deltaTime);
}

function updateEnemyCooldowns(deltaTime) {
  for (const enemy of enemies) {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - deltaTime);
  }
}

function updatePlayerCasting(deltaTime) {
  if (!player.isCasting) {
    return;
  }

  player.castingRemaining = Math.max(0, player.castingRemaining - deltaTime);

  if (player.castingRemaining > 0) {
    return;
  }

  resolveSpell(player.castingSpell);

  player.isCasting = false;
  player.castingSpell = null;
  player.castingRemaining = 0;
}

function updatePlayerMovement(deltaTime) {
  const movement = getPlayerMovementVector();

  if (movement.x === 0 && movement.y === 0) {
    return;
  }

  const speed = keys.run ? RUN_SPEED : WALK_SPEED;

  const nextX = player.x + movement.x * speed * deltaTime;
  const nextY = player.y + movement.y * speed * deltaTime;

  moveEntityWithCollision(player, nextX, nextY);
}

function updateEnemy(enemy, deltaTime) {
  if (enemy.state === EnemyState.DEAD) {
    return;
  }

  if (enemy.hp <= 0) {
    killEnemy(enemy);
    return;
  }

  updateEnemyState(enemy);

  if (enemy.state === EnemyState.IDLE) {
    return;
  }

  if (enemy.state === EnemyState.CHASE) {
    moveEnemyTowardPlayer(enemy, deltaTime);
    return;
  }

  if (enemy.state === EnemyState.ATTACK) {
    enemyAttack(enemy);
    return;
  }

  if (enemy.state === EnemyState.FLEE) {
    moveEnemyAwayFromPlayer(enemy, deltaTime);
  }
}

function updateEnemyState(enemy) {
  const distance = getDistance(enemy, player);
  const lowHp = enemy.hp / enemy.maxHp <= ENEMY_LOW_HP_PERCENT;

  if (lowHp) {
    enemy.state = EnemyState.FLEE;
    enemy.color = "#ffaa00";
    return;
  }

  if (distance <= ATTACK_RANGE_PIXELS) {
    enemy.state = EnemyState.ATTACK;
    enemy.color = "#ff0000";
    return;
  }

  if (distance <= ENEMY_DETECTION_RANGE_PIXELS) {
    enemy.state = EnemyState.CHASE;
    enemy.color = "#ff4444";
    return;
  }

  enemy.state = EnemyState.IDLE;
  enemy.color = "#884444";
}

function openActionMenu() {
  if (player.hp <= 0) {
    return;
  }

  gameMode = GameMode.ACTION_MENU;
  selectedAction = null;
  selectedTargetId = null;

  const targets = getEnemiesInAttackRange();

  if (targets.length > 0) {
    selectedAction = ActionType.ATTACK;
    selectedTargetId = targets[0].id;
  }

  message = "Tiempo detenido. Elige una acción. Suelta F para confirmar.";
}

function handleActionMenuKey(key) {
  if (key === "1") {
    selectedAction = ActionType.ATTACK;

    const targets = getEnemiesInAttackRange();

    if (targets.length > 0) {
      selectedTargetId = targets[0].id;
      message = `Acción elegida: atacar a ${targets[0].name}. Suelta F para ejecutar.`;
    } else {
      selectedTargetId = null;
      message = "Acción elegida: atacar. No hay enemigos a 5 pies.";
    }

    return;
  }

  if (key === "2") {
    selectedAction = ActionType.CAST_CURE_WOUNDS;
    selectedTargetId = null;
    message = "Acción elegida: conjurar Sanar heridas. Suelta F para empezar el casteo.";
    return;
  }

  if (key === "3") {
    selectedAction = ActionType.CAST_TIME_STOP;
    selectedTargetId = null;
    message = "Acción elegida: conjurar Detener el tiempo. Suelta F para empezar el casteo.";
    return;
  }

  const number = Number(key);

  if (!Number.isNaN(number) && number >= 4) {
    const targets = getEnemiesInAttackRange();
    const targetIndex = number - 4;

    if (targets[targetIndex]) {
      selectedAction = ActionType.ATTACK;
      selectedTargetId = targets[targetIndex].id;
      message = `Objetivo elegido: ${targets[targetIndex].name}. Suelta F para atacar.`;
    }
  }

  if (key === "escape") {
    selectedAction = null;
    selectedTargetId = null;
    message = "Acción cancelada. Suelta F para reanudar.";
  }
}

function closeActionMenuAndExecute() {
  if (gameMode !== GameMode.ACTION_MENU) {
    return;
  }

  gameMode = GameMode.REAL_TIME;

  if (selectedAction === ActionType.ATTACK) {
    executeSelectedAttack();
  } else if (selectedAction === ActionType.CAST_CURE_WOUNDS) {
    startCasting(ActionType.CAST_CURE_WOUNDS);
  } else if (selectedAction === ActionType.CAST_TIME_STOP) {
    startCasting(ActionType.CAST_TIME_STOP);
  } else {
    message = "No elegiste ninguna acción. El tiempo vuelve a moverse.";
  }

  selectedAction = null;
  selectedTargetId = null;
}

function executeSelectedAttack() {
  const target = enemies.find((enemy) => enemy.id === selectedTargetId);

  if (!target) {
    message = "No hay objetivo elegido.";
    return;
  }

  playerAttack(target);
}

function startCasting(spell) {
  if (player.hp <= 0) {
    message = "No puedes conjurar. Estás muerto.";
    return;
  }

  if (player.isCasting) {
    message = "Ya estás conjurando.";
    return;
  }

  if (player.spellCooldown > 0) {
    message = `Todavía no puedes conjurar. Cooldown: ${player.spellCooldown.toFixed(1)}s.`;
    return;
  }

  player.isCasting = true;
  player.castingSpell = spell;
  player.castingRemaining = SPELL_CAST_TIME;
  player.spellCooldown = SPELL_COOLDOWN;

  if (spell === ActionType.CAST_CURE_WOUNDS) {
    message = "Empiezas a conjurar Sanar heridas. Se resolverá en 3 segundos.";
    return;
  }

  if (spell === ActionType.CAST_TIME_STOP) {
    message = "Empiezas a conjurar Detener el tiempo. Se resolverá en 3 segundos.";
  }
}

function resolveSpell(spell) {
  if (spell === ActionType.CAST_CURE_WOUNDS) {
    const healing = rollDie(8);
    const previousHp = player.hp;

    player.hp = Math.min(player.maxHp, player.hp + healing);

    const healedAmount = player.hp - previousHp;

    message = `Sanar heridas se completa. Recuperas ${healedAmount} PG. Tirada: 1d8 = ${healing}.`;
    return;
  }

  if (spell === ActionType.CAST_TIME_STOP) {
    const d4 = rollDie(4);
    const duration = (d4 + 1) * 6;

    timeStopRemaining = duration;

    message = `Detener el tiempo se completa. Tirada: 1d4 = ${d4}. El tiempo se detiene ${duration} segundos para todos menos para ti.`;
  }
}

function playerAttack(target) {
  if (player.hp <= 0) {
    message = "No puedes atacar. Estás muerto.";
    return;
  }

  if (!target || target.state === EnemyState.DEAD) {
    message = "Ese enemigo ya está muerto.";
    return;
  }

  if (player.attackCooldown > 0) {
    message = `Tu ataque sigue en cooldown: ${player.attackCooldown.toFixed(1)}s.`;
    return;
  }

  if (!isInAttackRange(player, target)) {
    message = "El enemigo está fuera de alcance. Necesitas estar a 5 pies.";
    return;
  }

  target.hp = Math.max(0, target.hp - PLAYER_ATTACK_DAMAGE);
  player.attackCooldown = PLAYER_ATTACK_COOLDOWN;

  if (target.hp <= 0) {
    killEnemy(target);
    message = `Golpeas a ${target.name} por ${PLAYER_ATTACK_DAMAGE} de daño. Muere.`;
    return;
  }

  if (target.hp / target.maxHp <= ENEMY_LOW_HP_PERCENT) {
    message = `Golpeas a ${target.name} por ${PLAYER_ATTACK_DAMAGE} de daño. Entra en pánico y huye.`;
    return;
  }

  message = `Golpeas a ${target.name} por ${PLAYER_ATTACK_DAMAGE} de daño.`;
}

function enemyAttack(enemy) {
  if (enemy.attackCooldown > 0) {
    return;
  }

  if (!isInAttackRange(enemy, player)) {
    return;
  }

  player.hp = Math.max(0, player.hp - ENEMY_ATTACK_DAMAGE);
  enemy.attackCooldown = ENEMY_ATTACK_COOLDOWN;

  if (player.hp <= 0) {
    message = `${enemy.name} te golpea por ${ENEMY_ATTACK_DAMAGE} de daño. Has muerto.`;
    return;
  }

  message = `${enemy.name} te golpea por ${ENEMY_ATTACK_DAMAGE} de daño.`;
}

function killEnemy(enemy) {
  enemy.hp = 0;
  enemy.state = EnemyState.DEAD;
  enemy.char = "%";
  enemy.color = "#777777";
}

function getEnemiesInAttackRange() {
  return enemies.filter((enemy) => {
    return enemy.state !== EnemyState.DEAD && isInAttackRange(player, enemy);
  });
}

function moveEnemyTowardPlayer(enemy, deltaTime) {
  const direction = getDirection(enemy, player);

  const nextX = enemy.x + direction.x * ENEMY_SPEED * deltaTime;
  const nextY = enemy.y + direction.y * ENEMY_SPEED * deltaTime;

  moveEntityWithCollision(enemy, nextX, nextY);
}

function moveEnemyAwayFromPlayer(enemy, deltaTime) {
  const direction = getDirection(player, enemy);

  const nextX = enemy.x + direction.x * ENEMY_FLEE_SPEED * deltaTime;
  const nextY = enemy.y + direction.y * ENEMY_FLEE_SPEED * deltaTime;

  moveEntityWithCollision(enemy, nextX, nextY);
}

function getPlayerMovementVector() {
  let x = 0;
  let y = 0;

  if (keys.left) x -= 1;
  if (keys.right) x += 1;
  if (keys.up) y -= 1;
  if (keys.down) y += 1;

  return normalizeVector(x, y);
}

function getDirection(from, to) {
  return normalizeVector(to.x - from.x, to.y - from.y);
}

function normalizeVector(x, y) {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return {
    x: x / length,
    y: y / length,
  };
}

function moveEntityWithCollision(entity, nextX, nextY) {
  if (!isCollidingWithWall(entity, nextX, entity.y)) {
    entity.x = nextX;
  }

  if (!isCollidingWithWall(entity, entity.x, nextY)) {
    entity.y = nextY;
  }
}

function isCollidingWithWall(entity, x, y) {
  const pointsToCheck = [
    { x: x - entity.radius, y: y - entity.radius },
    { x: x + entity.radius, y: y - entity.radius },
    { x: x - entity.radius, y: y + entity.radius },
    { x: x + entity.radius, y: y + entity.radius },
  ];

  return pointsToCheck.some((point) => {
    const col = Math.floor(point.x / TILE_SIZE);
    const row = Math.floor(point.y / TILE_SIZE);

    if (row < 0 || row >= mapRows || col < 0 || col >= mapCols) {
      return true;
    }

    return map[row][col] === "#";
  });
}

function isInAttackRange(attacker, target) {
  return getDistance(attacker, target) <= ATTACK_RANGE_PIXELS;
}

function getDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawMap();

  for (const enemy of enemies) {
    drawEntity(enemy);
  }

  drawEntity(player);

  if (gameMode === GameMode.ACTION_MENU) {
    drawActionPopup();
  }

  if (timeStopRemaining > 0) {
    drawTimeStopOverlay();
  }
}

function drawMap() {
  ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let row = 0; row < mapRows; row++) {
    for (let col = 0; col < mapCols; col++) {
      const char = map[row][col];
      const x = col * TILE_SIZE;
      const y = row * TILE_SIZE;

      drawTileBox(x, y);

      if (char !== ".") {
        drawChar(char, x, y, "white");
      }
    }
  }
}

function drawTileBox(x, y) {
  ctx.strokeStyle = "#222";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, TILE_SIZE, TILE_SIZE);
}

function drawEntity(entity) {
  const tileX = entity.x - TILE_SIZE / 2;
  const tileY = entity.y - TILE_SIZE / 2;

  drawChar(entity.char, tileX, tileY, entity.color);
}

function drawChar(char, tileX, tileY, color) {
  ctx.fillStyle = color;
  ctx.fillText(char, tileX + TILE_SIZE / 2, tileY + TILE_SIZE / 2);
}

function drawActionPopup() {
  const popupWidth = 620;
  const popupHeight = 300;
  const x = canvas.width / 2 - popupWidth / 2;
  const y = canvas.height / 2 - popupHeight / 2;

  const targets = getEnemiesInAttackRange();

  ctx.fillStyle = "black";
  ctx.fillRect(x, y, popupWidth, popupHeight);

  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.strokeRect(x, y, popupWidth, popupHeight);

  ctx.font = `18px ${FONT_FAMILY}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  let lineY = y + 20;

  ctx.fillStyle = "white";
  ctx.fillText("TIEMPO DETENIDO", x + 20, lineY);
  lineY += 34;

  ctx.fillStyle = selectedAction === ActionType.ATTACK ? "#00ff66" : "white";
  ctx.fillText("1. Atacar", x + 20, lineY);
  lineY += 28;

  ctx.fillStyle = selectedAction === ActionType.CAST_CURE_WOUNDS ? "#00ff66" : "white";
  ctx.fillText("2. Conjurar: Sanar heridas | 1d8 PG | casteo 3s", x + 20, lineY);
  lineY += 28;

  ctx.fillStyle = selectedAction === ActionType.CAST_TIME_STOP ? "#00ff66" : "white";
  ctx.fillText("3. Conjurar: Detener el tiempo | (1d4 + 1) * 6s | casteo 3s", x + 20, lineY);
  lineY += 38;

  ctx.fillStyle = "white";
  ctx.fillText("Objetivos a 5 pies para atacar:", x + 20, lineY);
  lineY += 28;

  if (targets.length === 0) {
    ctx.fillStyle = "#777777";
    ctx.fillText("No hay enemigos a 5 pies.", x + 40, lineY);
    lineY += 26;
  } else {
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const targetNumber = i + 4;
      const isSelected = selectedTargetId === target.id;

      ctx.fillStyle = isSelected ? "#00ff66" : "white";
      ctx.fillText(
        `${targetNumber}. ${target.name} | ${target.hp}/${target.maxHp} PG`,
        x + 40,
        lineY
      );

      lineY += 26;
    }
  }

  ctx.fillStyle = "#aaaaaa";
  ctx.fillText("Suelta F para confirmar. ESC cancela.", x + 20, y + popupHeight - 36);
}

function drawTimeStopOverlay() {
  ctx.font = `18px ${FONT_FAMILY}`;
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#7fdbff";
  ctx.fillText(
    `TIEMPO DETENIDO: ${timeStopRemaining.toFixed(1)}s`,
    canvas.width - 16,
    16
  );
}

function updateHud() {
  const playerCol = player.x / TILE_SIZE;
  const playerRow = player.y / TILE_SIZE;

  const livingEnemies = enemies.filter((enemy) => enemy.state !== EnemyState.DEAD);
  const nearestEnemy = livingEnemies[0] ?? enemies[0];

  const speedMode = keys.run ? "corriendo" : "caminando";
  const modeText = getModeText();

  let enemyInfo = "Sin enemigos.";
  let distanceInfo = "Distancia: —";

  if (nearestEnemy) {
    const enemyCol = nearestEnemy.x / TILE_SIZE;
    const enemyRow = nearestEnemy.y / TILE_SIZE;
    const distanceInTiles = getDistance(player, nearestEnemy) / TILE_SIZE;
    const distanceInFeet = distanceInTiles * FEET_PER_TILE;

    enemyInfo =
      `Enemigo: ${nearestEnemy.hp}/${nearestEnemy.maxHp} PG | Estado: ${nearestEnemy.state}\n` +
      `Enemigo: columna ${enemyCol.toFixed(2)}, fila ${enemyRow.toFixed(2)}`;

    distanceInfo = `Distancia: ${distanceInFeet.toFixed(1)} pies`;
  }

  output.textContent =
    `Modo: ${modeText}\n` +
    `Jugador: ${player.hp}/${player.maxHp} PG\n` +
    `${enemyInfo}\n\n` +
    `Jugador: columna ${playerCol.toFixed(2)}, fila ${playerRow.toFixed(2)}\n` +
    `${distanceInfo}\n\n` +
    `Movimiento: A/W/S/R | Shift correr\n` +
    `Mantener F: menú de acción\n` +
    `Ataque cooldown: ${player.attackCooldown.toFixed(1)}s\n` +
    `Conjuro cooldown: ${player.spellCooldown.toFixed(1)}s\n` +
    `Casteando: ${getCastingText()}\n` +
    `Tiempo detenido restante: ${timeStopRemaining.toFixed(1)}s\n\n` +
    `${message}`;
}

function getModeText() {
  if (gameMode === GameMode.ACTION_MENU) {
    return "menú detenido";
  }

  if (timeStopRemaining > 0) {
    return "tiempo detenido para todos menos para ti";
  }

  return "tiempo real";
}

function getCastingText() {
  if (!player.isCasting) {
    return "no";
  }

  if (player.castingSpell === ActionType.CAST_CURE_WOUNDS) {
    return `Sanar heridas, ${player.castingRemaining.toFixed(1)}s`;
  }

  if (player.castingSpell === ActionType.CAST_TIME_STOP) {
    return `Detener el tiempo, ${player.castingRemaining.toFixed(1)}s`;
  }

  return `${player.castingRemaining.toFixed(1)}s`;
}

function submitInput() {
  const command = input.value.trim().toLowerCase();
  input.value = "";

  if (command === "") return;

  if (command === "ayuda") {
    message = `Comandos:
ayuda
posicion
velocidad

Movimiento:
a = izquierda
w = arriba
s = derecha
r = abajo
shift = correr
mantener f = detener tiempo y abrir acciones

Acciones:
1 = atacar
2 = sanar heridas
3 = detener el tiempo`;
    return;
  }

  if (command === "posicion") {
    const col = player.x / TILE_SIZE;
    const row = player.y / TILE_SIZE;

    message = `Posición actual:
Columna: ${col.toFixed(2)}
Fila: ${row.toFixed(2)}`;
    return;
  }

  if (command === "velocidad") {
    message = `Velocidad:
Caminar: 6 casillas cada 6 segundos.
Correr: ${6 * RUN_SPEED_MULTIPLIER} casillas cada 6 segundos.
Una casilla representa 5 pies.`;
    return;
  }

  message = `No reconozco el comando: "${command}". Escribe "ayuda".`;
}

draw();
updateHud();
requestAnimationFrame(gameLoop);