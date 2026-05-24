export const EnemyState = {
  IDLE: "idle",
  CHASE: "chase",
  ATTACK: "attack",
  CAST: "cast",
  FLEE: "flee",
  DEAD: "dead",
};

export const GameMode = {
  REAL_TIME: "real_time",
  ACTION_MENU: "action_menu",
};

export const ActionType = {
  ATTACK: "attack",
  CAST_CURE_WOUNDS: "cast_cure_wounds",
  CAST_TIME_STOP: "cast_time_stop",
  CAST_MAGIC_MISSILE: "cast_magic_missile",
  CAST_BURNING_HANDS: "cast_burning_hands",
  CAST_SHIELD: "cast_shield",
  CAST_WALL_OF_FORCE: "cast_wall_of_force",
  CAST_FIREBALL: "cast_fireball",
  CAST_VORTEX_WARP: "cast_vortex_warp",
  CAST_COUNTERSPELL: "cast_counterspell",
  CAST_FIRE_BOLT: "cast_fire_bolt",
  CAST_CHROMATIC_ORB: "cast_chromatic_orb",
  DODGE: "dodge",
  USE_ITEM: "use_item",
  TRADE: "trade",
  ANALYZE: "analyze",
};

export const gameState = {
  mode: GameMode.REAL_TIME,
  message: "Mantén F para detener el tiempo y elegir una acción.",
  selectedAction: null,
  selectedTargetId: null,
  selectedDodgeDirection: null,
  selectedAimDirection: null,
  selectedBoardPoint: null,
  selectedInventoryItemId: null,
  selectedAnalysisPoint: null,
  mouseWorldPoint: null,
  infoMessage: "",
  infoPortraitKey: null,
  timeStopRemaining: 0,
  elapsedTime: 0,
};
