/**
 * =============================================================================
 * TYPES.TS - Definizioni tipi core per l'ECS
 * =============================================================================
 */

// ID univoco per le entità
export type EntityId = number;

// Interfaccia base per un'entità
export interface Entity {
    id: EntityId;
    tag?: string;
    active: boolean;
}

// Tipo generico per i dati dei componenti
export type ComponentType = string;

export interface BaseComponent {
    _type?: string;
    _entityId?: number;
    [key: string]: any;
}

export type ComponentData = BaseComponent;

// Interfaccia per il World (facade)
export interface IWorld {
    createEntity(tag?: string): EntityId;
    destroyEntity(entityId: EntityId): boolean;
    entityExists(entityId: EntityId): boolean; // Aggiunto
    addComponent<T extends ComponentData>(entityId: EntityId, type: ComponentType, data: T): T;
    getComponent<T extends ComponentData>(entityId: EntityId, type: ComponentType): T | undefined;
    hasComponent(entityId: EntityId, type: ComponentType): boolean;
    removeComponent(entityId: EntityId, type: ComponentType): boolean;
    queryEntities(components: ComponentType[]): EntityId[];
    
    emit(event: string, data: any): void;
    on(event: string, callback: (data: any) => void): () => void;
    off(event: string, callback: (data: any) => void): void;

    // System management
    getSystem(name: string): any;
}

// Interfaccia base per i sistemi
export interface ISystem {
    name: string;
    priority: number;
    enabled: boolean;
    
    init(world: IWorld): void;
    update(deltaTime: number): void;
    render(interpolation: number): void;
    destroy(): void;
    getStats(): object;
}
