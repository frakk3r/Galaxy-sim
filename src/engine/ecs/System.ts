/**
 * =============================================================================
 * SYSTEM.TS - Classe base per tutti i sistemi
 * =============================================================================
 */

import { ISystem, IWorld, EntityId, ComponentType, ComponentData } from './types';

export class System implements ISystem {
    public name: string;
    public priority: number;
    public world: IWorld | null;
    public enabled: boolean;

    // Profiling
    public _updateCount: number;
    public _totalTime: number;
    public _lastUpdateTime: number;

    constructor(name: string, priority: number = 0) {
        this.name = name;
        this.priority = priority;
        this.world = null;
        this.enabled = true;

        this._updateCount = 0;
        this._totalTime = 0;
        this._lastUpdateTime = 0;
    }

    /**
     * Inizializzazione del sistema
     */
    init(world: IWorld): void {
        this.world = world;
    }

    /**
     * Aggiornamento del sistema (fase logica)
     */
    update(deltaTime: number): void {
        // Override me
    }

    /**
     * Rendering del sistema
     */
    render(interpolation: number): void {
        // Override me
    }

    /**
     * Cleanup del sistema
     */
    destroy(): void {
        this.world = null;
    }

    enable(): void {
        this.enabled = true;
    }

    disable(): void {
        this.enabled = false;
    }

    getStats(): object {
        return {
            name: this.name,
            enabled: this.enabled,
            priority: this.priority,
            updateCount: this._updateCount,
            totalTime: this._totalTime,
            averageTime: this._updateCount > 0 ? this._totalTime / this._updateCount : 0,
            lastUpdateTime: this._lastUpdateTime
        };
    }

    /**
     * Helper: Query veloce per ottenere entità con componenti specifici
     */
    queryEntities(componentTypes: ComponentType[]): EntityId[] {
        if (!this.world) {
            console.warn(`[${this.name}] Sistema non inizializzato - world è null`);
            return [];
        }
        return this.world.queryEntities(componentTypes);
    }

    /**
     * Helper: Ottiene un componente da un'entità
     */
    getComponent<T extends ComponentData>(entityId: EntityId, componentType: ComponentType): T | undefined {
        if (!this.world) {
            return undefined;
        }
        return this.world.getComponent<T>(entityId, componentType);
    }

    /**
     * Helper: Emette un evento tramite l'Event Bus
     */
    emit(eventType: string, data: any): void {
        if (!this.world) {
            console.warn(`[${this.name}] Impossibile emettere evento - world è null`);
            return;
        }
        this.world.emit(eventType, data);
    }

    /**
     * Helper: Ascolta un evento dall'Event Bus
     */
    on(eventType: string, callback: (data: any) => void): () => void {
        // In un mondo reale, World dovrebbe esporre 'on', ma nell'interfaccia IWorld non c'è.
        // Dobbiamo estendere IWorld o usare 'any' se World reale ha 'on'.
        // World.ts (che abbiamo letto) HA 'on'.
        // Quindi aggiorno IWorld in types.ts.
        if (!this.world) {
            console.warn(`[${this.name}] Impossibile registrare listener - world è null`);
            return () => {};
        }
        // Cast a any per accedere a 'on' se non è in IWorld (ma dovrebbe esserci)
        return (this.world as any).on(eventType, callback);
    }
}

export default System;
