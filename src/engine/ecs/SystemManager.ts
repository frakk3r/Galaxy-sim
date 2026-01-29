/**
 * =============================================================================
 * SYSTEM-MANAGER.TS - Gestore centrale dei sistemi
 * =============================================================================
 */

import { ISystem, IWorld } from './types';

export class SystemManager {
    private _systems: ISystem[];
    private _systemsByName: Map<string, ISystem>;
    private _needsSort: boolean;
    private _world: IWorld | null;

    constructor() {
        this._systems = [];
        this._systemsByName = new Map();
        this._needsSort = false;
        this._world = null;
    }

    /**
     * Imposta il riferimento al World
     */
    setWorld(world: IWorld): void {
        this._world = world;
    }

    /**
     * Registra un nuovo sistema
     */
    register(system: ISystem): ISystem {
        if (this._systemsByName.has(system.name)) {
            throw new Error(`Sistema "${system.name}" già registrato`);
        }

        this._systems.push(system);
        this._systemsByName.set(system.name, system);
        this._needsSort = true;

        if (this._world) {
            system.init(this._world);
        }

        console.log(`[SystemManager] Registrato: ${system.name} (priorità: ${system.priority})`);

        return system;
    }

    /**
     * Rimuove un sistema
     */
    unregister(systemName: string): boolean {
        const system = this._systemsByName.get(systemName);
        if (!system) {
            return false;
        }

        system.destroy();

        const index = this._systems.indexOf(system);
        if (index !== -1) {
            this._systems.splice(index, 1);
        }

        this._systemsByName.delete(systemName);

        console.log(`[SystemManager] Rimosso: ${systemName}`);

        return true;
    }

    /**
     * Ottiene un sistema per nome
     */
    get(systemName: string): ISystem | undefined {
        return this._systemsByName.get(systemName);
    }

    /**
     * Inizializza tutti i sistemi registrati
     */
    initAll(): void {
        if (!this._world) {
            throw new Error('World non impostato. Chiamare setWorld() prima di initAll()');
        }

        this._sortIfNeeded();

        for (const system of this._systems) {
            // Re-init can be called safely or we can check if already inited
            // Since interface doesn't expose 'world' property (it's internal to System impl),
            // we just call init() again or rely on register calling it.
            // But for bulk init:
            system.init(this._world);
        }

        console.log(`[SystemManager] Inizializzati ${this._systems.length} sistemi`);
    }

    /**
     * Aggiorna tutti i sistemi abilitati
     */
    update(deltaTime: number): void {
        this._sortIfNeeded();

        for (const system of this._systems) {
            if (!system.enabled) {
                continue;
            }

            try {
                system.update(deltaTime);
            } catch (error) {
                console.error(`[SystemManager] Errore in ${system.name}.update():`, error);
            }
        }
    }

    /**
     * Chiama render() su tutti i sistemi
     */
    render(interpolation: number): void {
        for (const system of this._systems) {
            if (!system.enabled) {
                continue;
            }

            try {
                system.render(interpolation);
            } catch (error) {
                console.error(`[SystemManager] Errore in ${system.name}.render():`, error);
            }
        }
    }

    /**
     * Distrugge tutti i sistemi
     */
    destroyAll(): void {
        for (const system of this._systems) {
            try {
                system.destroy();
            } catch (error) {
                console.error(`[SystemManager] Errore in ${system.name}.destroy():`, error);
            }
        }

        this._systems = [];
        this._systemsByName.clear();

        console.log('[SystemManager] Tutti i sistemi distrutti');
    }

    /**
     * Ordina i sistemi per priorità se necessario
     */
    private _sortIfNeeded(): void {
        if (this._needsSort) {
            this._systems.sort((a, b) => b.priority - a.priority);
            this._needsSort = false;
        }
    }

    /**
     * Ottiene statistiche di tutti i sistemi
     */
    getStats(): object[] {
        return this._systems.map(system => system.getStats());
    }

    get count(): number {
        return this._systems.length;
    }
}

export default SystemManager;
