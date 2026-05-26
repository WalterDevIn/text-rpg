# Pergaminos de conjuros

Implementación sobre `src_acompanante_sanar_vortex_ia_fix.zip`.

## Cambios

- Se agregan pergaminos genéricos para todos los conjuros definidos en `src/content/spells/spellDefinitions.js`.
- Los cofres y el loot suelto de mazmorra ahora pueden generar esos pergaminos.
- Los pergaminos consumen el objeto al usarse y llaman al mismo resolvedor de conjuro que el casteo normal.
- El menú de objetos reconoce pergaminos con objetivo de criatura, enemigo, punto, dirección, self y criatura + punto.

## Pergaminos generados

- Sanar heridas
- Detener el tiempo
- Misil mágico
- Manos ardientes
- Escudo
- Muro de fuerza
- Bola de fuego
- Vortex Warp
- Counterspell
- Saeta de fuego
- Orbe cromático

## Nota

Se conservan los pergaminos especiales anteriores: Paso brumoso, Desintegrar y Forcecage.
