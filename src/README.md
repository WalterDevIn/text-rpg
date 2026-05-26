# src

Arquitectura dura del juego. No existe carpeta `js/` ni carpeta de compatibilidad anterior.

- `app/`: arranque, bootstrap y game loop.
- `engine/`: estado, ECS, sistemas, mundo, reglas y eventos.
- `content/`: definiciones y lógica de contenido.
- `ui/`: módulos de interfaz.
- `render/`: canvas, cámara y renderizado.
- `utils/`: utilidades pequeñas.

Frontera híbrida: ECS para simulación viva; módulos normales para contenido, UI, render, input físico, guardado y generación.

## Mundo por seed + chunks

La base procedural ahora tiene tres piezas:

- `engine/world/chunks.js`: divide el mundo en chunks de 32x32 tiles, genera chunks deterministas por seed y guarda deltas por chunk.
- `engine/world/map.js`: mantiene el dungeon actual y sincroniza cada cambio de tile hacia chunks.
- `engine/state/saveLoad.js`: guarda `worldSeed` y los deltas de chunks junto con el estado de juego.

La seed activa vive en `gameState.worldSeed`. La misma seed reproduce la misma base de chunks. Los cambios hechos durante la partida se guardan como deltas: puertas, tiles modificados, muros temporales materializados como tile, etc.
