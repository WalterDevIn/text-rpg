# ECS híbrido

Esta carpeta contiene sólo la capa ECS para entidades simuladas del mundo.

Archivos principales:

- `components.js`: nombres y constructores de componentes.
- `entityManager.js`: almacenamiento, consultas y mutación de entidades.
- `queries.js`: consultas semánticas de simulación.
- `factories.js`: conversión de objetos de estado existentes a componentes ECS.
- `stateEcsAdapter.js`: sincronización explícita entre colecciones de estado y entidades ECS.
- `simulationFactories.js`: creación de entidades simuladas puras: puertas, trampas, áreas, cuerpos segmentados, proyectiles, ítems tirados.

Frontera de arquitectura: UI, assets, definiciones de contenido, configuración, guardado y render base no son entidades ECS. Sólo entra al ECS aquello que vive en la simulación del mundo.
