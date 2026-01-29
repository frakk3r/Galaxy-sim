/**
 * =============================================================================
 * COMPONENT-MANAGER.TS - Gestore centrale dei componenti
 * =============================================================================
 */

import { EntityId, ComponentType, ComponentData } from './types';

export class ComponentManager {
    private _components: Record<ComponentType, Map<EntityId, ComponentData>>;
    private _queryCache: Map<string, Set<EntityId>>;
    private _cacheValid: boolean;

    constructor() {
        this._components = {};
        this._queryCache = new Map();
        this._cacheValid = true;
    }

    registerType(componentType: ComponentType): void {
        if (!this._components[componentType]) {
            this._components[componentType] = new Map();
        }
    }

    add<T extends ComponentData>(entityId: EntityId, componentType: ComponentType, componentData: T): T {
        if (!this._components[componentType]) {
            this._components[componentType] = new Map();
        }

        // Add metadata
        componentData._type = componentType;
        componentData._entityId = entityId;

        this._components[componentType].set(entityId, componentData);
        this._invalidateCache();

        return componentData;
    }

    get<T extends ComponentData>(entityId: EntityId, componentType: ComponentType): T | undefined {
        const typeMap = this._components[componentType];
        if (!typeMap) {
            return undefined;
        }
        return typeMap.get(entityId) as T;
    }

    has(entityId: EntityId, componentType: ComponentType): boolean {
        const typeMap = this._components[componentType];
        return typeMap ? typeMap.has(entityId) : false;
    }

    hasAll(entityId: EntityId, componentTypes: ComponentType[]): boolean {
        for (const type of componentTypes) {
            if (!this.has(entityId, type)) {
                return false;
            }
        }
        return true;
    }

    hasAny(entityId: EntityId, componentTypes: ComponentType[]): boolean {
        for (const type of componentTypes) {
            if (this.has(entityId, type)) {
                return true;
            }
        }
        return false;
    }

    remove(entityId: EntityId, componentType: ComponentType): boolean {
        const typeMap = this._components[componentType];
        if (!typeMap) {
            return false;
        }

        const existed = typeMap.delete(entityId);
        
        if (existed) {
            this._invalidateCache();
        }

        return existed;
    }

    removeAllFromEntity(entityId: EntityId): number {
        let removed = 0;

        for (const componentType in this._components) {
            if (this._components[componentType].delete(entityId)) {
                removed++;
            }
        }

        if (removed > 0) {
            this._invalidateCache();
        }

        return removed;
    }

    query(requiredTypes: ComponentType[]): EntityId[] {
        if (requiredTypes.length === 0) {
            return [];
        }

        const cacheKey = requiredTypes.slice().sort().join(',');
        if (this._cacheValid && this._queryCache.has(cacheKey)) {
            return Array.from(this._queryCache.get(cacheKey)!);
        }

        let smallestType = requiredTypes[0];
        let smallestSize = this._getTypeSize(smallestType);

        for (let i = 1; i < requiredTypes.length; i++) {
            const size = this._getTypeSize(requiredTypes[i]);
            if (size < smallestSize) {
                smallestSize = size;
                smallestType = requiredTypes[i];
            }
        }

        const result: EntityId[] = [];
        const typeMap = this._components[smallestType];
        
        if (!typeMap) {
            return [];
        }

        for (const entityId of typeMap.keys()) {
            if (this.hasAll(entityId, requiredTypes)) {
                result.push(entityId);
            }
        }

        this._queryCache.set(cacheKey, new Set(result));

        return result;
    }

    getAllFromEntity(entityId: EntityId): Record<ComponentType, ComponentData> {
        const result: Record<ComponentType, ComponentData> = {};

        for (const componentType in this._components) {
            const component = this._components[componentType].get(entityId);
            if (component) {
                result[componentType] = component;
            }
        }

        return result;
    }

    private _getTypeSize(componentType: ComponentType): number {
        const typeMap = this._components[componentType];
        return typeMap ? typeMap.size : 0;
    }

    private _invalidateCache(): void {
        this._cacheValid = false;
        this._queryCache.clear();
    }

    validateCache(): void {
        this._cacheValid = true;
    }

    getStats(): object {
        const stats = {
            types: {} as Record<string, number>,
            totalComponents: 0,
            cacheSize: this._queryCache.size,
            cacheValid: this._cacheValid
        };

        for (const type in this._components) {
            const count = this._components[type].size;
            stats.types[type] = count;
            stats.totalComponents += count;
        }

        return stats;
    }

    clear(): void {
        for (const type in this._components) {
            this._components[type].clear();
        }
        this._components = {};
        this._queryCache.clear();
        this._cacheValid = true;
    }
}

export default ComponentManager;
