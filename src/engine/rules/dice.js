export function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count = 1, sides = 6) {
  return Array.from({ length: count }, () => rollDie(sides));
}

export function rollDiceExpression(expression = "1d6") {
  const normalized = String(expression).replace(/\s+/g, "").toLowerCase();
  const match = normalized.match(/^(\d*)d(\d+)([+-]\d+)?$/);
  if (!match) {
    const flat = Number(normalized);
    return { total: Number.isFinite(flat) ? flat : 0, rolls: [], modifier: Number.isFinite(flat) ? flat : 0, expression };
  }
  const count = Number(match[1] || 1);
  const sides = Number(match[2]);
  const modifier = Number(match[3] || 0);
  const rolls = rollDice(count, sides);
  return {
    total: rolls.reduce((sum, value) => sum + value, modifier),
    rolls,
    modifier,
    expression,
  };
}
