# Implementación: mazmorras completas de 3 pisos

La mazmorra ya no se genera al cruzar puertas. A partir del layer 1, cada piso se genera completo al entrar:

- Piso 1, 2 y 3.
- Número aleatorio de habitaciones por piso.
- Habitaciones medianas/grandes, no minúsculas por defecto.
- Habitaciones sin superposición, con separación mínima.
- Pasillos conectan todas las habitaciones.
- Escalera de subida en la sala inicial.
- Escalera de bajada sólo en pisos 1 y 2.
- Piso 3 no genera escalera descendente.
- Una sala de jefe obligatoria por piso.
- Una vendedora arcana obligatoria por piso.
- Enemigos, loot y antorchas se colocan al entrar al piso.

Referencia de diseño: Chapter 8: Random Dungeon Generation, adaptado a una generación digital por piso en vez de generación incremental manual.
