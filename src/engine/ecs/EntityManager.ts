/**
 * =============================================================================
 * ENTITY-MANAGER.TS - Gestore centrale delle entità
 * =============================================================================
 */

import { Entity } from './Entity';
import { EntityId } from './types';

export class EntityManager {
    private _entities: Map<EntityId, Entity>;
    private _entitiesByTag: Map<string, Set<EntityId>>;
    public _pendingRemoval: Set<EntityId>; // Accessibile da World
    private _totalCreated: number;
    private _totalDestroyed: number;

    constructor() {
        this._entities = new Map();
        this._entitiesByTag = new Map();
        this._pendingRemoval = new Set();
        this._totalCreated = 0;
        this._totalDestroyed = 0;
    }

    /**
     * Crea una nuova entità e la registra nel manager
     */
    create(tag: string = ''): Entity {
        const entity = new Entity(tag);
        
        this._entities.set(entity.id, entity);

        if (tag) {
            if (!this._entitiesByTag.has(tag)) {
                this._entitiesByTag.set(tag, new Set());
            }
            this._entitiesByTag.get(tag)!.add(entity.id);
        }

        this._totalCreated++;
        
        return entity;
    }

    /**
     * Ottiene un'entità tramite ID
     */
    get(entityId: EntityId): Entity | undefined {
        return this._entities.get(entityId);
    }

    /**
     * Verifica se un'entità esiste ed è attiva
     */
    exists(entityId: EntityId): boolean {
        const entity = this._entities.get(entityId);
        return entity !== undefined && !entity.markedForRemoval;
    }

    /**
     * Marca un'entità per la rimozione differita
     */
    markForRemoval(entityId: EntityId): boolean {
        const entity = this._entities.get(entityId);
        if (!entity) {
            return false;
        }

        entity.markedForRemoval = true;
        this._pendingRemoval.add(entityId);
        return true;
    }

    /**
     * Rimuove immediatamente un'entità
     */
    removeImmediate(entityId: EntityId): boolean {
        const entity = this._entities.get(entityId);
        if (!entity) {
            return false;
        }

        // Rimuovi dall'indice tag
        if (entity.tag && this._entitiesByTag.has(entity.tag)) {
            this._entitiesByTag.get(entity.tag)!.delete(entityId);
        }

        // Rimuovi dallo storage principale
        this._entities.delete(entityId);
        this._pendingRemoval.delete(entityId);
        
        this._totalDestroyed++;
        
        return true;
    }

    /**
     * Esegue la rimozione effettiva di tutte le entità marcate
     */
    flushRemovals(): number {
        let removed = 0;

        for (const entityId of this._pendingRemoval) {
            if (this.removeImmediate(entityId)) {
                removed++;
            }
        }

        this._pendingRemoval.clear();
        return removed;
    }

    /**
     * Ottiene tutte le entità con un determinato tag
     */
    getByTag(tag: string): Entity[] {
        const ids = this._entitiesByTag.get(tag);
        if (!ids) {
            return [];
        }

        const result: Entity[] = [];
        for (const id of ids) {
            const entity = this._entities.get(id);
            if (entity && !entity.markedForRemoval) {
                result.push(entity);
            }
        }
        return result;
    }

    /**
     * Ottiene tutti gli ID delle entità attive
     */
    getAllIds(): EntityId[] {
        const ids: EntityId[] = [];
        for (const [id, entity] of this._entities) {
            if (!entity.markedForRemoval) {
                ids.push(id);
            }
        }
        return ids;
    }

    /**
     * Itera su tutte le entità attive
     */
    forEach(callback: (entity: Entity, id: EntityId) => void): void {
        for (const [id, entity] of this._entities) {
            if (!entity.markedForRemoval) {
                callback(entity, id);
            }
        }
    }

    /**
     * Conta le entità attive
     */
    get count(): number {
        return this._entities.size - this._pendingRemoval.size;
    }

    /**
     * Ottiene statistiche per debug
     */
    getStats(): object {
        return {
            active: this.count,
            pendingRemoval: this._pendingRemoval.size,
            totalCreated: this._totalCreated,
            totalDestroyed: this._totalDestroyed,
            tagCounts: this._getTagCounts()
        };
    }

    private _getTagCounts(): Record<string, number> {
        const counts: Record<string, number> = {};
        for (const [tag, ids] of this._entitiesByTag) {
            counts[tag] = ids.size;
        }
        return counts;
    }

    /**
     * Pulisce tutto
     */
    clear(): void {
        this._entities.clear();
        this._entitiesByTag.clear();
        this._pendingRemoval.clear();
        // Reset id counter? Usually imported
        this._totalCreated = 0;
        this._totalDestroyed = 0;
    }
}

export default EntityManager;
