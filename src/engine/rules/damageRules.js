export function applyDamage(target, amount, metadata = {}) {
  if (!target || amount <= 0) {
    return { applied: 0, blocked: 0, temporaryBlocked: 0, remainingDamage: 0 };
  }

  let remaining = Math.max(0, amount);
  let blocked = 0;
  let temporaryBlocked = 0;

  if ((target.shieldRemaining ?? 0) > 0 && (target.shieldHp ?? 0) > 0) {
    const shieldBlock = Math.min(remaining, target.shieldHp);
    target.shieldHp -= shieldBlock;
    blocked += shieldBlock;
    remaining -= shieldBlock;

    if (target.shieldHp <= 0) {
      target.shieldHp = 0;
      target.shieldRemaining = 0;
    }
  }

  if (remaining > 0 && (target.temporaryHp ?? 0) > 0) {
    const tempBlock = Math.min(remaining, target.temporaryHp);
    target.temporaryHp -= tempBlock;
    temporaryBlocked += tempBlock;
    remaining -= tempBlock;

    if (target.temporaryHp <= 0) {
      target.temporaryHp = 0;
      target.temporaryHpRemaining = 0;
    }
  }

  const applied = Math.min(target.hp ?? 0, remaining);
  target.hp = Math.max(0, (target.hp ?? 0) - remaining);

  return {
    applied,
    blocked,
    temporaryBlocked,
    remainingDamage: remaining,
    metadata,
  };
}

export function getDamageResolutionText(result) {
  const parts = [];
  if (result.blocked > 0) parts.push(`Escudo bloquea ${result.blocked}`);
  if (result.temporaryBlocked > 0) parts.push(`PG temporales absorben ${result.temporaryBlocked}`);
  return parts.length > 0 ? ` (${parts.join("; ")})` : "";
}
