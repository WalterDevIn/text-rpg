import { hasComponents } from "./components.js";

let nextEntityNumber = 1;

export class EntityManager {
  constructor() {
    this.entities = new Map();
    this.indexByComponent = new Map();
  }

  create(components = {}, id = null) {
    const entity = {
      id: id ?? `entity_${nextEntityNumber++}`,
      components: {},
      alive: true,
    };

    this.entities.set(entity.id, entity);

    for (const [name, value] of Object.entries(components)) {
      this.addComponent(entity.id, name, value);
    }

    return entity;
  }

  upsert(id, components = {}) {
    const entity = this.get(id) ?? this.create({}, id);

    for (const [name, value] of Object.entries(components)) {
      this.addComponent(entity.id, name, value);
    }

    entity.alive = true;
    return entity;
  }

  get(id) {
    return this.entities.get(id) ?? null;
  }

  has(id) {
    return this.entities.has(id);
  }

  getEntity(id) {
    return this.get(id);
  }

  destroyEntity(id) {
    return this.remove(id);
  }

  remove(id) {
    const entity = this.get(id);
    if (!entity) return false;

    for (const name of Object.keys(entity.components)) {
      this.removeComponent(id, name);
    }

    this.entities.delete(id);
    return true;
  }

  clear() {
    this.entities.clear();
    this.indexByComponent.clear();
  }

  addComponent(id, componentName, value = true) {
    const entity = typeof id === "string" ? this.get(id) : id;
    if (!entity) return null;

    entity.components[componentName] = value;

    if (!this.indexByComponent.has(componentName)) {
      this.indexByComponent.set(componentName, new Set());
    }

    this.indexByComponent.get(componentName).add(entity.id);
    return entity;
  }

  removeComponent(id, componentName) {
    const entity = typeof id === "string" ? this.get(id) : id;
    if (!entity || !Object.prototype.hasOwnProperty.call(entity.components, componentName)) return null;

    delete entity.components[componentName];
    this.indexByComponent.get(componentName)?.delete(entity.id);
    return entity;
  }

  getComponent(id, componentName) {
    const entity = typeof id === "string" ? this.get(id) : id;
    return entity?.components?.[componentName] ?? null;
  }

  query(componentNames = []) {
    if (componentNames.length === 0) return [...this.entities.values()].filter((entity) => entity.alive !== false);

    const [first, ...rest] = componentNames;
    const firstSet = this.indexByComponent.get(first);
    if (!firstSet) return [];

    const result = [];

    for (const id of firstSet) {
      const entity = this.get(id);
      if (!entity || entity.alive === false) continue;
      if (rest.every((name) => this.indexByComponent.get(name)?.has(id))) {
        result.push(entity);
      }
    }

    return result;
  }

  queryOne(componentNames = []) {
    return this.query(componentNames)[0] ?? null;
  }

  queryWhere(componentNames = [], predicate = () => true) {
    return this.query(componentNames).filter(predicate);
  }

  snapshot() {
    return this.query().map((entity) => ({
      id: entity.id,
      alive: entity.alive,
      components: structuredCloneWithoutRefs(entity.components),
    }));
  }
}

function structuredCloneWithoutRefs(value) {
  if (Array.isArray(value)) return value.map(structuredCloneWithoutRefs);
  if (!value || typeof value !== "object") return value;

  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "ref") continue;
    output[key] = structuredCloneWithoutRefs(item);
  }
  return output;
}

export const ecsWorld = new EntityManager();

export function createEntity(components = {}, id = null) {
  return ecsWorld.create(components, id);
}

export function addComponent(entityOrId, componentName, value = true) {
  return ecsWorld.addComponent(typeof entityOrId === "string" ? entityOrId : entityOrId.id, componentName, value);
}

export function removeComponent(entityOrId, componentName) {
  return ecsWorld.removeComponent(typeof entityOrId === "string" ? entityOrId : entityOrId.id, componentName);
}

export function getComponent(entityOrId, componentName) {
  return ecsWorld.getComponent(typeof entityOrId === "string" ? entityOrId : entityOrId.id, componentName);
}

export function queryEntities(entitiesOrComponentNames, maybeComponentNames) {
  if (Array.isArray(maybeComponentNames)) {
    return entitiesOrComponentNames.filter((entity) => hasComponents(entity, maybeComponentNames));
  }

  return ecsWorld.query(entitiesOrComponentNames);
}
