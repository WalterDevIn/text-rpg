// Static creature catalog. These objects are data, not ECS entities.
// Spawn code may use them to create simulated entities with Position, Health, AI, etc.
export const creatureDefinitions = Object.freeze({
  centipede: {
    id: "centipede",
    name: "Ciempiés gigante",
    kind: "segmented_creature",
    ai: "serpent",
    defaultFaction: "hostile",
    segmentCount: 6,
    hp: 26,
    ac: 13,
  },
  bandit: {
    id: "bandit",
    name: "Bandido",
    kind: "humanoid",
    ai: "melee",
    defaultFaction: "hostile",
    hp: 11,
    ac: 12,
  },
});

export function getCreatureDefinition(creatureId) {
  return creatureDefinitions[creatureId] ?? null;
}

export function listCreatureDefinitions() {
  return Object.values(creatureDefinitions);
}
