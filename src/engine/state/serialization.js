export function serializeGameState(gameState, worldSnapshot = null) {
  return JSON.stringify({
    version: 2,
    gameState,
    world: worldSnapshot,
  });
}

export function deserializeGameState(serialized) {
  const parsed = JSON.parse(serialized);

  if (parsed?.version >= 2) {
    return parsed;
  }

  return {
    version: 1,
    gameState: parsed,
    world: null,
  };
}
