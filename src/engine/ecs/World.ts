/**
 * =============================================================================
 * WORLD.TS - Facade principale del sistema ECS
 * =============================================================================
 */

import EntityManager from './EntityManager';
import ComponentManager from './ComponentManager';
import SystemManager from './SystemManager';
import { EventBus } from '../events/EventBus';
import { Entity } from './Entity';
import { EntityId, ComponentType, ComponentData, IWorld, ISystem } from './types';

export class World implements IWorld {
    public entities: EntityManager;
    public components: ComponentManager;
    public systems: SystemManager;
    public events: EventBus;

    private _initialized: boolean;
    private _destroyed: boolean;
    private _frameCount: number;
    private _totalTime: number;

    constructor(eventBus: EventBus) {
        this.entities = new EntityManager();
        this.components = new ComponentManager();
        this.systems = new SystemManager();
        this.events = eventBus;

        this.systems.setWorld(this);

        this._initialized = false;
        this._destroyed = false;
        this._frameCount = 0;
        this._totalTime = 0;
    }

    createEntity(tag: string = ''): EntityId {
        const entity = this.entities.create(tag);
        this.emit('entity:created', { entityId: entity.id, tag });
        return entity.id;
    }

    createEntityWith(tag: string, components: Record<string, ComponentData>): EntityId {
        const entityId = this.createEntity(tag);

        for (const [type, data] of Object.entries(components)) {
            this.addComponent(entityId, type, data);
        }

        return entityId;
    }

    destroyEntity(entityId: EntityId): boolean {
        const result = this.entities.markForRemoval(entityId);
        
        if (result) {
            this.emit('entity:destroying', { entityId });
        }
        
        return result;
    }

    getEntity(entityId: EntityId): Entity | undefined {
        return this.entities.get(entityId);
    }

    entityExists(entityId: EntityId): boolean {
        return this.entities.exists(entityId);
    }

    getEntitiesByTag(tag: string): Entity[] {
        return this.entities.getByTag(tag);
    }

    addComponent<T extends ComponentData>(entityId: EntityId, type: ComponentType, data: T): T {
        const component = this.components.add(entityId, type, data);
        this.emit('component:added', { entityId, type, component });
        return component;
    }

    getComponent<T extends ComponentData>(entityId: EntityId, type: ComponentType): T | undefined {
        return this.components.get<T>(entityId, type);
    }

    hasComponent(entityId: EntityId, type: ComponentType): boolean {
        return this.components.has(entityId, type);
    }

    removeComponent(entityId: EntityId, type: ComponentType): boolean {
        const result = this.components.remove(entityId, type);
        if (result) {
            this.emit('component:removed', { entityId, type });
        }
        return result;
    }

    query(componentTypes: ComponentType[]): EntityId[] {
        return this.components.query(componentTypes);
    }

    // Alias per compatibilità con IWorld e System.ts
    queryEntities(componentTypes: ComponentType[]): EntityId[] {
        return this.query(componentTypes);
    }

    registerSystem(system: ISystem): ISystem {
        return this.systems.register(system);
    }

    getSystem(name: string): ISystem | undefined {
        return this.systems.get(name);
    }

    emit(eventType: string, data: any): void {
        if (this.events) {
            this.events.emit(eventType, data);
        }
    }

    on(eventType: string, callback: (data: any) => void): () => void {
        if (this.events) {
            return this.events.on(eventType, callback);
        }
        return () => {};
    }

    off(eventType: string, callback: (data: any) => void): void {
        if (this.events) {
            this.events.off(eventType, callback);
        }
    }

    init(): void {
        if (this._initialized) {
            console.warn('[World] Già inizializzato');
            return;
        }

        this.systems.initAll();
        this._initialized = true;

        this.emit('world:initialized', {});
        console.log('[World] Inizializzato');
    }

    update(deltaTime: number): void {
        if (this._destroyed) return;

        this.systems.update(deltaTime);
        this._flushRemovals();
        this.components.validateCache();

        this._frameCount++;
        this._totalTime += deltaTime;
    }

    render(interpolation: number): void {
        if (this._destroyed) return;
        this.systems.render(interpolation);
    }

    private _flushRemovals(): void {
        const pendingIds = this.entities._pendingRemoval;
        
        for (const entityId of pendingIds) {
            this.components.removeAllFromEntity(entityId);
            this.emit('entity:destroyed', { entityId });
        }

        this.entities.flushRemovals();
    }

    destroy(): void {
        if (this._destroyed) return;

        this.emit('world:destroying', {});

        this.systems.destroyAll();
        this.entities.clear();
        this.components.clear();

        this._destroyed = true;
        console.log('[World] Distrutto');
    }

    getStats(): object {
        return {
            initialized: this._initialized,
            destroyed: this._destroyed,
            frameCount: this._frameCount,
            totalTime: this._totalTime,
            entities: this.entities.getStats(),
            components: this.components.getStats(),
            systems: this.systems.getStats()
        };
    }
}

export default World;
