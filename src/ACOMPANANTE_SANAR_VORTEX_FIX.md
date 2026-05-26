# Corrección acompañante: Sanar heridas, Vortex Warp e IA defensiva

Cambios aplicados:

- `Sanar heridas` ahora puede apuntar al guerrero acompañante usando ids `companion:<id>`.
- `Vortex Warp` ahora puede mover criaturas, no sólo enemigos: enemigos, mercaderes aliados visibles y acompañantes.
- La UI de objetivo de Vortex Warp ahora habla de criaturas, no de enemigos.
- La IA del guerrero detecta poca vida con 35% o menos de sus PG máximos.
- Con poca vida, el guerrero deja de perseguir o priorizar disparos; se repliega con el jugador conservando una posición entre el jugador y el enemigo más cercano.
- Si está herido y un enemigo queda a 5 pies mientras mantiene guardia, puede usar su reacción defensiva si está disponible.
