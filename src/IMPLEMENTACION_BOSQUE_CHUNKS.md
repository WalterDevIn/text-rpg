# Bosque procedural por chunks

Implementación aplicada:

- La superficie se genera como bosque diurno por chunks deterministas.
- Los árboles usan el tile `T` y bloquean movimiento/visión/proyectiles.
- La superficie usa iluminación completa (`daylight = 1`).
- La cámara no se limita a `mapRows/mapCols` cuando el jugador está en superficie.
- Las entradas de mazmorra se generan dentro de chunks de superficie.
- Hay una entrada garantizada cerca del spawn y otras aparecen al explorar.
- Cada entrada de mazmorra genera una clave propia `row,col`.
- Las plantas de mazmorra usan seed por entrada: `seed:entrance:row,col:layer:dungeon:n`.
- Al subir desde una mazmorra se vuelve a una casilla adyacente a la entrada correspondiente.

Notas:

- La superficie ya no depende del mapa fijo 90x90 para lectura de tiles.
- Las plantas de mazmorra conservan el sistema anterior de salas/puertas dentro del mapa fijo.
