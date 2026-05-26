# Implementación: minimapa y debug de layer

- Se agregó exploración persistente por layer en `gameState.exploredTilesByLayer`.
- El minimapa se dibuja en canvas y muestra sólo tiles explorados.
- El minimapa no usa sistema de luz: una vez explorado, el tile queda revelado.
- En superficie el minimapa se centra alrededor del jugador para soportar mundo por chunks/infinito.
- En mazmorra el minimapa muestra la planta fija del piso.
- Se agregó badge de debug con prefijo `D` para layer actual, jefe esperado, cantidad de salas, tiles explorados, entrada y seed.
