import { createAreaEffectEntity } from "../../../engine/ecs/simulationFactories.js";
import { getSpellDefinition, SpellId } from "../spellDefinitions.js";
import { getWallOfForceTiles } from "../spellGeometry.js";

export function castWallOfForceEcs({ casterId, origin, targetPoint, tiles = null } = {}) {
  const spell = getSpellDefinition(SpellId.WALL_OF_FORCE);
  const wallTiles = tiles ?? (origin && targetPoint ? getWallOfForceTiles(origin, targetPoint) : []);
  const center = targetPoint ?? origin ?? { x: 0, y: 0 };

  return createAreaEffectEntity({
    x: center.x,
    y: center.y,
    shape: "tile_line",
    radius: spell.wallLengthTiles,
    sourceSpellId: spell.id,
    casterId,
    duration: spell.durationSeconds,
    effect: {
      type: "temporary_wall",
      tiles: wallTiles,
      blocksMovement: true,
      blocksVision: false,
      blocksProjectiles: true,
    },
    render: { char: "#", color: "#ffee66", hidden: false },
  });
}
