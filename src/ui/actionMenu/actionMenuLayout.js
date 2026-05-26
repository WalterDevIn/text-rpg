export function computeRadialActionLayout(center, count, radius = 120, startAngle = -Math.PI / 2) {
  if (count <= 0) return [];
  const step = (Math.PI * 2) / count;
  return Array.from({ length: count }, (_, index) => ({
    x: center.x + Math.cos(startAngle + step * index) * radius,
    y: center.y + Math.sin(startAngle + step * index) * radius,
    angle: startAngle + step * index,
  }));
}

export function placeActionButtons(center, actions, radius = 120) {
  const points = computeRadialActionLayout(center, actions.length, radius);
  return actions.map((action, index) => ({ ...action, ...points[index] }));
}
